import type { ClientMessage, ServerMessage } from '../../../core/src/messages.js';
import { isWorking, OFFICE_READING_TOOLS, officeToolForActivity } from './activity';
import { DEPARTMENTS, getDepartment } from './departments';
import type { AgentActivityState, AgentProfile, AgentRuntimeState } from './schemas';

/** Folder key an agent is filed under; mapped to its department Area. */
export function departmentFolder(departmentId: string): string {
  return `dept:${departmentId}`;
}

interface SentState {
  activity: AgentActivityState;
  statusText: string;
  toolSeq: number;
  liveToolId: string | null;
  department: string;
  name: string;
}

export interface OfficeAgentInput {
  agent: AgentProfile;
  runtime?: AgentRuntimeState;
}

/**
 * Translates agency state (agents + their live, event-derived activity) into
 * the Pixel Agents office protocol (`ServerMessage`), emitting only the diff
 * since the last call. Pure state machine — no I/O — so the same instance can
 * live in the app (driving the WebView) or in tests.
 *
 * Invariant: an operational animation is only ever emitted from a
 * `AgentRuntimeState` (which the backend derives from real execution events,
 * or which carries `demo: true` in DEMO mode). Idle wandering is the office's
 * own decorative AI and never implies work.
 */
export class OfficeSync {
  private ids = new Map<string, number>();
  private nextId = 1;
  private sent = new Map<number, SentState>();
  private initialized = false;
  /** Seats saved by the office (`saveAgentSeats`), keyed by agent string id. */
  private seats = new Map<string, string>();

  numericId(agentId: string): number {
    let id = this.ids.get(agentId);
    if (id === undefined) {
      id = this.nextId++;
      this.ids.set(agentId, id);
    }
    return id;
  }

  agentIdFor(numericId: number): string | undefined {
    for (const [k, v] of this.ids) if (v === numericId) return k;
    return undefined;
  }

  /** Restore seat assignments the office reported earlier. */
  setSeats(seats: Record<string, string>): void {
    this.seats = new Map(Object.entries(seats));
  }

  /** Forget everything sent, e.g. after the WebView reloads. */
  reset(): void {
    this.sent.clear();
    this.initialized = false;
  }

  /**
   * Messages that bring the office in line with `agents`. The first call
   * (and the first after `reset`) sends a full snapshot.
   */
  sync(agents: OfficeAgentInput[]): ServerMessage[] {
    const out: ServerMessage[] = [];
    const visible = agents.filter((a) => a.agent.enabled);

    if (!this.initialized) {
      this.initialized = true;
      out.push({
        type: 'providerCapabilities',
        readingTools: OFFICE_READING_TOOLS,
        subagentToolNames: [],
      });
      out.push({ type: 'areaMappingsLoaded', mappings: departmentAreaMappings() });
      const ids: number[] = [];
      const agentMeta: Record<string, { palette?: number; hueShift?: number; seatId?: string }> =
        {};
      const folderNames: Record<string, string> = {};
      for (const { agent } of visible) {
        const id = this.numericId(agent.id);
        ids.push(id);
        agentMeta[id] = {
          palette: agent.palette,
          hueShift: agent.hueShift,
          seatId: this.seats.get(agent.id),
        };
        folderNames[id] = departmentFolder(agent.department);
      }
      out.push({ type: 'existingAgents', agents: ids, agentMeta, folderNames, externalAgents: {} });
      for (const { agent } of visible) {
        const id = this.numericId(agent.id);
        out.push({ type: 'agentTeamInfo', id, agentName: agent.name });
        this.sent.set(id, {
          activity: 'idle',
          statusText: '',
          toolSeq: 0,
          liveToolId: null,
          department: agent.department,
          name: agent.name,
        });
      }
    }

    // Additions, renames and department moves.
    const visibleIds = new Set<number>();
    for (const { agent } of visible) {
      const id = this.numericId(agent.id);
      visibleIds.add(id);
      const prev = this.sent.get(id);
      if (!prev || prev.department !== agent.department) {
        if (prev) out.push({ type: 'agentClosed', id });
        out.push({
          type: 'agentCreated',
          id,
          folderName: departmentFolder(agent.department),
          palette: agent.palette,
          hueShift: agent.hueShift,
        });
        out.push({ type: 'agentTeamInfo', id, agentName: agent.name });
        this.sent.set(id, {
          activity: 'idle',
          statusText: '',
          toolSeq: prev?.toolSeq ?? 0,
          liveToolId: null,
          department: agent.department,
          name: agent.name,
        });
      } else if (prev.name !== agent.name) {
        out.push({ type: 'agentTeamInfo', id, agentName: agent.name });
        prev.name = agent.name;
      }
    }

    // Removals (disabled or deleted agents).
    for (const id of [...this.sent.keys()]) {
      if (!visibleIds.has(id)) {
        out.push({ type: 'agentClosed', id });
        this.sent.delete(id);
      }
    }

    // Activity diffs.
    for (const { agent, runtime } of visible) {
      const id = this.numericId(agent.id);
      const prev = this.sent.get(id)!;
      const activity = runtime?.activity ?? 'idle';
      const statusText = runtime?.statusText ?? '';
      if (activity === prev.activity && statusText === prev.statusText) continue;
      out.push(...this.transition(id, prev, activity, statusText));
    }
    return out;
  }

