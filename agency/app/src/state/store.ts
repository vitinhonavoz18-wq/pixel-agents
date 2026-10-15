import type {
  AgencyServerEvent,
  AgentProfile,
  AgentRuntimeState,
  Approval,
  Capabilities,
  ChatMessage,
  Mission,
  MissionEvent,
  Project,
  ProjectBranding,
  ProjectPreview,
  UsageAlert,
} from '@pixel-agency/shared';
import Constants from 'expo-constants';
import { create } from 'zustand';

import type { ServerMessage } from '../../../../core/src/messages';
import { createHttpApi } from '../api/httpApi';
import type { AgencyApi, ConnectionState } from '../api/types';
import { createDemoApi } from '../demo/demoApi';
import { notify } from '../lib/notify';
import { prefs, secureStorage } from '../lib/storage';

export type AppMode = 'cloud' | 'demo' | 'unset';

const K_URL = 'agency.url';
const K_TOKEN = 'agency.token';
const K_MODE = 'agency.mode';
const K_PROJECT = 'agency.project';
const K_SEATS = 'agency.office.seats';
const K_LAYOUT = 'agency.office.layout';
const MAX_EVENTS_PER_MISSION = 800;

type DesktopListener = (messages: ServerMessage[]) => void;

interface AgencyState {
  hydrated: boolean;
  mode: AppMode;
  url: string;
  token: string;
  api: AgencyApi | null;
  connection: ConnectionState | 'idle';
  capabilities: Capabilities | null;

  agents: Record<string, AgentProfile>;
  runtimes: Record<string, AgentRuntimeState>;
  projects: Record<string, Project>;
  missions: Record<string, Mission>;
  approvals: Record<string, Approval>;
  branding: Record<string, ProjectBranding>;
  previews: Record<string, ProjectPreview[]>;
  chat: Record<string, ChatMessage[]>;
  missionEvents: Record<string, MissionEvent[]>;
  /** Live streaming text per mission (not persisted by the backend). */
  streaming: Record<string, string>;
  alerts: UsageAlert[];
  usageVersion: number;
  desktopConnected: boolean;

  selectedProjectId: string | null;
  selectedAgentId: string | null;
  officeSeats: Record<string, string>;
  officeLayout: Record<string, unknown> | null;

  hydrate(): Promise<void>;
  configure(input: { mode: AppMode; url?: string; token?: string }): Promise<void>;
  connect(): void;
  disconnect(): void;
  selectProject(id: string | null): void;
  selectAgent(id: string | null): void;
  loadMissionEvents(missionId: string): Promise<void>;
  loadChat(agentId: string): Promise<void>;
  loadPreviews(projectId: string): Promise<void>;
  dismissAlert(id: string): void;
  saveOfficeSeats(seats: Record<string, string>): void;
  saveOfficeLayout(layout: Record<string, unknown>): void;
  onDesktop(listener: DesktopListener): () => void;
}

let disconnectFn: (() => void) | null = null;
const desktopListeners = new Set<DesktopListener>();

function byId<T extends { id: string }>(list: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const x of list) out[x.id] = x;
  return out;
}

function upsertChat(list: ChatMessage[] | undefined, msg: ChatMessage): ChatMessage[] {
  const arr = list ? [...list] : [];
  const i = arr.findIndex((m) => m.id === msg.id);
  if (i >= 0) arr[i] = msg;
  else arr.push(msg);
  return arr;
}

