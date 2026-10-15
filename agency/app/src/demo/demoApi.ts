import {
  activityForTool,
  AGENT_TEMPLATES,
  type AgencyServerEvent,
  type AgentActivityState,
  type AgentProfile,
  type AgentRuntimeState,
  type Approval,
  type Capabilities,
  type ChatMessage,
  EMPTY_USAGE,
  type Mission,
  type MissionEvent,
  type MissionEventBody,
  type MissionStatus,
  type Project,
  type UsageAlertRule,
} from '@pixel-agency/shared';

import { type AgencyApi, ApiError, type ConnectionState } from '../api/types';

/**
 * DEMO backend that runs inside the app — no server, no Claude, no
 * repository. It exists so the interface can be explored on the tablet before
 * the cloud backend is deployed. Everything it produces carries `demo: true`,
 * every text says it is simulated, and it reports ZERO consumption: DEMO
 * never invents usage, logos or screenshots.
 */
const PLANNED = [
  'FlyDelivery',
  'FlyDelivery Parceiros',
  'FlyBoy',
  'ConectFly',
  'Robô da Loteria',
  'CRM de Prospecção',
  'Barber Connection',
];

const STEPS: Array<{ tool: string; status: string; input: Record<string, unknown>; ms: number }> = [
  { tool: 'TodoWrite', status: 'Planejando etapas (DEMO)', input: {}, ms: 1800 },
  { tool: 'Glob', status: 'Searching files (DEMO)', input: {}, ms: 1500 },
  { tool: 'Read', status: 'Reading README.md (DEMO)', input: {}, ms: 2200 },
  { tool: 'Edit', status: 'Editing exemplo.ts (DEMO)', input: {}, ms: 2500 },
  { tool: 'Bash', status: 'Running: npm test (DEMO)', input: { command: 'npm test' }, ms: 2800 },
];

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

