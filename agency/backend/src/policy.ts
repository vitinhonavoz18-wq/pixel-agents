import * as path from 'node:path';

import type { Autonomy } from '@pixel-agency/shared';

export type PolicyDecision =
  | { decision: 'allow'; reason: string }
  | { decision: 'ask'; reason: string; risk: 'low' | 'medium' | 'high' }
  | { decision: 'deny'; reason: string };

/**
 * Commands that are never executed, whatever the autonomy level or approval:
 * destructive system operations, privilege escalation, history rewriting on
 * remotes, piping the network into a shell, and reading the process
 * environment (where the backend's API key lives).
 */
const DENY_COMMANDS: Array<[RegExp, string]> = [
  [
    /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b[^;&|]*\s(\/|~|\$HOME|\*|\.\.)(\s|$|\/)/,
    'remoção recursiva fora do workspace',
  ],
  [/\bsudo\b|\bsu\s+-?\s*\w*\s*$|\bdoas\b/, 'elevação de privilégio'],
  [/\b(mkfs|fdisk|parted|wipefs)\b|\bdd\s+if=/, 'operação de disco'],
  [/:\(\)\s*\{\s*:\|:&\s*\};:/, 'fork bomb'],
  [/\b(shutdown|reboot|halt|poweroff|init\s+0)\b/, 'desligamento do sistema'],
  [/\bchmod\s+(-R\s+)?[0-7]*7[0-7]*\s+\//, 'permissões no sistema'],
  [/\bgit\s+push\b[^;&|]*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)/, 'push forçado'],
  [/\bgit\s+(filter-branch|filter-repo)\b|\bgit\s+reflog\s+expire\b/, 'reescrita de histórico'],
  [/\b(curl|wget)\b[^|]*\|\s*(ba|z|da)?sh\b/, 'execução de script baixado'],
  [/(^|[\s;&|])(env|printenv|set)\s*($|[;&|>])/, 'leitura do ambiente do processo'],
  [/\/proc\/[^/\s]+\/environ/, 'leitura do ambiente do processo'],
  [
    /\$\{?(ANTHROPIC_[A-Z_]*|AGENCY_[A-Z_]*|GITHUB_TOKEN|GH_TOKEN|AWS_[A-Z_]*|GOOGLE_[A-Z_]*|CLAUDE_CODE_[A-Z_]*)\b/,
    'acesso a segredo do servidor',
  ],
  [/\b(ssh|scp|sftp|nc|ncat|telnet)\s/, 'conexão remota interativa'],
  [/\bcrontab\b|\bsystemctl\b|\blaunchctl\b/, 'alteração de serviços do sistema'],
];

/** Operations that always need a human, even for autonomous agents. */
const SENSITIVE_COMMANDS: Array<[RegExp, string, 'medium' | 'high']> = [
  [/\bgit\s+push\b/, 'enviar commits ao GitHub', 'high'],
  [
    /\b(npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b/,
    'publicar pacote',
    'high',
  ],
  [
    /\b(vercel|netlify|firebase|fly|railway|heroku)\b[^;&|]*\bdeploy\b|\bvercel\s+--prod\b/,
    'deploy',
    'high',
  ],
  [
    /\beas\s+(submit|update)\b|\bkubectl\s+(apply|delete|rollout)\b|\bterraform\s+(apply|destroy)\b|\bhelm\s+(install|upgrade|delete)\b/,
    'alteração de infraestrutura',
    'high',
  ],
  [/\bdocker\s+(push|run|rm|rmi|system\s+prune)\b/, 'operação docker', 'medium'],
  [
    /\bgh\s+(pr\s+(create|merge|close)|release|repo\s+(delete|edit)|secret)\b/,
    'operação no GitHub',
    'high',
  ],
  [
    /\b(curl|wget|http)\b[^;&|]*(-X\s*(POST|PUT|PATCH|DELETE)|--data|-d\s)/,
    'requisição de escrita a serviço externo',
    'medium',
  ],
  [/\brm\s+-[a-zA-Z]*r/, 'remoção recursiva', 'medium'],
  [
    /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s|restore\s+--source)\b/,
    'descartar alterações',
    'medium',
  ],
];

/** Everyday development commands a `standard` agent may run unasked. */
const SAFE_COMMAND =
  /^\s*(ls|pwd|cat|head|tail|wc|grep|rg|find|tree|echo|sort|uniq|diff|file|stat|du|jq|which|true|false|test|\[|cd)\b|^\s*git\s+(status|diff|log|show|blame|branch|add|commit|checkout\s+-b|switch\s+-c|stash|rev-parse|ls-files)\b|^\s*(npm|pnpm|yarn|bun)\s+(test|t|run|ci|install|i|exec|ls|outdated|audit)\b|^\s*(npx|pnpm\s+dlx|bunx)\s+(tsc|vitest|jest|eslint|prettier|playwright\s+test|knip)\b|^\s*(node|tsx|ts-node|deno|python3?|pytest|go\s+(test|build|vet)|cargo\s+(test|build|check|clippy)|make|mvn|gradle\w*|dotnet\s+(test|build))\b/;

const READ_ONLY_COMMAND =
  /^\s*(ls|pwd|cat|head|tail|wc|grep|rg|find|tree|echo|sort|uniq|diff|file|stat|du|jq|which)\b|^\s*git\s+(status|diff|log|show|blame|branch|rev-parse|ls-files)\b/;

const READ_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'LS',
  'NotebookRead',
  'TodoWrite',
  'Task',
  'Agent',
  'EnterPlanMode',
  'ExitPlanMode',
  'BashOutput',
  'KillShell',
  'KillBash',
]);
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch']);