export const useAgency = create<AgencyState>((set, get) => ({
  hydrated: false,
  mode: 'unset',
  url: '',
  token: '',
  api: null,
  connection: 'idle',
  capabilities: null,
  agents: {},
  runtimes: {},
  projects: {},
  missions: {},
  approvals: {},
  branding: {},
  previews: {},
  chat: {},
  missionEvents: {},
  streaming: {},
  alerts: [],
  usageVersion: 0,
  desktopConnected: false,
  selectedProjectId: null,
  selectedAgentId: null,
  officeSeats: {},
  officeLayout: null,

  async hydrate() {
    const [url, token, mode, project, seats, layout] = await Promise.all([
      prefs.get(K_URL),
      secureStorage.get(K_TOKEN),
      prefs.get(K_MODE),
      prefs.get(K_PROJECT),
      prefs.get(K_SEATS),
      prefs.get(K_LAYOUT),
    ]);
    const defaultUrl = (Constants.expoConfig?.extra?.defaultAgencyUrl as string | undefined) ?? '';
    set({
      hydrated: true,
      url: url ?? defaultUrl,
      token: token ?? '',
      mode: (mode as AppMode | null) ?? 'unset',
      selectedProjectId: project,
      officeSeats: seats ? (JSON.parse(seats) as Record<string, string>) : {},
      officeLayout: layout ? (JSON.parse(layout) as Record<string, unknown>) : null,
    });
    if (get().mode !== 'unset') get().connect();
  },

  async configure({ mode, url, token }) {
    get().disconnect();
    await prefs.set(K_MODE, mode);
    if (url !== undefined) await prefs.set(K_URL, url.trim());
    if (token !== undefined) {
      if (token) await secureStorage.set(K_TOKEN, token.trim());
      else await secureStorage.remove(K_TOKEN);
    }
    set({
      mode,
      url: url !== undefined ? url.trim() : get().url,
      token: token !== undefined ? token.trim() : get().token,
      agents: {},
      runtimes: {},
      projects: {},
      missions: {},
      approvals: {},
      branding: {},
      previews: {},
      chat: {},
      missionEvents: {},
      streaming: {},
      capabilities: null,
    });
    if (mode !== 'unset') get().connect();
  },

  connect() {
    const { mode, url, token } = get();
    get().disconnect();
    let api: AgencyApi;
    if (mode === 'demo') api = createDemoApi();
    else if (mode === 'cloud' && url && token) api = createHttpApi(url, token);
    else return;
    set({ api, connection: 'connecting' });
    disconnectFn = api.connect(
      (e) => applyEvent(e, set, get),
      (connection) => set({ connection }),
    );
  },

  disconnect() {
    disconnectFn?.();
    disconnectFn = null;
    set({ connection: 'idle' });
  },

  selectProject(id) {
    set({ selectedProjectId: id });
    void (id ? prefs.set(K_PROJECT, id) : prefs.remove(K_PROJECT));
  },

  selectAgent(id) {
    set({ selectedAgentId: id });
  },

  async loadMissionEvents(missionId) {
    const api = get().api;
    if (!api) return;
    const have = get().missionEvents[missionId] ?? [];
    const after = have.length ? have[have.length - 1].seq : 0;
    const fresh = await api.missionEvents(missionId, after);
    if (fresh.length === 0 && have.length > 0) return;
    const merged = [...have, ...fresh.filter((e) => !have.some((h) => h.seq === e.seq))].slice(
      -MAX_EVENTS_PER_MISSION,
    );
    set({ missionEvents: { ...get().missionEvents, [missionId]: merged } });
  },

  async loadChat(agentId) {
    const api = get().api;
    if (!api) return;
    const history = await api.chatHistory(agentId);
    set({ chat: { ...get().chat, [agentId]: history } });
  },

  async loadPreviews(projectId) {
    const api = get().api;
    if (!api) return;
    const list = await api.previews(projectId);
    set({ previews: { ...get().previews, [projectId]: list } });
  },

  dismissAlert(id) {
    set({ alerts: get().alerts.filter((a) => a.id !== id) });
  },

  saveOfficeSeats(seats) {
    set({ officeSeats: seats });
    void prefs.set(K_SEATS, JSON.stringify(seats));
  },

  saveOfficeLayout(layout) {
    set({ officeLayout: layout });
    void prefs.set(K_LAYOUT, JSON.stringify(layout));
  },

  onDesktop(listener) {
    desktopListeners.add(listener);
    return () => desktopListeners.delete(listener);
  },
}));

type Set = (partial: Partial<AgencyState>) => void;
type Get = () => AgencyState;