let counter = 0;
const id = (p: string) => `${p}_demo${Date.now().toString(36)}${(counter++).toString(36)}`;
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createDemoApi(): AgencyApi {
  const t0 = now();
  const agents = new Map<string, AgentProfile>();
  for (const t of Object.values(AGENT_TEMPLATES)) {
    agents.set(t.id, {
      description: '',
      responsibilities: [],
      instructions: '',
      tools: [],
      autonomy: 'standard',
      enabled: true,
      palette: 0,
      hueShift: 0,
      source: 'template',
      ...t,
      projectId: t.id === 'franklin' ? 'flydelivery' : 'conectfly',
      createdAt: t0,
      updatedAt: t0,
    } as AgentProfile);
  }
  const projects = new Map<string, Project>(
    PLANNED.map((name) => [
      slug(name),
      {
        id: slug(name),
        name,
        description: 'DEMO — repositório ainda não conectado.',
        team:
          slug(name) === 'flydelivery'
            ? ['franklin']
            : slug(name) === 'conectfly'
              ? ['allyson']
              : [],
        authorized: true,
        archived: false,
        createdAt: t0,
        updatedAt: t0,
      },
    ]),
  );
  const missions = new Map<string, Mission>();
  const events = new Map<string, MissionEvent[]>();
  const approvals = new Map<string, Approval>();
  const approvalWaiters = new Map<string, (ok: boolean) => void>();
  const chat = new Map<string, ChatMessage[]>();
  const runtimes = new Map<string, AgentRuntimeState>();
  const cancelled = new Set<string>();
  let rules: UsageAlertRule[] = [
    { id: 'session-80', metric: 'session_percent', threshold: 80, enabled: true },
    { id: 'weekly-80', metric: 'weekly_percent', threshold: 80, enabled: true },
  ];
  const listeners = new Set<(e: AgencyServerEvent) => void>();
  const emit = (e: AgencyServerEvent) => listeners.forEach((l) => l(e));

  const capabilities: Capabilities = {
    version: 'demo',
    mode: 'demo',
    executor: {
      kind: 'demo',
      ready: true,
      reason: 'MODO DEMO — eventos simulados, nenhuma execução real.',
      defaultModel: '—',
    },
    github: { configured: false },
    usage: { agentTokens: false, subscriptionLimits: false, orgCost: false, credits: false },
    previews: { capture: false },
    desktopBridge: { connected: false },
  };

  const setRuntime = (
    agentId: string,
    activity: AgentActivityState,
    statusText: string,
    m?: Mission,
  ) => {
    const state: AgentRuntimeState = {
      agentId,
      activity,
      statusText,
      missionId: m?.id,
      projectId: m?.projectId,
      updatedAt: now(),
      demo: true,
    };
    runtimes.set(agentId, state);
    emit({ type: 'runtime', state });
  };
  const event = (m: Mission, body: MissionEventBody) => {
    const list = events.get(m.id) ?? [];
    const e = {
      ...body,
      seq: list.length + 1,
      missionId: m.id,
      agentId: m.agentId,
      ts: now(),
      demo: true,
    } as MissionEvent;
    if (!(body.kind === 'text' && body.partial)) list.push(e);
    events.set(m.id, list);
    emit({ type: 'missionEvent', event: e });
  };
  const status = (m: Mission, s: MissionStatus) => {
    m.status = s;
    m.updatedAt = now();
    event(m, { kind: 'status', status: s });
    emit({ type: 'mission', mission: { ...m } });
  };

  async function run(m: Mission, reply?: ChatMessage) {
    status(m, 'running');
    m.startedAt = now();
    setRuntime(m.agentId, 'planning', 'Preparando (DEMO)', m);
    event(m, {
      kind: 'log',
      level: 'warn',
      message: 'MODO DEMO — nenhuma tarefa real está sendo executada.',
    });
    const steps = m.kind === 'chat' ? STEPS.slice(1, 3) : STEPS;
    let i = 0;
    for (const s of steps) {
      if (cancelled.has(m.id)) break;
      const toolUseId = `demo-${i++}`;
      event(m, {
        kind: 'tool_start',
        toolUseId,
        toolName: s.tool,
        statusText: s.status,
        input: s.input,
      });
      const act = activityForTool(s.tool, s.input);
      setRuntime(m.agentId, act, s.status, m);
      if (act === 'testing') status(m, 'testing');
      await sleep(s.ms);
      event(m, {
        kind: 'tool_end',
        toolUseId,
        toolName: s.tool,
        isError: false,
        output: '(simulado)',
      });
      if (m.status === 'testing') status(m, 'running');
    }
    if (m.kind === 'task' && !cancelled.has(m.id)) {
      // Demonstrates the approval flow with a sensitive operation.
      const ap: Approval = {
        id: id('ap'),
        missionId: m.id,
        agentId: m.agentId,
        projectId: m.projectId,
        toolName: 'Bash',
        input: { command: 'git push origin pixel-agency/demo' },
        summary: 'Running: git push origin pixel-agency/demo (DEMO)',
        reason: 'Operação sensível: enviar commits ao GitHub',
        risk: 'high',
        status: 'pending',
        createdAt: now(),
      };
      approvals.set(ap.id, ap);
      emit({ type: 'approval', approval: ap });
      event(m, {
        kind: 'approval_requested',
        approvalId: ap.id,
        toolName: 'Bash',
        summary: ap.summary,
      });
      status(m, 'awaiting_approval');
      setRuntime(m.agentId, 'awaiting_approval', 'Aprovação: git push (DEMO)', m);
      const ok = await new Promise<boolean>((resolve) => approvalWaiters.set(ap.id, resolve));
      event(m, {
        kind: 'approval_resolved',
        approvalId: ap.id,
        decision: ok ? 'approved' : 'denied',
      });
      if (!cancelled.has(m.id)) status(m, 'running');
    }
    if (cancelled.has(m.id)) {
      status(m, 'cancelled');
      setRuntime(m.agentId, 'idle', '', m);
      return;
    }
    const text =
      `[DEMO] ${agents.get(m.agentId)?.name ?? 'Agente'} recebeu: "${m.objective.slice(0, 160)}".\n\n` +
      'Esta resposta é SIMULADA pelo modo DEMO do aplicativo: nenhum arquivo foi lido, nenhum teste foi executado ' +
      'e nenhum modelo Claude foi chamado. Conecte o backend PIXEL AGENCY em Config para execução real.';
    if (reply) {
      for (const w of text.split(/(?<= )/)) {
        reply.text += w;
        emit({ type: 'chat', message: { ...reply } });
        await sleep(30);
      }
      reply.streaming = false;
      emit({ type: 'chat', message: { ...reply } });
    }
    m.result = text;
    m.finishedAt = now();
    event(m, { kind: 'result', text, isError: false });
    event(m, { kind: 'usage', usage: { ...EMPTY_USAGE }, model: 'demo' });
    status(m, 'done');
    setRuntime(m.agentId, 'done', 'Concluído (DEMO)', m);
    setTimeout(
      () => runtimes.get(m.agentId)?.missionId === m.id && setRuntime(m.agentId, 'idle', ''),
      15000,
    );
  }

  const newMission = (
    input: { title: string; objective: string; projectId: string; agentId: string },
    kind: 'task' | 'chat',
    start: boolean,
  ): Mission => {
    if (!agents.get(input.agentId)) throw new ApiError('Agente não encontrado', 404);
    if (!projects.get(input.projectId)) throw new ApiError('Projeto não encontrado', 404);
    const m: Mission = {
      id: id(kind === 'chat' ? 'c' : 'm'),
      kind,
      ...input,
      status: start ? 'queued' : 'backlog',
      usage: { ...EMPTY_USAGE },
      createdBy: 'demo',
      createdAt: now(),
      updatedAt: now(),
      demo: true,
    };
    missions.set(m.id, m);
    emit({ type: 'mission', mission: { ...m } });
    return m;
  };

  const notSupported = (what: string) =>
    Promise.reject(
      new ApiError(`${what} não está disponível no MODO DEMO. Conecte o backend em Config.`, 501),
    );

  return {
    mode: 'demo',
    baseUrl: 'demo://local',
    connect(onEvent, onState: (s: ConnectionState) => void) {
      listeners.add(onEvent);
      onState('online');
      onEvent({
        type: 'snapshot',
        agents: [...agents.values()],
        runtimes: [...runtimes.values()],
        projects: [...projects.values()],
        missions: [...missions.values()],
        approvals: [...approvals.values()].filter((a) => a.status === 'pending'),
        branding: [],
        capabilities,
      });
      return () => listeners.delete(onEvent);
    },
    missionEvents: async (mid, after = 0) => (events.get(mid) ?? []).filter((e) => e.seq > after),
    missionDiff: async () => ({ stat: '', patch: '' }),
    async createMission(input) {
      const m = newMission(input, 'task', input.start !== false);
      if (m.status === 'queued') void run(m);
      return m;
    },
    async missionAction(mid, action) {
      const m = missions.get(mid);
      if (!m) throw new ApiError('Missão não encontrada', 404);
      if (action === 'cancel') {
        cancelled.add(mid);
        for (const [aid, w] of approvalWaiters) {
          if (approvals.get(aid)?.missionId === mid) {
            approvalWaiters.delete(aid);
            w(false);
          }
        }
        if (m.status === 'backlog' || m.status === 'queued') status(m, 'cancelled');
      } else {
        cancelled.delete(mid);
        void run(m);
      }
      return m;
    },
    async resolveApproval(aid, decision) {
      const a = approvals.get(aid);
      if (!a) throw new ApiError('Aprovação não encontrada', 404);
      a.status = decision === 'approve' ? 'approved' : 'denied';
      a.resolvedAt = now();
      emit({ type: 'approval', approval: { ...a } });
      approvalWaiters.get(aid)?.(decision === 'approve');
      approvalWaiters.delete(aid);
      return a;
    },
    chatHistory: async (agentId) => chat.get(agentId) ?? [],
    async sendChat(agentId, input) {
      const agent = agents.get(agentId);
      const projectId = input.projectId ?? agent?.projectId;
      if (!agent || !projectId) throw new ApiError('Selecione um projeto', 400);
      const m = newMission(
        { title: input.text.slice(0, 80), objective: input.text, projectId, agentId },
        'chat',
        true,
      );
      const list = chat.get(agentId) ?? [];
      const user: ChatMessage = {
        id: id('msg'),
        agentId,
        missionId: m.id,
        projectId,
        role: 'user',
        text: input.text,
        streaming: false,
        ts: now(),
        demo: false,
      };
      const reply: ChatMessage = {
        id: id('msg'),
        agentId,
        missionId: m.id,
        projectId,
        role: 'agent',
        text: '',
        streaming: true,
        ts: now(),
        demo: true,
      };
      list.push(user, reply);
      chat.set(agentId, list);
      emit({ type: 'chat', message: user });
      emit({ type: 'chat', message: { ...reply } });
      void run(m, reply);
      return { mission: m };
    },
    async usageSummary() {
      return {
        generatedAt: now(),
        limits: {
          available: false,
          reason: 'MODO DEMO — sem conexão com Claude; nenhum consumo real.',
        },
        credits: { available: false, reason: 'Não há API oficial para saldo de créditos.' },
        orgCost: { available: false, reason: 'MODO DEMO' },
        totals: { ...EMPTY_USAGE },
        byAgent: [],
        byProject: [],
        byModel: [],
        byMission: [],
        recent: [],
      };
    },
    alertRules: async () => rules,
    async saveAlertRules(r) {
      rules = r;
      return rules;
    },
    async createAgent(input) {
      const a = {
        ...input,
        id: input.id ?? slug(input.name),
        createdAt: now(),
        updatedAt: now(),
      } as AgentProfile;
      agents.set(a.id, a);
      emit({ type: 'agent', agent: a });
      return a;
    },
    async updateAgent(aid, patch) {
      const a = agents.get(aid);
      if (!a) throw new ApiError('Agente não encontrado', 404);
      const next = { ...a, ...patch, updatedAt: now() } as AgentProfile;
      agents.set(aid, next);
      emit({ type: 'agent', agent: next });
      return next;
    },
    async deleteAgent(aid) {
      agents.delete(aid);
      emit({ type: 'agentDeleted', agentId: aid });
    },
    importAgent: () => notSupported('Importar agentes'),
    async createProject(input) {
      const p = {
        ...input,
        id: input.id ?? slug(input.name),
        team: input.team ?? [],
        authorized: true,
        archived: false,
        description: input.description ?? '',
        createdAt: now(),
        updatedAt: now(),
      } as Project;
      projects.set(p.id, p);
      emit({ type: 'project', project: p });
      return p;
    },
    async updateProject(pid, patch) {
      const p = projects.get(pid);
      if (!p) throw new ApiError('Projeto não encontrado', 404);
      const next = { ...p, ...patch, updatedAt: now() } as Project;
      projects.set(pid, next);
      emit({ type: 'project', project: next });
      return next;
    },
    githubRepos: () => notSupported('Listar repositórios GitHub'),
    refreshBranding: () => notSupported('Extrair identidade visual do repositório'),
    selectLogo: () => notSupported('Selecionar logo'),
    previews: async () => [],
    uploadPreview: () => notSupported('Enviar imagens'),
    capturePreview: () => notSupported('Capturar telas'),
    desktopCommand: () => notSupported('Desktop Bridge'),
    assetUrl: (p) => p,
  };
}
