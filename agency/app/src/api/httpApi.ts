import { type AgencyServerEvent, WS_CLOSE_UNAUTHORIZED } from '@pixel-agency/shared';

import { type AgencyApi, ApiError } from './types';

const BACKOFF = [500, 1000, 2000, 4000, 8000, 15000];

/** The real backend: REST for actions, one WebSocket for live events. */
export function createHttpApi(baseUrl: string, token: string): AgencyApi {
  const root = baseUrl.replace(/\/+$/, '');

  async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ApiError(`Sem conexão com o backend (${(err as Error).message})`, 0);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const d = data as { error?: string; issues?: string[] } | undefined;
      const msg = [d?.error ?? `HTTP ${res.status}`, ...(d?.issues ?? [])].join(' — ');
      throw new ApiError(msg, res.status);
    }
    return data as T;
  }

  const enc = encodeURIComponent;

  return {
    mode: 'cloud',
    baseUrl: root,
    connect(onEvent, onState) {
      let ws: WebSocket | null = null;
      let attempt = 0;
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let pinger: ReturnType<typeof setInterval> | null = null;
      const open = () => {
        if (closed) return;
        onState('connecting');
        const url = `${root.replace(/^http/, 'ws')}/api/ws?token=${enc(token)}`;
        ws = new WebSocket(url);
        ws.onopen = () => {
          attempt = 0;
          onState('online');
          pinger = setInterval(
            () => ws?.readyState === 1 && ws.send(JSON.stringify({ type: 'ping' })),
            20000,
          );
        };
        ws.onmessage = (ev) => {
          try {
            onEvent(JSON.parse(String(ev.data)) as AgencyServerEvent);
          } catch {
            // ignore malformed frames
          }
        };
        ws.onclose = (ev) => {
          if (pinger) clearInterval(pinger);
          if (closed) return;
          if (ev.code === WS_CLOSE_UNAUTHORIZED) {
            onState('unauthorized');
            return;
          }
          onState('offline');
          const delay = BACKOFF[Math.min(attempt++, BACKOFF.length - 1)];
          timer = setTimeout(open, delay);
        };
        ws.onerror = () => {
          // onclose follows and schedules the reconnect
        };
      };
      open();
      return () => {
        closed = true;
        if (timer) clearTimeout(timer);
        if (pinger) clearInterval(pinger);
        ws?.close();
      };
    },
    missionEvents: (id, after = 0) => req('GET', `/api/missions/${enc(id)}/events?after=${after}`),
    missionDiff: (id) => req('GET', `/api/missions/${enc(id)}/diff`),
    createMission: (input) => req('POST', '/api/missions', input),
    missionAction: (id, action) => req('POST', `/api/missions/${enc(id)}/${action}`),
    resolveApproval: (id, decision) => req('POST', `/api/approvals/${enc(id)}`, { decision }),
    chatHistory: (agentId) => req('GET', `/api/agents/${enc(agentId)}/chat`),
    sendChat: (agentId, input) => req('POST', `/api/agents/${enc(agentId)}/chat`, input),
    usageSummary: () => req('GET', '/api/usage/summary'),
    alertRules: () => req('GET', '/api/usage/alerts'),
    saveAlertRules: (rules) => req('PUT', '/api/usage/alerts', rules),
    createAgent: (input) => req('POST', '/api/agents', input),
    updateAgent: (id, patch) => req('PATCH', `/api/agents/${enc(id)}`, patch),
    deleteAgent: (id) => req('DELETE', `/api/agents/${enc(id)}`),
    importAgent: (text, department) => req('POST', '/api/agents/import', { text, department }),
    createProject: (input) => req('POST', '/api/projects', input),
    updateProject: (id, patch) => req('PATCH', `/api/projects/${enc(id)}`, patch),
    githubRepos: () => req('GET', '/api/github/repos'),
    refreshBranding: (id) => req('POST', `/api/projects/${enc(id)}/branding/refresh`),
    selectLogo: (id, path) => req('PUT', `/api/projects/${enc(id)}/branding/logo`, { path }),
    previews: (id) => req('GET', `/api/projects/${enc(id)}/previews`),
    uploadPreview: (id, input) => req('POST', `/api/projects/${enc(id)}/previews/upload`, input),
    capturePreview: (id, input) => req('POST', `/api/projects/${enc(id)}/previews/capture`, input),
    desktopCommand: async (cmd) => {
      await req('POST', '/api/bridge/commands', cmd);
    },
    assetUrl: (p) => (!p ? undefined : /^https?:/.test(p) ? p : `${root}${p}`),
  };
}

/** Quick connectivity + auth probe for the Config screen. */
export async function probeBackend(
  baseUrl: string,
  token: string,
): Promise<{ ok: boolean; message: string }> {
  const root = baseUrl.replace(/\/+$/, '');
  try {
    const health = await fetch(`${root}/api/health`);
    if (!health.ok) return { ok: false, message: `Backend respondeu ${health.status}` };
    const caps = await fetch(`${root}/api/capabilities`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (caps.status === 401) return { ok: false, message: 'Token inválido ou revogado' };
    if (!caps.ok) return { ok: false, message: `Capacidades: HTTP ${caps.status}` };
    const c = (await caps.json()) as {
      executor: { kind: string; ready: boolean; reason?: string };
    };
    return {
      ok: true,
      message: c.executor.ready
        ? `Conectado — executor ${c.executor.kind}`
        : `Conectado, mas: ${c.executor.reason ?? 'executor indisponível'}`,
    };
  } catch (err) {
    return { ok: false, message: `Não foi possível conectar: ${(err as Error).message}` };
  }
}