function applyEvent(e: AgencyServerEvent, set: Set, get: Get): void {
  const s = get();
  switch (e.type) {
    case 'snapshot': {
      const missionEvents = s.missionEvents;
      set({
        agents: byId(e.agents),
        runtimes: Object.fromEntries(e.runtimes.map((r) => [r.agentId, r])),
        projects: byId(e.projects),
        missions: byId(e.missions),
        approvals: byId(e.approvals),
        branding: Object.fromEntries(e.branding.map((b) => [b.projectId, b])),
        capabilities: e.capabilities,
        desktopConnected: e.capabilities.desktopBridge.connected,
        missionEvents,
      });
      if (!s.selectedProjectId || !e.projects.some((p) => p.id === s.selectedProjectId)) {
        const first = e.projects.find((p) => p.authorized) ?? e.projects[0];
        if (first) get().selectProject(first.id);
      }
      break;
    }
    case 'agent':
      set({ agents: { ...s.agents, [e.agent.id]: e.agent } });
      break;
    case 'agentDeleted': {
      const agents = { ...s.agents };
      delete agents[e.agentId];
      set({ agents });
      break;
    }
    case 'runtime':
      set({ runtimes: { ...s.runtimes, [e.state.agentId]: e.state } });
      break;
    case 'project':
      set({ projects: { ...s.projects, [e.project.id]: e.project } });
      break;
    case 'projectDeleted': {
      const projects = { ...s.projects };
      delete projects[e.projectId];
      set({ projects });
      break;
    }
    case 'mission': {
      const streaming = { ...s.streaming };
      if (['done', 'failed', 'cancelled'].includes(e.mission.status))
        delete streaming[e.mission.id];
      set({ missions: { ...s.missions, [e.mission.id]: e.mission }, streaming });
      break;
    }
    case 'missionEvent': {
      const ev = e.event;
      if (ev.kind === 'text' && ev.partial) {
        set({
          streaming: {
            ...s.streaming,
            [ev.missionId]: (s.streaming[ev.missionId] ?? '') + ev.text,
          },
        });
        break;
      }
      const list = s.missionEvents[ev.missionId];
      if (list && !list.some((x) => x.seq === ev.seq)) {
        set({
          missionEvents: {
            ...s.missionEvents,
            [ev.missionId]: [...list, ev].slice(-MAX_EVENTS_PER_MISSION),
          },
        });
      }
      if (ev.kind === 'text' && !ev.partial)
        set({ streaming: { ...get().streaming, [ev.missionId]: '' } });
      break;
    }
    case 'chat':
      set({
        chat: { ...s.chat, [e.message.agentId]: upsertChat(s.chat[e.message.agentId], e.message) },
      });
      break;
    case 'approval': {
      const was = s.approvals[e.approval.id];
      set({ approvals: { ...s.approvals, [e.approval.id]: e.approval } });
      if (!was && e.approval.status === 'pending') {
        const agent = s.agents[e.approval.agentId]?.name ?? 'Agente';
        void notify(`${agent} precisa de aprovação`, e.approval.summary);
      }
      break;
    }
    case 'branding':
      set({ branding: { ...s.branding, [e.branding.projectId]: e.branding } });
      break;
    case 'preview': {
      const list = s.previews[e.preview.projectId] ?? [];
      set({
        previews: {
          ...s.previews,
          [e.preview.projectId]: [e.preview, ...list.filter((p) => p.id !== e.preview.id)],
        },
      });
      break;
    }
    case 'usageChanged':
      set({ usageVersion: s.usageVersion + 1 });
      break;
    case 'alert':
      set({ alerts: [e.alert, ...s.alerts].slice(0, 20) });
      void notify('Alerta de uso Claude', e.alert.message);
      break;
    case 'capabilities':
      set({ capabilities: e.capabilities });
      break;
    case 'desktop':
      for (const l of desktopListeners) l(e.messages);
      break;
    case 'desktopStatus':
      set({ desktopConnected: e.connected });
      break;
    case 'pong':
      break;
  }
}

/** Convenience selectors. */
export const selectPendingApprovals = (s: AgencyState) =>
  Object.values(s.approvals).filter((a) => a.status === 'pending');