  private transition(
    id: number,
    st: SentState,
    activity: AgentActivityState,
    statusText: string,
  ): ServerMessage[] {
    const out: ServerMessage[] = [];
    const wasWorking = isWorking(st.activity);
    if (st.liveToolId) {
      out.push({ type: 'agentToolDone', id, toolId: st.liveToolId });
      st.liveToolId = null;
    }
    if (st.activity === 'awaiting_approval' && activity !== 'awaiting_approval') {
      out.push({ type: 'agentToolPermissionClear', id });
    }
    if (isWorking(activity)) {
      st.toolSeq += 1;
      const toolId = `agency-${id}-${st.toolSeq}`;
      st.liveToolId = toolId;
      const toolName = officeToolForActivity(activity) ?? undefined;
      out.push({
        type: 'agentToolStart',
        id,
        toolId,
        status: statusText || activity,
        toolName,
        permissionActive: activity === 'awaiting_approval',
      });
      out.push({ type: 'agentStatus', id, status: 'active' });
      if (activity === 'awaiting_approval') out.push({ type: 'agentToolPermission', id });
    } else {
      out.push({ type: 'agentToolsClear', id });
      if (wasWorking || activity === 'done' || activity === 'failed') {
        // The office's "turn finished" cue: character stops typing, checkmark.
        out.push({ type: 'agentStatus', id, status: 'waiting' });
      }
    }
    st.activity = activity;
    st.statusText = statusText;
    return out;
  }
}

/** `areaMappingsLoaded` payload: each department folder → its Area. */
export function departmentAreaMappings(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of DEPARTMENTS) out[departmentFolder(d.id)] = [d.areaLabel];
  return out;
}

/** What the host must do in response to a message from the office. */
export type OfficeIntent =
  | { kind: 'ready' }
  | { kind: 'selectAgent'; numericId: number }
  | { kind: 'saveLayout'; layout: Record<string, unknown> }
  | { kind: 'saveSeats'; seats: Record<number, string> }
  | { kind: 'ignore' };

export function interpretOfficeMessage(msg: ClientMessage): OfficeIntent {
  switch (msg.type) {
    case 'webviewReady':
      return { kind: 'ready' };
    case 'focusAgent':
      return { kind: 'selectAgent', numericId: msg.id };
    case 'saveLayout':
      return { kind: 'saveLayout', layout: msg.layout };
    case 'saveAgentSeats': {
      const seats: Record<number, string> = {};
      for (const [k, v] of Object.entries(msg.seats ?? {})) {
        const seatId = (v as { seatId?: string } | undefined)?.seatId;
        if (seatId) seats[Number(k)] = seatId;
      }
      return { kind: 'saveSeats', seats };
    }
    default:
      return { kind: 'ignore' };
  }
}

/** Department label for UI, tolerant of unknown ids. */
export function departmentName(id: string): string {
  return getDepartment(id)?.name ?? id;
}
