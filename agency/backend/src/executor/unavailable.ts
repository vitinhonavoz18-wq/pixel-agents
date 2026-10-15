import { EMPTY_USAGE } from '@pixel-agency/shared';

import type { AgentExecutor, ExecutorResult, ExecutorStatus } from './types.js';

/**
 * Used when no Claude credentials are configured. Missions fail fast with an
 * explicit, actionable message instead of pretending to work.
 */
export class UnavailableExecutor implements AgentExecutor {
  constructor(private readonly reason: string) {}

  status(): ExecutorStatus {
    return { kind: 'unavailable', ready: false, reason: this.reason };
  }

  async run(): Promise<ExecutorResult> {
    return { outcome: 'error', resultText: this.reason, usage: { ...EMPTY_USAGE }, perModel: {} };
  }
}
