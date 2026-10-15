import * as path from 'node:path';

import type { AuditEntry } from '@pixel-agency/shared';

import { AppendLog } from './store.js';
import { nowIso } from './util/ids.js';

/** Append-only audit trail of every state-changing action. */
export class AuditLog {
  private log: AppendLog<AuditEntry>;

  constructor(dataDir: string) {
    this.log = new AppendLog(path.join(dataDir, 'audit.jsonl'));
  }

  record(entry: Omit<AuditEntry, 'ts'>): void {
    this.log.append({ ts: nowIso(), ...entry });
  }

  recent(limit = 200): AuditEntry[] {
    return this.log.read(limit).reverse();
  }
}