/** Files an agent must not read or write (secrets that may be committed by mistake). */
const SECRET_FILE =
  /(^|\/)(\.env(\.[\w.-]+)?|\.npmrc|\.netrc|id_(rsa|ed25519|ecdsa)(\.pub)?|.*\.pem|.*\.p12|.*\.keystore|credentials(\.json)?|service-account.*\.json)$/i;

function filePathOf(input: Record<string, unknown>): string | undefined {
  for (const key of ['file_path', 'notebook_path', 'path']) {
    if (typeof input[key] === 'string') return input[key] as string;
  }
  return undefined;
}

function insideWorkspace(workspace: string, p: string): boolean {
  const abs = path.resolve(workspace, p);
  const root = path.resolve(workspace);
  return abs === root || abs.startsWith(root + path.sep);
}

/**
 * Split a shell line into the simple commands joined by `;`, `&&`, `||`, `|`
 * so each part is checked (a safe prefix can't smuggle a dangerous suffix).
 */
function commandParts(cmd: string): string[] {
  return cmd
    .split(/;|&&|\|\||\||\n|`|\$\(/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function evaluateToolCall(
  toolName: string,
  input: Record<string, unknown>,
  ctx: { workspace: string; autonomy: Autonomy },
): PolicyDecision {
  // ── File access ──────────────────────────────────────────────────────────
  const fp = filePathOf(input);
  if (fp !== undefined && (READ_TOOLS.has(toolName) || WRITE_TOOLS.has(toolName))) {
    if (!insideWorkspace(ctx.workspace, fp)) {
      return { decision: 'deny', reason: `Caminho fora do workspace da missão: ${fp}` };
    }
    const rel = path.relative(ctx.workspace, path.resolve(ctx.workspace, fp));
    if (SECRET_FILE.test(rel)) {
      return { decision: 'deny', reason: `Arquivo de credenciais protegido: ${rel}` };
    }
    if (WRITE_TOOLS.has(toolName) && (rel === '.git' || rel.startsWith('.git' + path.sep))) {
      return { decision: 'deny', reason: 'Escrita direta em .git não é permitida' };
    }
  }

  if (READ_TOOLS.has(toolName)) return { decision: 'allow', reason: 'leitura' };

  if (WRITE_TOOLS.has(toolName)) {
    if (ctx.autonomy === 'supervised') {
      return {
        decision: 'ask',
        reason: `Agente supervisionado quer editar ${fp ?? 'arquivo'}`,
        risk: 'low',
      };
    }
    return { decision: 'allow', reason: 'edição dentro do workspace' };
  }

  if (WEB_TOOLS.has(toolName)) {
    return ctx.autonomy === 'supervised'
      ? { decision: 'ask', reason: 'Acesso à web', risk: 'low' }
      : { decision: 'allow', reason: 'consulta web' };
  }

  if (toolName === 'Bash') {
    const cmd = typeof input.command === 'string' ? input.command : '';
    if (!cmd.trim()) return { decision: 'deny', reason: 'Comando vazio' };
    for (const [re, why] of DENY_COMMANDS) {
      if (re.test(cmd)) return { decision: 'deny', reason: `Bloqueado pela política: ${why}` };
    }
    for (const [re, why, risk] of SENSITIVE_COMMANDS) {
      if (re.test(cmd)) return { decision: 'ask', reason: `Operação sensível: ${why}`, risk };
    }
    const parts = commandParts(cmd);
    if (ctx.autonomy === 'supervised') {
      return parts.every((p) => READ_ONLY_COMMAND.test(p))
        ? { decision: 'allow', reason: 'comando somente leitura' }
        : {
            decision: 'ask',
            reason: 'Agente supervisionado quer executar um comando',
            risk: 'medium',
          };
    }
    if (ctx.autonomy === 'standard') {
      return parts.every((p) => SAFE_COMMAND.test(p))
        ? { decision: 'allow', reason: 'comando de desenvolvimento' }
        : { decision: 'ask', reason: 'Comando fora da lista segura', risk: 'medium' };
    }
    return { decision: 'allow', reason: 'agente autônomo' };
  }

  if (toolName === 'AskUserQuestion') {
    return { decision: 'ask', reason: 'O agente fez uma pergunta', risk: 'low' };
  }

  // MCP and unknown tools: a human decides.
  return { decision: 'ask', reason: `Ferramenta ${toolName}`, risk: 'medium' };
}

/** Redact obvious secrets and truncate a tool input before showing/storing it. */
export function redactInput(input: unknown, max = 4000): unknown {
  let text: string;
  try {
    text = JSON.stringify(input);
  } catch {
    return '[unserializable]';
  }
  text = text
    .replace(/(sk-ant-[a-zA-Z0-9_-]{6})[a-zA-Z0-9_-]+/g, '$1…')
    .replace(/(gh[pousr]_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, '$1…')
    .replace(/(pa_[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, '$1…');
  if (text.length > max) text = text.slice(0, max) + '…';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
