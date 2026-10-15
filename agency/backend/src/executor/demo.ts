import { EMPTY_USAGE } from '@pixel-agency/shared';

import type { AgentExecutor, ExecutorResult, ExecutorRunInput, ExecutorStatus } from './types.js';

const STEPS: Array<{ tool: string; status: string; input: Record<string, unknown> }> = [
  { tool: 'TodoWrite', status: 'Planejando etapas (DEMO)', input: {} },
  { tool: 'Glob', status: 'Searching files (DEMO)', input: { pattern: '**/*' } },
  { tool: 'Read', status: 'Reading README.md (DEMO)', input: { file_path: 'README.md' } },
  { tool: 'Edit', status: 'Editing exemplo.ts (DEMO)', input: { file_path: 'exemplo.ts' } },
  { tool: 'Bash', status: 'Running: npm test (DEMO)', input: { command: 'npm test' } },
  {
    tool: 'Bash',
    status: 'Running: git diff --stat (DEMO)',
    input: { command: 'git diff --stat' },
  },
];

/**
 * DEMO executor — ONLY active with AGENCY_DEMO_MODE=1. It performs no work,
 * calls no model and touches no repository: it replays a fixed script so the
 * interface can be tried without credentials. Every mission/event/chat it
 * produces carries `demo: true` and the app shows a "MODO DEMO" banner.
 */
export class DemoExecutor implements AgentExecutor {
  constructor(private readonly stepDelayMs = 1500) {}

  status(): ExecutorStatus {
    return {
      kind: 'demo',
      ready: true,
      reason: 'Modo DEMO: eventos simulados, nenhuma execução real.',
    };
  }

  async run(input: ExecutorRunInput): Promise<ExecutorResult> {
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        input.signal.addEventListener('abort', () => {
          clearTimeout(t);
          resolve();
        });
      });
    input.emit({
      kind: 'log',
      level: 'warn',
      message: 'MODO DEMO — nenhuma tarefa real está sendo executada.',
    });
    let i = 0;
    for (const step of STEPS) {
      if (input.signal.aborted) break;
      const id = `demo-${i++}`;
      input.emit({
        kind: 'tool_start',
        toolUseId: id,
        toolName: step.tool,
        statusText: step.status,
        input: step.input,
      });
      await wait(this.stepDelayMs);
      input.emit({
        kind: 'tool_end',
        toolUseId: id,
        toolName: step.tool,
        isError: false,
        output: '(simulado)',
      });
    }
    if (input.signal.aborted) {
      return {
        outcome: 'cancelled',
        resultText: 'Cancelado.',
        usage: { ...EMPTY_USAGE },
        perModel: {},
      };
    }
    const text =
      `[DEMO] ${input.agent.name} recebeu: "${input.prompt.slice(0, 200)}".\n\n` +
      'Esta é uma resposta SIMULADA do modo DEMO. Nenhum arquivo foi lido, nenhum teste foi executado ' +
      'e nenhum modelo Claude foi chamado. Configure ANTHROPIC_API_KEY no backend para execução real.';
    for (const word of text.split(/(?<= )/)) {
      if (input.signal.aborted) break;
      input.emit({ kind: 'text', text: word, partial: true });
      await wait(25);
    }
    input.emit({ kind: 'text', text, partial: false });
    return {
      outcome: 'success',
      resultText: text,
      model: 'demo',
      numTurns: 0,
      usage: { ...EMPTY_USAGE },
      perModel: {},
    };
  }
}
