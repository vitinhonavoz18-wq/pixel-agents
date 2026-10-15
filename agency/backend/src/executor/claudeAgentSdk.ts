import type {
  CanUseTool,
  HookCallback,
  Options,
  PermissionResult,
  query as sdkQuery,
  SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { addUsage, EMPTY_USAGE, type UsageTotals } from '@pixel-agency/shared';

// Reused from the Pixel Agents Claude provider: the same "Reading x.ts" /
// "Running: npm test" status strings the original office shows.
import { formatToolStatus } from '../../../../server/src/providers/hook/claude/claude.js';
import { redactInput } from '../policy.js';
import type { AgentExecutor, ExecutorResult, ExecutorRunInput, ExecutorStatus } from './types.js';

type QueryFn = typeof sdkQuery;

export interface ClaudeSdkExecutorOptions {
  defaultModel: string;
  maxTurns: number;
  maxBudgetUsd?: number;
  /** Where Claude Code keeps sessions (resume) — on the backend's data volume. */
  claudeConfigDir: string;
  /** Injected for tests; defaults to the real SDK `query`. */
  queryFn?: QueryFn;
}

/** Env vars the Claude Code process legitimately needs. Nothing else is passed. */
const PASSTHROUGH_ENV = [
  'PATH',
  'HOME',
  'LANG',
  'LC_ALL',
  'TZ',
  'TMPDIR',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_PROFILE',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'CLOUD_ML_REGION',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
];

const MAX_TOOL_OUTPUT = 8000;

function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        b && typeof b === 'object' && 'text' in b ? String((b as { text: unknown }).text) : '',
      )
      .join('\n');
  }
  return '';
}

function usageFromModel(m: {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}): UsageTotals {
  return {
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
    cacheReadTokens: m.cacheReadInputTokens,
    cacheCreationTokens: m.cacheCreationInputTokens,
    costUsd: m.costUSD,
  };
}

/**
 * Runs a mission with the official Claude Agent SDK (`query()`): the Claude
 * Code harness with its built-in tools, executing inside the mission's
 * isolated workspace on this backend's own infrastructure.
 *
 * Safety layers, outermost first:
 *  1. `settingSources: []` — the cloned repo's own `.claude/settings.json`
 *     (which could define hooks = arbitrary commands) is never loaded.
 *  2. A minimal env: backend secrets (admin token, GitHub token) never reach
 *     the agent's shell.
 *  3. A `PreToolUse` hook enforcing the deny-list on EVERY tool call, even
 *     the ones Claude Code would auto-allow.
 *  4. `canUseTool` routing "ask" decisions to a human in the app.
 */
export class ClaudeAgentSdkExecutor implements AgentExecutor {
  private queryFn: QueryFn | null;

  constructor(private readonly opts: ClaudeSdkExecutorOptions) {
    this.queryFn = opts.queryFn ?? null;
  }

  status(): ExecutorStatus {
    return { kind: 'claude_agent_sdk', ready: true };
  }

