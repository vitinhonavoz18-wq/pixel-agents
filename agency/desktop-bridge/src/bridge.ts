import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import WebSocket from 'ws';

import type { ClientMessage, ServerMessage } from '../../../core/src/messages.js';

export interface LocalServerInfo {
  port: number;
  pid?: number;
  authToken?: string;
}

/** Discovery file written by Pixel Agents (VS Code or `npx pixel-agents`). */
export function readLocalServer(home = os.homedir()): LocalServerInfo | null {
  try {
    const j = JSON.parse(
      fs.readFileSync(path.join(home, '.pixel-agents', 'server.json'), 'utf8'),
    ) as LocalServerInfo;
    return typeof j.port === 'number' ? j : null;
  } catch {
    return null;
  }
}

const RELAYED = new Set([
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

export interface BridgeOptions {
  agencyUrl: string;
  bridgeToken: string;
  home?: string;
  flushMs?: number;
  pollMs?: number;
  fetchFn?: typeof fetch;
  log?: (msg: string) => void;
}

/**
 * Relays a local Pixel Agents office to the PIXEL AGENCY backend:
 *  local /ws  ──ServerMessages──▶  POST /api/bridge/events
 *  GET /api/bridge/commands  ──ClientMessages──▶  local /ws
 * Only lifecycle/activity messages are forwarded (never layout or assets),
 * and only outbound HTTPS to the configured backend is used.
 */
export class DesktopBridge {
  private ws: WebSocket | null = null;
  private outbox: ServerMessage[] = [];
  private cursor = 0;
  private timers: NodeJS.Timeout[] = [];
  private retry = 0;
  private stopped = false;
  private readonly fetchFn: typeof fetch;
  private readonly log: (msg: string) => void;

  constructor(private readonly opts: BridgeOptions) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.log = opts.log ?? ((m) => console.log(`[bridge] ${m}`));
  }

  private api(pathname: string, init?: RequestInit) {
    return this.fetchFn(new URL(pathname, this.opts.agencyUrl), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.opts.bridgeToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  }

  /** Accept one message from the local office; returns whether it was queued. */
  accept(msg: ServerMessage): boolean {
    if (!msg || !RELAYED.has(msg.type)) return false;
    this.outbox.push(msg);
    return true;
  }

  async flush(): Promise<number> {
    if (this.outbox.length === 0) return 0;
    const batch = this.outbox.splice(0, 500);
    try {
      const res = await this.api('/api/bridge/events', {
        method: 'POST',
        body: JSON.stringify({ messages: batch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return batch.length;
    } catch (err) {
      this.outbox.unshift(...batch); // retry next tick
      this.log(`envio falhou: ${(err as Error).message}`);
      return 0;
    }
  }

  async pollCommands(): Promise<ClientMessage[]> {
    try {
      const res = await this.api(`/api/bridge/commands?after=${this.cursor}`);
      if (!res.ok) return [];
      const cmds = (await res.json()) as Array<ClientMessage & { id: number }>;
      const out: ClientMessage[] = [];
      for (const { id, ...cmd } of cmds) {
        this.cursor = Math.max(this.cursor, id);
        out.push(cmd as ClientMessage);
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(cmd));
      }
      return out;
    } catch {
      return [];
    }
  }

  start(): void {
    this.connect();
    this.timers.push(setInterval(() => void this.flush(), this.opts.flushMs ?? 500));
    this.timers.push(setInterval(() => void this.pollCommands(), this.opts.pollMs ?? 3000));
  }

  private connect(): void {
    if (this.stopped) return;
    const info = readLocalServer(this.opts.home);
    if (!info) {
      this.log(
        'Pixel Agents local não encontrado (~/.pixel-agents/server.json). Tentando novamente…',
      );
      this.scheduleReconnect();
      return;
    }
    const url = `ws://127.0.0.1:${info.port}/ws${info.authToken ? `?token=${encodeURIComponent(info.authToken)}` : ''}`;
    const ws = new WebSocket(url, {
      headers: info.authToken ? { Authorization: `Bearer ${info.authToken}` } : {},
    });
    this.ws = ws;
    ws.on('open', () => {
      this.retry = 0;
      this.log(`conectado ao Pixel Agents local na porta ${info.port}`);
      ws.send(JSON.stringify({ type: 'webviewReady' }));
    });
    ws.on('message', (raw) => {
      try {
        this.accept(JSON.parse(raw.toString()) as ServerMessage);
      } catch {
        // ignore non-JSON frames
      }
    });
    ws.on('close', () => this.scheduleReconnect());
    ws.on('error', (err) => this.log(`erro no WebSocket local: ${err.message}`));
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.retry++);
    const t = setTimeout(() => this.connect(), delay);
    this.timers.push(t);
  }

  stop(): void {
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    this.ws?.close();
  }
}
