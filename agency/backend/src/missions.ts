import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  activityForTool,
  type AgentActivityState,
  type AgentProfile,
  type AgentRuntimeState,
  type Approval,
  type ChatMessage,
  type Mission,
  type MissionCreate,
  MissionCreateSchema,
  type MissionEventBody,
  type MissionStatus,
  type Project,
} from '@pixel-agency/shared';

import type { AuditLog } from './audit.js';
import type { EventBus } from './events.js';
import type { AgentExecutor, ApprovalRequest, ExecutorResult } from './executor/types.js';
import { evaluateToolCall, redactInput } from './policy.js';
import type { AgencyStore } from './store.js';
import type { UsageService } from './usage.js';
import { newId, nowIso } from './util/ids.js';
import type { Workspace, WorkspaceManager } from './workspaces.js';

export class MissionError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

interface PendingApproval {
  resolve: (answer: 'approved' | 'denied') => void;
  timer: NodeJS.Timeout;
}

const ACTIVE_STATUSES: ReadonlySet<MissionStatus> = new Set([
  'running',
  'awaiting_approval',
  'testing',
]);
const DONE_LINGER_MS = 20_000;
const CHAT_STREAM_FLUSH_MS = 120;

export interface MissionServiceOptions {
  maxConcurrent: number;
  missionTimeoutMs: number;
  approvalTimeoutMs: number;
  demo: boolean;
}

/**
 * Mission queue + runner. Owns the ONLY path from real execution events to
 * agent operational states (`AgentRuntimeState`), which drive the office
 * animations. Nothing here invents activity: every state change is the
 * consequence of an executor event, an approval, or a mission ending.
 */
export class MissionService {
  private runtimes = new Map<string, AgentRuntimeState>();
  private queue: string[] = [];
  private running = new Map<string, AbortController>();
  private approvals = new Map<string, PendingApproval>();
  private lingerTimers = new Map<string, NodeJS.Timeout>();
  private chatBuffers = new Map<
    string,
    { message: ChatMessage; timer: NodeJS.Timeout | null; committed: string; pending: string }
  >();

  constructor(
    private readonly store: AgencyStore,
    private readonly bus: EventBus,
    private readonly audit: AuditLog,
    private readonly workspaces: WorkspaceManager,
    private readonly executor: AgentExecutor,
    private readonly usage: UsageService,
    private readonly opts: MissionServiceOptions,
  ) {}

  // ── Runtime state (what the office shows) ────────────────────────────────

  runtimeStates(): AgentRuntimeState[] {
    return this.store.agents.all().map((a) => this.runtimeOf(a.id));
  }

  runtimeOf(agentId: string): AgentRuntimeState {
    return (
      this.runtimes.get(agentId) ?? {
        agentId,
        activity: this.store.agents.get(agentId)?.enabled === false ? 'offline' : 'idle',
        statusText: '',
        updatedAt: nowIso(),
        demo: false,
      }
    );
  }

  private setRuntime(
    agentId: string,
    activity: AgentActivityState,
    statusText: string,
    mission?: Mission,
    toolName?: string,
  ): void {
    const linger = this.lingerTimers.get(agentId);
    if (linger) {
      clearTimeout(linger);
      this.lingerTimers.delete(agentId);
    }
    const state: AgentRuntimeState = {
      agentId,
      activity,
      statusText: statusText.slice(0, 300),
      missionId: mission?.id,
      projectId: mission?.projectId,
      toolName,
      updatedAt: nowIso(),
      demo: mission?.demo ?? false,
    };
    this.runtimes.set(agentId, state);
    this.bus.publish({ type: 'runtime', state });
    if (activity === 'done' || activity === 'failed') {
      // The finished cue stays visible for a moment, then the agent is idle.
      this.lingerTimers.set(
        agentId,
        setTimeout(() => {
          this.lingerTimers.delete(agentId);
          if (this.runtimes.get(agentId)?.activity === activity) {
            this.setRuntime(agentId, 'idle', '');
          }
        }, DONE_LINGER_MS),
      );
    }
  }

  // ── Mission lifecycle ────────────────────────────────────────────────────