  private async getQuery(): Promise<QueryFn> {
    if (!this.queryFn) {
      const mod = await import('@anthropic-ai/claude-agent-sdk');
      this.queryFn = mod.query;
    }
    return this.queryFn;
  }

  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const key of PASSTHROUGH_ENV) {
      const v = process.env[key];
      if (v !== undefined) env[key] = v;
    }
    env.CLAUDE_CONFIG_DIR = this.opts.claudeConfigDir;
    env.CLAUDE_AGENT_SDK_CLIENT_APP = 'pixel-agency-backend/1.0.0';
    return env;
  }

  private systemAppend(input: ExecutorRunInput): string {
    const { agent, project, mission } = input;
    const lines = [
      `# PIXEL AGENCY`,
      `Você é ${agent.name}, ${agent.role}, no departamento ${agent.department} da PIXEL AGENCY.`,
      `Projeto: ${project.name}${project.repo ? ` (github.com/${project.repo.owner}/${project.repo.name})` : ' (sem repositório)'}.`,
      `Workspace isolado desta ${mission.kind === 'chat' ? 'conversa' : 'missão'}: o diretório atual. Nunca trabalhe fora dele.`,
      `Regras: não faça push, deploy, publicação nem chamadas de escrita a serviços externos sem pedir;`,
      `não leia variáveis de ambiente nem arquivos de credenciais; responda em português do Brasil.`,
      mission.kind === 'task'
        ? `Ao terminar, entregue um relatório final com: o que foi feito, evidências (arquivos, comandos e resultados de testes), problemas encontrados e próximos passos.`
        : '',
    ];
    if (agent.instructions) lines.push('', '## Instruções do agente', agent.instructions);
    if (input.projectContext)
      lines.push('', '## Contexto do projeto (CLAUDE.md)', input.projectContext.slice(0, 20_000));
    return lines.filter((l) => l !== undefined).join('\n');
  }

  async run(input: ExecutorRunInput): Promise<ExecutorResult> {
    const query = await this.getQuery();
    const abortController = new AbortController();
    const onAbort = () => abortController.abort();
    input.signal.addEventListener('abort', onAbort, { once: true });

    const toolNames = new Map<string, string>();

    const preToolUse: HookCallback = async (hookInput) => {
      if (hookInput.hook_event_name !== 'PreToolUse') return {};
      const toolInput = (hookInput.tool_input ?? {}) as Record<string, unknown>;
      const verdict = input.evaluate(hookInput.tool_name, toolInput);
      if (verdict.decision === 'deny') {
        input.emit({
          kind: 'log',
          level: 'warn',
          message: `${hookInput.tool_name} bloqueado: ${verdict.reason}`,
        });
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: verdict.reason,
          },
        };
      }
      if (verdict.decision === 'ask') {
        // Force the permission path so canUseTool (below) asks a human,
        // even for calls Claude Code would otherwise auto-allow.
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'ask',
            permissionDecisionReason: verdict.reason,
          },
        };
      }
      return {};
    };

    const canUseTool: CanUseTool = async (toolName, toolInput): Promise<PermissionResult> => {
      const verdict = input.evaluate(toolName, toolInput);
      if (verdict.decision === 'deny') return { behavior: 'deny', message: verdict.reason };
      if (verdict.decision === 'allow') return { behavior: 'allow', updatedInput: toolInput };
      const answer = await input.requestApproval({
        toolName,
        input: toolInput,
        summary: formatToolStatus(toolName, toolInput),
        reason: verdict.reason,
        risk: verdict.risk,
      });
      return answer === 'approved'
        ? { behavior: 'allow', updatedInput: toolInput }
        : { behavior: 'deny', message: 'Operação negada pelo usuário no PIXEL AGENCY.' };
    };

    const options: Options = {
      cwd: input.workspace,
      model: input.agent.model ?? this.opts.defaultModel,
      maxTurns: this.opts.maxTurns,
      ...(this.opts.maxBudgetUsd ? { maxBudgetUsd: this.opts.maxBudgetUsd } : {}),
      abortController,
      permissionMode: 'default',
      canUseTool,
      hooks: { PreToolUse: [{ hooks: [preToolUse] }] },
      settingSources: [],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: this.systemAppend(input) },
      includePartialMessages: true,
      env: this.buildEnv(),
      ...(input.agent.tools.length > 0 ? { tools: input.agent.tools } : {}),
      ...(input.resumeSessionId ? { resume: input.resumeSessionId } : {}),
    };

    let sessionId: string | undefined;
    let model: string | undefined;
    let finalText = '';
    let result: ExecutorResult | null = null;

    try {
      for await (const msg of query({
        prompt: input.prompt,
        options,
      }) as AsyncIterable<SDKMessage>) {
        if (input.signal.aborted) break;
        switch (msg.type) {
          case 'system': {
            if (msg.subtype === 'init') {
              sessionId = msg.session_id;
              model = msg.model;
              input.onSessionId(msg.session_id);
              input.emit({
                kind: 'log',
                level: 'info',
                message: `Sessão Claude ${msg.session_id} (${msg.model})`,
              });
            }
            break;
          }
          case 'stream_event': {
            const ev = msg.event;
            if (
              msg.parent_tool_use_id === null &&
              ev.type === 'content_block_delta' &&
              ev.delta.type === 'text_delta'
            ) {
              input.emit({ kind: 'text', text: ev.delta.text, partial: true });
            }
            break;
          }
          case 'assistant': {
            if (msg.parent_tool_use_id !== null) break; // sub-agent internals
            for (const block of msg.message.content) {
              if (block.type === 'text' && block.text.trim()) {
                finalText = block.text;
                input.emit({ kind: 'text', text: block.text, partial: false });
              } else if (block.type === 'tool_use') {
                toolNames.set(block.id, block.name);
                input.emit({
                  kind: 'tool_start',
                  toolUseId: block.id,
                  toolName: block.name,
                  statusText: formatToolStatus(block.name, block.input),
                  input: redactInput(block.input),
                });
              }
            }
            break;
          }
          case 'user': {
            if (msg.parent_tool_use_id !== null) break;
            const content = msg.message.content;
            if (!Array.isArray(content)) break;
            for (const block of content) {
              if (block && typeof block === 'object' && block.type === 'tool_result') {
                const text = toolResultText(block.content);
                input.emit({
                  kind: 'tool_end',
                  toolUseId: block.tool_use_id,
                  toolName: toolNames.get(block.tool_use_id),
                  isError: block.is_error === true,
                  output:
                    text.length > MAX_TOOL_OUTPUT ? text.slice(0, MAX_TOOL_OUTPUT) + '…' : text,
                });
              }
            }
            break;
          }
          case 'result': {
            let usage: UsageTotals = { ...EMPTY_USAGE };
            const perModel: Record<string, UsageTotals> = {};
            for (const [m, mu] of Object.entries(msg.modelUsage ?? {})) {
              perModel[m] = usageFromModel(mu);
              usage = addUsage(usage, perModel[m]);
            }
            // Cost: the SDK's running estimate (`total_cost_usd`) is authoritative over per-model sums.
            usage.costUsd = msg.total_cost_usd ?? usage.costUsd;
            const text =
              msg.subtype === 'success'
                ? msg.result || finalText
                : (msg.errors ?? []).join('\n') || msg.subtype;
            result = {
              outcome: msg.subtype === 'success' && !msg.is_error ? 'success' : 'error',
              resultText: text,
              sessionId: msg.session_id ?? sessionId,
              model,
              numTurns: msg.num_turns,
              usage,
              perModel,
            };
            break;
          }
          default:
            break;
        }
      }
    } catch (err) {
      if (input.signal.aborted) {
        return {
          outcome: 'cancelled',
          resultText: 'Cancelado.',
          sessionId,
          model,
          usage: { ...EMPTY_USAGE },
          perModel: {},
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        outcome: 'error',
        resultText: `Falha ao executar o Claude Agent SDK: ${message}`,
        sessionId,
        model,
        usage: { ...EMPTY_USAGE },
        perModel: {},
      };
    } finally {
      input.signal.removeEventListener('abort', onAbort);
    }

    if (input.signal.aborted) {
      return {
        outcome: 'cancelled',
        resultText: 'Cancelado.',
        sessionId,
        model,
        usage: result?.usage ?? { ...EMPTY_USAGE },
        perModel: result?.perModel ?? {},
      };
    }
    return (
      result ?? {
        outcome: 'error',
        resultText: 'O Claude Agent SDK terminou sem mensagem de resultado.',
        sessionId,
        model,
        usage: { ...EMPTY_USAGE },
        perModel: {},
      }
    );
  }
}
