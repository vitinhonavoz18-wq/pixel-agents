import * as fs from 'node:fs';
import * as path from 'node:path';

import type {
  AgentProfile,
  Approval,
  ChatMessage,
  Mission,
  MissionEvent,
  Project,
  ProjectBranding,
  ProjectPreview,
  UsageAlertRule,
  UsageRecord,
} from '@pixel-agency/shared';

import { readJson, writeFileAtomic } from './util/fsAtomic.js';

/**
 * One JSON document per collection, written atomically (tmp + rename) and
 * debounced. Append-only logs (mission events, audit) are JSONL.
 *
 * Deliberately dependency-free: a single small instance needs no database.
 * The `Collection` surface is the seam for swapping in Postgres later.
 */
export class Collection<T extends { id: string }> {
  private items = new Map<string, T>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string,
    private readonly flushDelayMs = 50,
  ) {
    const raw = readJson<T[]>(file, []);
    for (const item of raw) this.items.set(item.id, item);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  all(): T[] {
    return [...this.items.values()];
  }

  filter(pred: (t: T) => boolean): T[] {
    return this.all().filter(pred);
  }

  put(item: T): T {
    this.items.set(item.id, item);
    this.schedule();
    return item;
  }

  delete(id: string): boolean {
    const had = this.items.delete(id);
    if (had) this.schedule();
    return had;
  }

  size(): number {
    return this.items.size;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), this.flushDelayMs);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    writeFileAtomic(this.file, JSON.stringify(this.all(), null, 1));
  }
}

export class AppendLog<T> {
  constructor(private readonly file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  append(entry: T): void {
    fs.appendFileSync(this.file, JSON.stringify(entry) + '\n', { mode: 0o600 });
  }

  read(limit = 1000): T[] {
    let text: string;
    try {
      text = fs.readFileSync(this.file, 'utf8');
    } catch {
      return [];
    }
    const lines = text.split('\n').filter(Boolean);
    const out: T[] = [];
    for (const line of lines.slice(-limit)) {
      try {
        out.push(JSON.parse(line) as T);
      } catch {
        // A torn final line after a crash is skipped, never fatal.
      }
    }
    return out;
  }
}

export class AgencyStore {
  readonly agents: Collection<AgentProfile>;
  readonly projects: Collection<Project>;
  readonly missions: Collection<Mission>;
  readonly approvals: Collection<Approval>;
  readonly chat: Collection<ChatMessage>;
  readonly usage: Collection<UsageRecord>;
  readonly branding: Collection<ProjectBranding & { id: string }>;
  readonly previews: Collection<ProjectPreview>;
  readonly alertRules: Collection<UsageAlertRule>;
  readonly kv: Collection<{ id: string; value: unknown }>;
  private eventLogs = new Map<string, AppendLog<MissionEvent>>();
  private eventSeq = new Map<string, number>();

  constructor(readonly dataDir: string) {
    const db = path.join(dataDir, 'db');
    fs.mkdirSync(db, { recursive: true, mode: 0o700 });
    this.agents = new Collection(path.join(db, 'agents.json'));
    this.projects = new Collection(path.join(db, 'projects.json'));
    this.missions = new Collection(path.join(db, 'missions.json'));
    this.approvals = new Collection(path.join(db, 'approvals.json'));
    this.chat = new Collection(path.join(db, 'chat.json'), 250);
    this.usage = new Collection(path.join(db, 'usage.json'));
    this.branding = new Collection(path.join(db, 'branding.json'));
    this.previews = new Collection(path.join(db, 'previews.json'));
    this.alertRules = new Collection(path.join(db, 'alert-rules.json'));
    this.kv = new Collection(path.join(db, 'kv.json'));
  }

  private eventLog(missionId: string): AppendLog<MissionEvent> {
    let log = this.eventLogs.get(missionId);
    if (!log) {
      log = new AppendLog(path.join(this.dataDir, 'events', `${missionId}.jsonl`));
      this.eventLogs.set(missionId, log);
    }
    return log;
  }

  /** Append an event and assign its per-mission sequence number. */
  appendEvent(event: Omit<MissionEvent, 'seq'>): MissionEvent {
    let seq = this.eventSeq.get(event.missionId);
    if (seq === undefined) {
      const existing = this.eventLog(event.missionId).read(1);
      seq = existing.length > 0 ? existing[existing.length - 1].seq : 0;
    }
    seq += 1;
    this.eventSeq.set(event.missionId, seq);
    const full = { ...event, seq } as MissionEvent;
    this.eventLog(event.missionId).append(full);
    return full;
  }

  events(missionId: string, afterSeq = 0, limit = 2000): MissionEvent[] {
    return this.eventLog(missionId)
      .read(10_000)
      .filter((e) => e.seq > afterSeq)
      .slice(0, limit);
  }

  getKv<T>(key: string, fallback: T): T {
    return (this.kv.get(key)?.value as T | undefined) ?? fallback;
  }

  setKv(key: string, value: unknown): void {
    this.kv.put({ id: key, value });
  }

  flushAll(): void {
    for (const c of [
      this.agents,
      this.projects,
      this.missions,
      this.approvals,
      this.chat,
      this.usage,
      this.branding,
      this.previews,
      this.alertRules,
      this.kv,
    ]) {
      c.flush();
    }
  }
}
