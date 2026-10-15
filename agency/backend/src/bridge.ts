import type { DesktopCommand } from '@pixel-agency/shared';

import type { ServerMessage } from '../../../core/src/messages.js';
import type { EventBus } from './events.js';
import { nowIso } from './util/ids.js';

/** Office messages worth relaying from a desktop Pixel Agents (no assets/layout). */
const RELAYED = new Set<ServerMessage['type']>([
  'agentCreated',
  'agentClosed',
  'existingAgents',
  'agentStatus',
  'agentToolStart',
  'agentToolDone',
  'agentToolsClear',
  'agentToolPermission',
  'agentToolPermissionClear',
  'agentTeamInfo',
]);

const STALE_MS = 90_000;
const MAX_COMMANDS = 100;

interface DesktopAgent {
  created: ServerMessage;
  team?: ServerMessage;
  tool?: ServerMessage;
  status?: ServerMessage;
  permission?: boolean;
}

/**
 * Desktop Bridge hub. The bridge (agency/desktop-bridge) runs on the user's
 * computer, subscribes to the local Pixel Agents `/ws`, and POSTs office
 * messages here; the app shows those desktop agents in the office too. The
 * app can queue a few commands (focus/close/launch) that the bridge pulls.
 */
export class DesktopBridgeHub {
  private agents = new Map<number, DesktopAgent>();
  private commands: Array<DesktopCommand & { id: number }> = [];
  private nextCommandId = 1;
  private lastSeenAt: number | null = null;

  constructor(private readonly bus: EventBus) {}

  status(): { connected: boolean; lastSeenAt?: string } {
    const connected = this.lastSeenAt !== null && Date.now() - this.lastSeenAt < STALE_MS;
    return {
      connected,
      lastSeenAt: this.lastSeenAt ? new Date(this.lastSeenAt).toISOString() : undefined,
    };
  }

  heartbeat(): void {
    const was = this.status().connected;
    this.lastSeenAt = Date.now();
    if (!was) this.bus.publish({ type: 'desktopStatus', ...this.status() });
  }

  ingest(messages: unknown[]): number {
    this.heartbeat();
    const accepted: ServerMessage[] = [];
    for (const raw of messages.slice(0, 500)) {
      if (!raw || typeof raw !== 'object') continue;
      const msg = raw as ServerMessage;
      if (!RELAYED.has(msg.type)) continue;
      this.track(msg);
      accepted.push(msg);
    }
    if (accepted.length > 0)
      this.bus.publish({ type: 'desktop', messages: accepted, receivedAt: nowIso() });
    return accepted.length;
  }

  private track(msg: ServerMessage): void {
    switch (msg.type) {
      case 'existingAgents':
        for (const id of msg.agents) {
          if (!this.agents.has(id)) {
            this.agents.set(id, {
              created: {
                type: 'agentCreated',
                id,
                folderName: msg.folderNames?.[id],
                palette: msg.agentMeta?.[id]?.palette,
                hueShift: msg.agentMeta?.[id]?.hueShift,
              },
            });
          }
        }
        break;
      case 'agentCreated':
        this.agents.set(msg.id, { created: msg });
        break;
      case 'agentClosed':
        this.agents.delete(msg.id);
        break;
      case 'agentTeamInfo': {
        const a = this.agents.get(msg.id);
        if (a) a.team = msg;
        break;
      }
      case 'agentToolStart': {
        const a = this.agents.get(msg.id);
        if (a) a.tool = msg;
        break;
      }
      case 'agentToolDone':
      case 'agentToolsClear': {
        const a = this.agents.get(msg.id);
        if (a) a.tool = undefined;
        break;
      }
      case 'agentStatus': {
        const a = this.agents.get(msg.id);
        if (a) a.status = msg;
        break;
      }
      case 'agentToolPermission':
      case 'agentToolPermissionClear': {
        const a = this.agents.get(msg.id);
        if (a) a.permission = msg.type === 'agentToolPermission';
        break;
      }
      default:
        break;
    }
  }

  /** Messages that rebuild the desktop agents for a client that just connected. */
  replay(): ServerMessage[] {
    const out: ServerMessage[] = [];
    for (const [id, a] of this.agents) {
      out.push(a.created);
      if (a.team) out.push(a.team);
      if (a.tool) out.push(a.tool);
      if (a.status) out.push(a.status);
      if (a.permission) out.push({ type: 'agentToolPermission', id });
    }
    return out;
  }

  queueCommand(cmd: DesktopCommand): number {
    const id = this.nextCommandId++;
    this.commands.push({ ...cmd, id });
    if (this.commands.length > MAX_COMMANDS) this.commands.shift();
    return id;
  }

  /** Commands after `afterId` (the bridge acknowledges by advancing the cursor). */
  pullCommands(afterId: number): Array<DesktopCommand & { id: number }> {
    this.heartbeat();
    return this.commands.filter((c) => c.id > afterId);
  }
}
