import type {
  AgentProfile,
  Mission,
  MissionEventBody,
  Project,
  UsageTotals,
} from '@pixel-agency/shared';

import type { PolicyDecision } from '../policy.js';

export interface ApprovalRequest {
  toolName: string;
  input: Record<string, unknown>;
  summary: string;
  reason: string;
  risk: 'low' | 'medium' | 'high';
}

export interface ExecutorRunInput {
  mission: Mission;
  agent: AgentProfile;
  project: Project;
  workspace: string;
  prompt: string;
  /** Claude session to resume (chat continuity / interrupted missions). */
  resumeSessionId?: string;
  /** Extra project context (e.g. the repo's CLAUDE.md), appended to the system prompt. */
  projectContext?: string;
  signal: AbortSignal;
  emit: (event: MissionEventBody) => void;
  onSessionId: (sessionId: string) => void;
  evaluate: (toolName: string, input: Record<string, unknown>) => PolicyDecision;
  requestApproval: (req: ApprovalRequest) => Promise<'approved' | 'denied'>;
}

export interface ExecutorResult {
  outcome: 'success' | 'error' | 'cancelled';
  resultText: string;
  sessionId?: string;
  model?: string;
  numTurns?: number;
  usage: UsageTotals;
  /** Per-model breakdown (Agent SDK `modelUsage`). */
  perModel: Record<string, UsageTotals>;
}

export interface ExecutorStatus {
  kind: 'claude_agent_sdk' | 'demo' | 'unavailable';
  ready: boolean;
  reason?: string;
}

export interface AgentExecutor {
  status(): ExecutorStatus;
  run(input: ExecutorRunInput): Promise<ExecutorResult>;
}
