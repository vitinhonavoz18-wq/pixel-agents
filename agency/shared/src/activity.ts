import type { AgentActivityState } from './schemas';

/** pt-BR labels for each operational state. */
export const ACTIVITY_LABELS: Record<AgentActivityState, string> = {
  offline: 'Offline',
  idle: 'Ocioso',
  planning: 'Planejando',
  reading: 'Lendo arquivos',
  coding: 'Programando',
  running_command: 'Executando comandos',
  testing: 'Executando testes',
  reviewing: 'Revisando',
  awaiting_approval: 'Aguardando aprovação',
  done: 'Concluído',
  failed: 'Falhou',
};

/** States in which the character sits at the desk and works. */
export const WORKING_STATES: ReadonlySet<AgentActivityState> = new Set([
  'planning',
  'reading',
  'coding',
  'running_command',
  'testing',
  'reviewing',
  'awaiting_approval',
]);

export function isWorking(state: AgentActivityState): boolean {
  return WORKING_STATES.has(state);
}

const READ_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'LS',
  'NotebookRead',
  'WebFetch',
  'WebSearch',
  'ListMcpResourcesTool',
  'ReadMcpResourceTool',
]);
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const PLAN_TOOLS = new Set(['TodoWrite', 'EnterPlanMode', 'ExitPlanMode', 'Task', 'Agent']);

/** Commands that run a test suite (best effort, conservative). */
const TEST_COMMAND =
  /(^|[\s;&|(])(npm|pnpm|yarn|bun)\s+(run\s+)?(test|e2e|test:\S+)\b|\b(vitest|jest|mocha|pytest|playwright\s+test|go\s+test|cargo\s+test|phpunit|rspec|dotnet\s+test|gradle\w*\s+test|mvn\s+test)\b/i;
/** Commands that inspect changes rather than produce them. */
const REVIEW_COMMAND = /^\s*(git\s+(diff|log|show|status|blame)|gh\s+pr\s+(view|diff))\b/i;

/**
 * Classify a Claude Code tool call into an operational state. Pure and
 * deterministic: the same real event always yields the same animation.
 */
export function activityForTool(toolName: string, input?: unknown): AgentActivityState {
  if (READ_TOOLS.has(toolName)) return 'reading';
  if (WRITE_TOOLS.has(toolName)) return 'coding';
  if (PLAN_TOOLS.has(toolName)) return 'planning';
  if (toolName === 'AskUserQuestion') return 'awaiting_approval';
  if (toolName === 'Bash' || toolName === 'BashOutput') {
    const cmd =
      input &&
      typeof input === 'object' &&
      typeof (input as { command?: unknown }).command === 'string'
        ? (input as { command: string }).command
        : '';
    if (TEST_COMMAND.test(cmd)) return 'testing';
    if (REVIEW_COMMAND.test(cmd)) return 'reviewing';
    return 'running_command';
  }
  if (toolName.startsWith('mcp__')) return 'running_command';
  return 'running_command';
}

/**
 * The Claude tool name the office should animate for a state: reading tools
 * play the "reading" animation, everything else types.
 */
export function officeToolForActivity(state: AgentActivityState): string | null {
  switch (state) {
    case 'reading':
    case 'reviewing':
      return 'Read';
    case 'coding':
      return 'Edit';
    case 'running_command':
    case 'testing':
      return 'Bash';
    case 'planning':
      return 'TodoWrite';
    case 'awaiting_approval':
      return 'Bash';
    default:
      return null;
  }
}

/** Tools the office renders with the reading animation. */
export const OFFICE_READING_TOOLS = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];