  private requireAgentAndProject(
    agentId: string,
    projectId: string,
  ): { agent: AgentProfile; project: Project } {
    const agent = this.store.agents.get(agentId);
    if (!agent) throw new MissionError('Agente não encontrado', 404);
    if (!agent.enabled) throw new MissionError('Agente desativado', 409);
    const project = this.store.projects.get(projectId);
    if (!project) throw new MissionError('Projeto não encontrado', 404);
    if (!project.authorized) {
      throw new MissionError(
        'Projeto não autorizado para execução. Autorize-o na tela de Projetos.',
        403,
      );
    }
    return { agent, project };
  }

  create(input: MissionCreate, actor: string): Mission {
    const data = MissionCreateSchema.parse(input);
    this.requireAgentAndProject(data.agentId, data.projectId);
    const now = nowIso();
    const mission: Mission = {
      id: newId('m'),
      kind: 'task',
      title: data.title,
      objective: data.objective,
      projectId: data.projectId,
      agentId: data.agentId,
      status: data.start ? 'queued' : 'backlog',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0,
      },
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
      demo: this.opts.demo,
    };
    this.store.missions.put(mission);
    this.audit.record({
      actor,
      action: 'mission.create',
      target: mission.id,
      detail: { agentId: mission.agentId, projectId: mission.projectId },
    });
    this.publishMission(mission);
    this.event(mission, { kind: 'status', status: mission.status });
    if (mission.status === 'queued') this.enqueue(mission.id);
    return mission;
  }

  start(missionId: string, actor: string): Mission {
    const m = this.mustGet(missionId);
    if (m.status !== 'backlog')
      throw new MissionError('Somente missões do backlog podem ser iniciadas', 409);
    this.requireAgentAndProject(m.agentId, m.projectId);
    this.audit.record({ actor, action: 'mission.start', target: m.id });
    this.updateStatus(m, 'queued');
    this.enqueue(m.id);
    return m;
  }

  /** Re-run a failed/cancelled mission, resuming its Claude session when one exists. */
  retry(missionId: string, actor: string): Mission {
    const m = this.mustGet(missionId);
    if (!['failed', 'cancelled'].includes(m.status)) {
      throw new MissionError('Só é possível repetir missões com falha ou canceladas', 409);
    }
    this.requireAgentAndProject(m.agentId, m.projectId);
    this.audit.record({ actor, action: 'mission.retry', target: m.id });
    m.error = undefined;
    this.updateStatus(m, 'queued', 'Repetindo missão');
    this.enqueue(m.id);
    return m;
  }

  cancel(missionId: string, actor: string): Mission {
    const m = this.mustGet(missionId);
    if (['done', 'failed', 'cancelled'].includes(m.status)) return m;
    this.audit.record({ actor, action: 'mission.cancel', target: m.id });
    this.queue = this.queue.filter((id) => id !== missionId);
    const ctl = this.running.get(missionId);
    if (ctl) {
      ctl.abort();
      // runMission finishes the bookkeeping when the executor returns.
    } else {
      this.updateStatus(m, 'cancelled');
    }
    for (const a of this.store.approvals.filter(
      (x) => x.missionId === missionId && x.status === 'pending',
    )) {
      this.settleApproval(a.id, 'denied', actor);
    }
    return m;
  }

  get(missionId: string): Mission | undefined {
    return this.store.missions.get(missionId);
  }

  private mustGet(missionId: string): Mission {
    const m = this.store.missions.get(missionId);
    if (!m) throw new MissionError('Missão não encontrada', 404);
    return m;
  }

  private enqueue(missionId: string): void {
    if (!this.queue.includes(missionId)) this.queue.push(missionId);
    setImmediate(() => this.pump());
  }

  private pump(): void {
    while (this.running.size < this.opts.maxConcurrent && this.queue.length > 0) {
      const id = this.queue.shift()!;
      const m = this.store.missions.get(id);
      if (!m || m.status !== 'queued') continue;
      // One mission at a time per agent: a character can't sit at two desks.
      if (
        [...this.running.keys()].some((rid) => this.store.missions.get(rid)?.agentId === m.agentId)
      ) {
        this.queue.push(id);
        if (this.queue.every((qid) => this.isAgentBusy(qid))) break;
        continue;
      }
      const ctl = new AbortController();
      this.running.set(id, ctl);
      void this.runMission(m, ctl).finally(() => {
        this.running.delete(id);
        this.pump();
      });
    }
  }

  private isAgentBusy(missionId: string): boolean {
    const agentId = this.store.missions.get(missionId)?.agentId;
    return [...this.running.keys()].some(
      (rid) => this.store.missions.get(rid)?.agentId === agentId,
    );
  }

  /**
   * After a restart, missions that were mid-flight are re-queued (resuming the
   * Claude session when it was captured); approvals that were pending are
   * expired, since nobody can answer a promise from a previous process.
   */
  recover(): void {
    for (const a of this.store.approvals.filter((x) => x.status === 'pending')) {
      a.status = 'expired';
      a.resolvedAt = nowIso();
      this.store.approvals.put(a);
    }
    const stranded = this.store.missions
      .filter((m) => ACTIVE_STATUSES.has(m.status) || m.status === 'queued')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const m of stranded) {
      if (m.status !== 'queued') {
        this.event(m, {
          kind: 'log',
          level: 'warn',
          message: 'Backend reiniciado: missão retomada automaticamente.',
        });
        m.status = 'queued';
        m.updatedAt = nowIso();
        this.store.missions.put(m);
      }
      this.queue.push(m.id);
    }
    setImmediate(() => this.pump());
  }

  private async runMission(mission: Mission, ctl: AbortController): Promise<void> {
    const agent = this.store.agents.get(mission.agentId);
    const project = this.store.projects.get(mission.projectId);
    if (!agent || !project) {
      mission.error = 'Agente ou projeto removido';
      this.updateStatus(mission, 'failed', mission.error);
      return;
    }
    mission.startedAt ??= nowIso();
    this.updateStatus(mission, 'running');
    this.setRuntime(agent.id, 'planning', 'Preparando workspace', mission);

    let ws: Workspace;
    try {
      if (mission.kind === 'chat') {
        ws = await this.workspaces.prepareChat(project, agent.id);
      } else if (mission.sessionId && mission.branch) {
        const existing = this.workspaces.existing(
          project.id,
          mission.id,
          mission.baseCommit,
          mission.branch,
        );
        ws =
          existing.hasRepo || !project.repo
            ? existing
            : await this.workspaces.prepareMission(project, mission.id);
      } else {
        ws = await this.workspaces.prepareMission(project, mission.id);
      }
    } catch (err) {
      const msg = `Falha ao preparar o workspace: ${(err as Error).message}`;
      mission.error = msg;
      this.event(mission, { kind: 'log', level: 'error', message: msg });
      this.updateStatus(mission, 'failed', msg);
      this.setRuntime(agent.id, 'failed', msg, mission);
      return;
    }
    mission.branch = ws.branch ?? mission.branch;
    mission.baseCommit = ws.baseCommit ?? mission.baseCommit;
    this.store.missions.put(mission);
    this.event(mission, {
      kind: 'log',
      level: 'info',
      message: ws.hasRepo
        ? `Workspace isolado pronto (branch ${ws.branch ?? 'chat'}, base ${ws.baseCommit?.slice(0, 7)})`
        : 'Projeto sem repositório: workspace vazio isolado.',
    });

    const projectContext = readClaudeMd(ws.path);
    const timeout = setTimeout(() => {
      this.event(mission, {
        kind: 'log',
        level: 'error',
        message: 'Tempo máximo da missão atingido.',
      });
      ctl.abort();
    }, this.opts.missionTimeoutMs);

    let result: ExecutorResult;
    try {
      result = await this.executor.run({
        mission,
        agent,
        project,
        workspace: ws.path,
        prompt: mission.objective,
        resumeSessionId: mission.sessionId,
        projectContext,
        signal: ctl.signal,
        emit: (ev) => this.onExecutorEvent(mission, agent, ev),
        onSessionId: (sid) => {
          mission.sessionId = sid;
          this.store.missions.put(mission);
          if (mission.kind === 'chat') this.store.setKv(chatSessionKey(agent.id, project.id), sid);
        },
        evaluate: (toolName, toolInput) =>
          evaluateToolCall(toolName, toolInput, { workspace: ws.path, autonomy: agent.autonomy }),
        requestApproval: (req) => this.requestApproval(mission, agent, req, ctl.signal),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (result.sessionId) mission.sessionId = result.sessionId;
    mission.model = result.model ?? mission.model;
    mission.numTurns = result.numTurns;
    mission.usage = {
      inputTokens: mission.usage.inputTokens + result.usage.inputTokens,
      outputTokens: mission.usage.outputTokens + result.usage.outputTokens,
      cacheReadTokens: mission.usage.cacheReadTokens + result.usage.cacheReadTokens,
      cacheCreationTokens: mission.usage.cacheCreationTokens + result.usage.cacheCreationTokens,
      costUsd: mission.usage.costUsd + result.usage.costUsd,
    };
    if (!mission.demo) this.usage.recordMission(mission, result);
    this.event(mission, { kind: 'usage', usage: result.usage, model: result.model });

    if (mission.kind === 'task') {
      const diff = await this.workspaces.diff(ws).catch(() => ({ stat: '', patch: '' }));
      mission.diffStat = diff.stat || undefined;
      if (diff.patch) {
        fs.mkdirSync(path.join(this.store.dataDir, 'diffs'), { recursive: true });
        fs.writeFileSync(
          path.join(this.store.dataDir, 'diffs', `${mission.id}.patch`),
          diff.patch,
          { mode: 0o600 },
        );
      }
    }

    mission.result = result.resultText;
    mission.finishedAt = nowIso();
    this.event(mission, {
      kind: 'result',
      text: result.resultText,
      isError: result.outcome !== 'success',
    });
    this.finishChat(mission, result);

    if (result.outcome === 'success') {
      this.updateStatus(mission, 'done');
      this.setRuntime(agent.id, 'done', 'Missão concluída', mission);
    } else if (result.outcome === 'cancelled') {
      this.updateStatus(mission, 'cancelled');
      this.setRuntime(agent.id, 'idle', '', mission);
    } else {
      mission.error = result.resultText.slice(0, 5000);
      this.updateStatus(mission, 'failed', mission.error);
      this.setRuntime(agent.id, 'failed', 'Missão falhou', mission);
    }
  }

  private onExecutorEvent(mission: Mission, agent: AgentProfile, ev: MissionEventBody): void {
    if (ev.kind === 'text' && ev.partial) {
      // Streaming deltas are broadcast, not persisted (the final text is).
      this.bus.publish({
        type: 'missionEvent',
        event: {
          ...ev,
          seq: 0,
          missionId: mission.id,
          agentId: agent.id,
          ts: nowIso(),
          demo: mission.demo,
        },
      });
      if (mission.kind === 'chat') this.appendChatDelta(mission, ev.text);
      return;
    }
    this.event(mission, ev);
    if (ev.kind === 'tool_start') {
      const activity = activityForTool(ev.toolName, ev.input);
      this.setRuntime(agent.id, activity, ev.statusText, mission, ev.toolName);
      if (activity === 'testing' && mission.status === 'running')
        this.updateStatus(mission, 'testing');
    } else if (ev.kind === 'tool_end') {
      if (mission.status === 'testing') this.updateStatus(mission, 'running');
      this.setRuntime(agent.id, 'planning', 'Analisando o resultado', mission);
    } else if (ev.kind === 'text' && !ev.partial && mission.kind === 'chat') {
      this.appendChatDelta(mission, '', ev.text);
    }
  }

  // ── Approvals ────────────────────────────────────────────────────────────

  private requestApproval(
    mission: Mission,
    agent: AgentProfile,
    req: ApprovalRequest,
    signal: AbortSignal,
  ): Promise<'approved' | 'denied'> {
    const approval: Approval = {
      id: newId('ap'),
      missionId: mission.id,
      agentId: agent.id,
      projectId: mission.projectId,
      toolName: req.toolName,
      input: redactInput(req.input),
      summary: req.summary,
      reason: req.reason,
      risk: req.risk,
      status: 'pending',
      createdAt: nowIso(),
    };
    this.store.approvals.put(approval);
    this.bus.publish({ type: 'approval', approval });
    this.event(mission, {
      kind: 'approval_requested',
      approvalId: approval.id,
      toolName: req.toolName,
      summary: req.summary,
    });
    const previous = this.runtimeOf(agent.id);
    this.updateStatus(mission, 'awaiting_approval');
    this.setRuntime(
      agent.id,
      'awaiting_approval',
      `Aprovação: ${req.summary}`,
      mission,
      req.toolName,
    );

    return new Promise((resolve) => {
      const timer = setTimeout(
        () => this.settleApproval(approval.id, 'expired', 'system'),
        this.opts.approvalTimeoutMs,
      );
      const done = (answer: 'approved' | 'denied') => {
        if (mission.status === 'awaiting_approval') this.updateStatus(mission, 'running');
        this.setRuntime(
          agent.id,
          previous.activity === 'awaiting_approval' ? 'planning' : previous.activity,
          previous.statusText,
          mission,
          previous.toolName,
        );
        resolve(answer);
      };
      this.approvals.set(approval.id, { resolve: done, timer });
      signal.addEventListener('abort', () => this.settleApproval(approval.id, 'denied', 'system'), {
        once: true,
      });
    });
  }

  resolveApproval(approvalId: string, decision: 'approve' | 'deny', actor: string): Approval {
    const a = this.store.approvals.get(approvalId);
    if (!a) throw new MissionError('Aprovação não encontrada', 404);
    if (a.status !== 'pending') throw new MissionError('Aprovação já resolvida', 409);
    this.settleApproval(approvalId, decision === 'approve' ? 'approved' : 'denied', actor);
    return this.store.approvals.get(approvalId)!;
  }

  private settleApproval(
    approvalId: string,
    status: 'approved' | 'denied' | 'expired',
    actor: string,
  ): void {
    const a = this.store.approvals.get(approvalId);
    if (!a || a.status !== 'pending') return;
    a.status = status;
    a.resolvedAt = nowIso();
    a.resolvedBy = actor;
    this.store.approvals.put(a);
    this.audit.record({
      actor,
      action: `approval.${status}`,
      target: a.id,
      detail: { toolName: a.toolName, missionId: a.missionId },
    });
    this.bus.publish({ type: 'approval', approval: a });
    const mission = this.store.missions.get(a.missionId);
    if (mission)
      this.event(mission, { kind: 'approval_resolved', approvalId: a.id, decision: status });
    const pending = this.approvals.get(approvalId);
    if (pending) {
      clearTimeout(pending.timer);
      this.approvals.delete(approvalId);
      pending.resolve(status === 'approved' ? 'approved' : 'denied');
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  sendChat(
    agentId: string,
    input: { text: string; projectId?: string; newSession?: boolean },
    actor: string,
  ): { user: ChatMessage; reply: ChatMessage; mission: Mission } {
    const agentForDefault = this.store.agents.get(agentId);
    const projectId = input.projectId ?? agentForDefault?.projectId;
    if (!projectId) throw new MissionError('Selecione um projeto para conversar com o agente', 400);
    const { agent, project } = this.requireAgentAndProject(agentId, projectId);
    const busy = this.store.missions.filter(
      (m) =>
        m.agentId === agentId &&
        m.kind === 'chat' &&
        (ACTIVE_STATUSES.has(m.status) || m.status === 'queued'),
    );
    if (busy.length > 0)
      throw new MissionError(`${agent.name} ainda está respondendo. Aguarde ou cancele.`, 409);

    const resume = input.newSession
      ? undefined
      : this.store.getKv<string | undefined>(chatSessionKey(agentId, projectId), undefined);
    const now = nowIso();
    const mission: Mission = {
      id: newId('c'),
      kind: 'chat',
      title: input.text.slice(0, 80),
      objective: input.text,
      projectId: project.id,
      agentId,
      status: 'queued',
      sessionId: resume,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0,
      },
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
      demo: this.opts.demo,
    };
    this.store.missions.put(mission);
    const user: ChatMessage = {
      id: newId('msg'),
      agentId,
      missionId: mission.id,
      projectId: project.id,
      role: 'user',
      text: input.text,
      streaming: false,
      ts: now,
      demo: false,
    };
    const reply: ChatMessage = {
      id: newId('msg'),
      agentId,
      missionId: mission.id,
      projectId: project.id,
      role: 'agent',
      text: '',
      streaming: true,
      ts: nowIso(),
      demo: this.opts.demo,
    };
    this.store.chat.put(user);
    this.store.chat.put(reply);
    this.chatBuffers.set(mission.id, { message: reply, timer: null, committed: '', pending: '' });
    this.audit.record({
      actor,
      action: 'chat.send',
      target: agentId,
      detail: { missionId: mission.id, projectId: project.id },
    });
    this.bus.publish({ type: 'chat', message: user });
    this.bus.publish({ type: 'chat', message: reply });
    this.publishMission(mission);
    this.enqueue(mission.id);
    return { user, reply, mission };
  }

  chatHistory(agentId: string, limit = 200): ChatMessage[] {
    return this.store.chat
      .filter((c) => c.agentId === agentId)
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .slice(-limit);
  }

  private appendChatDelta(mission: Mission, delta: string, finalText?: string): void {
    const buf = this.chatBuffers.get(mission.id);
    if (!buf) return;
    if (finalText !== undefined) {
      // A complete assistant text block supersedes the deltas streamed for it.
      buf.committed = buf.committed ? `${buf.committed}\n\n${finalText}` : finalText;
      buf.pending = '';
    } else {
      buf.pending += delta;
    }
    buf.message.text =
      buf.committed && buf.pending
        ? `${buf.committed}\n\n${buf.pending}`
        : buf.committed || buf.pending;
    if (!buf.timer) {
      buf.timer = setTimeout(() => {
        buf.timer = null;
        this.store.chat.put(buf.message);
        this.bus.publish({ type: 'chat', message: { ...buf.message } });
      }, CHAT_STREAM_FLUSH_MS);
    }
  }

  private finishChat(mission: Mission, result: ExecutorResult): void {
    if (mission.kind !== 'chat') return;
    const buf = this.chatBuffers.get(mission.id);
    const reply =
      buf?.message ??
      this.store.chat.filter((c) => c.missionId === mission.id && c.role === 'agent')[0];
    if (!reply) return;
    if (buf?.timer) clearTimeout(buf.timer);
    this.chatBuffers.delete(mission.id);
    if (result.outcome === 'success') {
      reply.text = buf?.committed || result.resultText || reply.text;
    } else if (result.outcome === 'cancelled') {
      reply.text = (reply.text ? reply.text + '\n\n' : '') + '_(cancelado)_';
    } else {
      reply.text = (reply.text ? reply.text + '\n\n' : '') + `⚠️ ${result.resultText}`;
    }
    reply.streaming = false;
    this.store.chat.put(reply);
    this.bus.publish({ type: 'chat', message: reply });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private updateStatus(mission: Mission, status: MissionStatus, note?: string): void {
    if (mission.status === status) return;
    mission.status = status;
    mission.updatedAt = nowIso();
    this.store.missions.put(mission);
    this.event(mission, { kind: 'status', status, note });
    this.publishMission(mission);
  }

  private publishMission(mission: Mission): void {
    this.bus.publish({ type: 'mission', mission: { ...mission } });
  }

  private event(mission: Mission, body: MissionEventBody): void {
    const event = this.store.appendEvent({
      ...body,
      missionId: mission.id,
      agentId: mission.agentId,
      ts: nowIso(),
      demo: mission.demo,
    });
    this.bus.publish({ type: 'missionEvent', event });
  }

  /** Stop everything (process shutdown). */
  shutdown(): void {
    for (const ctl of this.running.values()) ctl.abort();
    for (const t of this.lingerTimers.values()) clearTimeout(t);
    for (const p of this.approvals.values()) clearTimeout(p.timer);
  }

  stats(): { running: number; queued: number } {
    return { running: this.running.size, queued: this.queue.length };
  }
}

function chatSessionKey(agentId: string, projectId: string): string {
  return `chatSession:${agentId}:${projectId}`;
}

function readClaudeMd(dir: string): string | undefined {
  for (const name of ['CLAUDE.md', '.claude/CLAUDE.md']) {
    try {
      return fs.readFileSync(path.join(dir, name), 'utf8');
    } catch {
      // absent
    }
  }
  return undefined;
}
