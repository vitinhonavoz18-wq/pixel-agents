import * as fs from 'node:fs';
import * as path from 'node:path';

import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import {
  AGENT_TEMPLATES,
  type AgencyServerEvent,
  type AgentProfile,
  AgentInputSchema,
  AgentPatchSchema,
  ApprovalDecisionSchema,
  type Capabilities,
  ChatSendSchema,
  DEPARTMENTS,
  DepartmentIdSchema,
  type DesktopCommand,
  importAgentDefinition,
  limitsFromStatusline,
  MissionCreateSchema,
  type Project,
  type ProjectBranding,
  ProjectInputSchema,
  type ProjectPreview,
  RepoRefSchema,
  slugify,
  UsageAlertRuleSchema,
  WS_CLOSE_UNAUTHORIZED,
} from '@pixel-agency/shared';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z, ZodError } from 'zod';

import { ProjectAssetCache } from './assets.js';
import { AuditLog } from './audit.js';
import {
  canAccessProject,
  extractBearer,
  hasScope,
  type Principal,
  type Scope,
  TokenRegistry,
} from './auth.js';
import { ProjectBrandingEngine } from './branding.js';
import { DesktopBridgeHub } from './bridge.js';
import type { AgencyConfig } from './config.js';
import { EventBus } from './events.js';
import { ClaudeAgentSdkExecutor } from './executor/claudeAgentSdk.js';
import { DemoExecutor } from './executor/demo.js';
import type { AgentExecutor } from './executor/types.js';
import { UnavailableExecutor } from './executor/unavailable.js';
import { GithubService } from './github.js';
import { MissionError, MissionService } from './missions.js';
import { PreviewError, ProjectPreviewEngine } from './previews.js';
import { RateLimiter } from './rateLimit.js';
import { seedIfEmpty } from './seed.js';
import { AgencyStore } from './store.js';
import { UsageService } from './usage.js';
import { newId, nowIso } from './util/ids.js';
import { WorkspaceManager } from './workspaces.js';

export const VERSION = '0.1.0';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export interface AgencyServer {
  app: FastifyInstance;
  store: AgencyStore;
  missions: MissionService;
  tokens: TokenRegistry;
  bus: EventBus;
  close(): Promise<void>;
}

export interface BuildOptions {
  config: AgencyConfig;
  /** Override the executor (tests). */
  executor?: AgentExecutor;
  /** Override fetch for GitHub / Admin API (tests). */
  fetchFn?: typeof fetch;
  logger?: boolean;
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export async function buildServer(opts: BuildOptions): Promise<AgencyServer> {
  const { config } = opts;
  fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });

  const store = new AgencyStore(config.dataDir);
  seedIfEmpty(store);
  const bus = new EventBus();
  const audit = new AuditLog(config.dataDir);
  const tokens = new TokenRegistry(config.dataDir, config.adminToken);
  const assets = new ProjectAssetCache(config.dataDir, config.assetSigningKey);
  const workspaces = new WorkspaceManager(config.workspacesDir, config.githubToken);
  const usage = new UsageService(store, bus, config.anthropicAdminKey, opts.fetchFn);
  const github = new GithubService(config.githubToken, config.allowedRepoOwners, opts.fetchFn);
  const branding = new ProjectBrandingEngine(assets);
  const previews = new ProjectPreviewEngine(store, assets, config.enableCapture);
  const desktop = new DesktopBridgeHub(bus);

  const executor: AgentExecutor =
    opts.executor ??
    (config.demoMode
      ? new DemoExecutor()
      : config.anthropicConfigured
        ? new ClaudeAgentSdkExecutor({
            defaultModel: config.defaultModel,
            maxTurns: config.maxTurns,
            maxBudgetUsd: config.maxBudgetUsd,
            claudeConfigDir: path.join(config.dataDir, 'claude-home'),
          })
        : new UnavailableExecutor(
            'Nenhuma credencial Claude configurada no backend. Defina ANTHROPIC_API_KEY (ou Bedrock/Vertex) — ' +
              'login de assinatura claude.ai não é permitido para produtos de terceiros.',
          ));

  const missions = new MissionService(store, bus, audit, workspaces, executor, usage, {
    maxConcurrent: config.maxConcurrentMissions,
    missionTimeoutMs: config.missionTimeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    demo: executor.status().kind === 'demo',
  });

  const capabilities = (): Capabilities => {
    const st = executor.status();
    const d = desktop.status();
    return {
      version: VERSION,
      mode: st.kind === 'demo' ? 'demo' : 'cloud',
      executor: {
        kind: st.kind,
        ready: st.ready,
        reason: st.reason,
        defaultModel: config.defaultModel,
      },
      github: { configured: github.configured },
      usage: {
        agentTokens: st.kind === 'claude_agent_sdk',
        subscriptionLimits: usage.limits().available,
        orgCost: Boolean(config.anthropicAdminKey),
        credits: false,
      },
      previews: { capture: config.enableCapture },
      desktopBridge: { connected: d.connected, lastSeenAt: d.lastSeenAt },
    };
  };

  const signBranding = (b: ProjectBranding): ProjectBranding => ({
    ...b,
    logoCandidates: b.logoCandidates.map((c) =>
      c.assetId ? { ...c, url: assets.signedPath(c.assetId) } : c,
    ),
  });
  const signPreview = (p: ProjectPreview): ProjectPreview => ({
    ...p,
    url: assets.signedPath(p.assetId),
  });
  const brandingOf = (projectId: string) => {
    const b = store.branding.get(projectId);
    if (!b) return undefined;
    const { id: _id, ...rest } = b;
    return signBranding(rest as ProjectBranding);
  };

  const app = Fastify({
    logger: opts.logger ?? false,
    bodyLimit: 10 * 1024 * 1024,
    trustProxy: true,
  });
  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  await app.register(websocket);

  const limiter = new RateLimiter(config.rateLimitPerMinute);

  // ── Auth + rate limit ─────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    const url = req.url.split('?')[0];
    if (!url.startsWith('/api/')) return;
    if (url === '/api/health') return;
    if (url.startsWith('/api/assets/')) return; // signed URLs, verified in the route
    const presented =
      extractBearer(req.headers.authorization) ??
      (url === '/api/ws' ? (req.query as { token?: string }).token : undefined);
    const principal = tokens.verify(presented);
    if (!limiter.take(principal?.tokenId ?? `ip:${req.ip}`)) {
      return reply.code(429).send({ error: 'Muitas requisições, tente novamente em instantes.' });
    }
    if (!principal) {
      if (url === '/api/ws') return; // the socket closes with 4401 so clients can tell
      return reply.code(401).send({ error: 'Token ausente, inválido ou revogado.' });
    }
    req.principal = principal;
  });

  const need = (req: FastifyRequest, scope: Scope): Principal => {
    const p = req.principal;
    if (!p || !hasScope(p, scope)) throw new HttpError(403, `Permissão "${scope}" necessária.`);
    return p;
  };
  const needProject = (
    req: FastifyRequest,
    projectId: string,
  ): { principal: Principal; project: Project } => {
    const principal = need(req, 'app');
    const project = store.projects.get(projectId);
    if (!project) throw new HttpError(404, 'Projeto não encontrado');
    if (!canAccessProject(principal, projectId))
      throw new HttpError(403, 'Token sem acesso a este projeto.');
    return { principal, project };
  };
  const actor = (req: FastifyRequest) => req.principal?.name ?? 'anon';
  const visibleProjects = (p: Principal) => store.projects.filter((x) => canAccessProject(p, x.id));

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'Dados inválidos',
        issues: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    if (err instanceof HttpError || err instanceof MissionError || err instanceof PreviewError) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });
    app.log.error(err);
    return reply.code(500).send({ error: 'Erro interno do servidor.' });
  });

  // ── Health, capabilities, snapshot ───────────────────────────────────────
  app.get('/api/health', async () => ({ ok: true, version: VERSION, ...missions.stats() }));
  app.get('/api/capabilities', async (req) => {
    need(req, 'app');
    return capabilities();
  });

  const snapshot = (p: Principal): AgencyServerEvent => {
    const projects = visibleProjects(p);
    const ids = new Set(projects.map((x) => x.id));
    return {
      type: 'snapshot',
      agents: store.agents.all(),
      runtimes: missions.runtimeStates(),
      projects,
      missions: store.missions
        .filter((m) => ids.has(m.projectId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 300),
      approvals: store.approvals.filter((a) => a.status === 'pending' && ids.has(a.projectId)),
      branding: projects
        .map((x) => brandingOf(x.id))
        .filter((b): b is ProjectBranding => Boolean(b)),
      capabilities: capabilities(),
    };
  };
  app.get('/api/snapshot', async (req) => snapshot(need(req, 'app')));
  app.get('/api/departments', async () => DEPARTMENTS);

  // ── Agents ───────────────────────────────────────────────────────────────
  app.get('/api/agents', async (req) => {
    need(req, 'app');
    return store.agents.all();
  });
  app.get('/api/agent-templates', async () => Object.values(AGENT_TEMPLATES));

  const saveAgent = (agent: AgentProfile, req: FastifyRequest, action: string) => {
    store.agents.put(agent);
    audit.record({ actor: actor(req), action, target: agent.id });
    bus.publish({ type: 'agent', agent });
    return agent;
  };

  app.post('/api/agents', async (req, reply) => {
    need(req, 'admin');
    const input = AgentInputSchema.parse(req.body);
    let id = input.id ?? slugify(input.name);
    if (store.agents.get(id)) id = `${id}-${Date.now().toString(36).slice(-4)}`;
    const now = nowIso();
    reply.code(201);
    return saveAgent({ ...input, id, createdAt: now, updatedAt: now }, req, 'agent.create');
  });
  app.post('/api/agents/import', async (req, reply) => {
    need(req, 'admin');
    const body = z
      .object({
        text: z.string().max(200_000),
        department: DepartmentIdSchema.optional(),
        palette: z.number().int().min(0).max(5).optional(),
      })
      .parse(req.body);
    const res = importAgentDefinition(body.text, {
      department: body.department,
      palette: body.palette,
    });
    if (!res.ok || !res.agent)
      return reply.code(400).send({ error: 'Importação falhou', issues: res.errors });
    const input = AgentInputSchema.parse(res.agent);
    const id = input.id ?? slugify(input.name);
    const existing = store.agents.get(id);
    const now = nowIso();
    // Importing over a template with the same id REPLACES it with the user's real definition.
    reply.code(existing ? 200 : 201);
    return saveAgent(
      {
        ...input,
        id,
        palette: existing?.palette ?? input.palette,
        projectId: existing?.projectId ?? input.projectId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
      req,
      existing ? 'agent.import.replace' : 'agent.import',
    );
  });
  app.patch<{ Params: { id: string } }>('/api/agents/:id', async (req) => {
    need(req, 'admin');
    const agent = store.agents.get(req.params.id);
    if (!agent) throw new HttpError(404, 'Agente não encontrado');
    const patch = AgentPatchSchema.parse(req.body);
    return saveAgent(
      { ...agent, ...patch, id: agent.id, updatedAt: nowIso() } as AgentProfile,
      req,
      'agent.update',
    );
  });
  app.delete<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    need(req, 'admin');
    if (!store.agents.delete(req.params.id)) throw new HttpError(404, 'Agente não encontrado');
    audit.record({ actor: actor(req), action: 'agent.delete', target: req.params.id });
    bus.publish({ type: 'agentDeleted', agentId: req.params.id });
    return reply.code(204).send();
  });

  // ── Projects ─────────────────────────────────────────────────────────────
  app.get('/api/projects', async (req) => visibleProjects(need(req, 'app')));
  app.get('/api/github/repos', async (req) => {
    need(req, 'admin');
    if (!github.configured)
      throw new HttpError(501, 'AGENCY_GITHUB_TOKEN não configurado no backend.');
    return github.listRepos();
  });

  const verifyRepo = async (repo: unknown) => {
    if (!repo) return undefined;
    const ref = RepoRefSchema.parse(repo);
    if (!github.configured)
      throw new HttpError(501, 'Configure AGENCY_GITHUB_TOKEN para vincular repositórios.');
    const info = await github.getRepo(ref.owner, ref.name).catch((e: Error) => {
      throw new HttpError(400, `Repositório inacessível: ${e.message}`);
    });
    return {
      ...ref,
      owner: info.owner,
      name: info.name,
      defaultBranch: ref.defaultBranch || info.defaultBranch,
    };
  };

  app.post('/api/projects', async (req, reply) => {
    need(req, 'admin');
    const input = ProjectInputSchema.parse(req.body);
    let id = input.id ?? slugify(input.name);
    if (store.projects.get(id)) id = `${id}-${Date.now().toString(36).slice(-4)}`;
    const now = nowIso();
    const project: Project = {
      ...input,
      id,
      repo: await verifyRepo(input.repo),
      createdAt: now,
      updatedAt: now,
    };
    store.projects.put(project);
    audit.record({
      actor: actor(req),
      action: 'project.create',
      target: id,
      detail: { repo: project.repo },
    });
    bus.publish({ type: 'project', project });
    reply.code(201);
    return project;
  });
  app.patch<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    const { project } = needProject(req, req.params.id);
    const patch = ProjectInputSchema.partial().omit({ id: true }).parse(req.body);
    const sensitive = 'repo' in patch || 'authorized' in patch || 'appUrl' in patch;
    if (sensitive) need(req, 'admin');
    const next: Project = {
      ...project,
      ...patch,
      repo: 'repo' in patch ? await verifyRepo(patch.repo) : project.repo,
      id: project.id,
      updatedAt: nowIso(),
    } as Project;
    store.projects.put(next);
    audit.record({
      actor: actor(req),
      action: 'project.update',
      target: next.id,
      detail: { fields: Object.keys(patch) },
    });
    bus.publish({ type: 'project', project: next });
    return next;
  });
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req, reply) => {
    need(req, 'admin');
    if (!store.projects.delete(req.params.id)) throw new HttpError(404, 'Projeto não encontrado');
    audit.record({ actor: actor(req), action: 'project.delete', target: req.params.id });
    bus.publish({ type: 'projectDeleted', projectId: req.params.id });
    return reply.code(204).send();
  });

  // ── Branding & previews ──────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/api/projects/:id/branding', async (req) => {
    needProject(req, req.params.id);
    return brandingOf(req.params.id) ?? null;
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/branding/refresh', async (req) => {
    const { project } = needProject(req, req.params.id);
    if (!project.repo)
      throw new HttpError(
        400,
        'Conecte um repositório ao projeto para extrair a identidade visual.',
      );
    const mirror = await workspaces.prepareMirror(project).catch((e: Error) => {
      throw new HttpError(502, `Falha ao clonar o repositório: ${e.message}`);
    });
    const prev = brandingOf(project.id);
    const result = branding.build(project, mirror.path, mirror.commitSha, prev);
    store.branding.put({ ...result, id: project.id });
    const added = previews.syncFromRepo(
      project,
      mirror.path,
      mirror.commitSha,
      result.logoCandidates,
    );
    audit.record({
      actor: actor(req),
      action: 'branding.refresh',
      target: project.id,
      detail: { commit: mirror.commitSha, status: result.status },
    });
    const signed = signBranding(result);
    bus.publish({ type: 'branding', branding: signed });
    for (const p of added) bus.publish({ type: 'preview', preview: signPreview(p) });
    return signed;
  });
  app.put<{ Params: { id: string } }>('/api/projects/:id/branding/logo', async (req) => {
    needProject(req, req.params.id);
    const { path: logoPath } = z.object({ path: z.string().max(500) }).parse(req.body);
    const b = store.branding.get(req.params.id);
    if (!b || !b.logoCandidates.some((c) => c.path === logoPath))
      throw new HttpError(400, 'Candidato de logo desconhecido');
    b.selectedLogoPath = logoPath;
    b.selectedByUser = true;
    store.branding.put(b);
    audit.record({
      actor: actor(req),
      action: 'branding.selectLogo',
      target: req.params.id,
      detail: { path: logoPath },
    });
    const signed = brandingOf(req.params.id)!;
    bus.publish({ type: 'branding', branding: signed });
    return signed;
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/previews', async (req) => {
    needProject(req, req.params.id);
    return previews.list(req.params.id).map(signPreview);
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/previews/upload', async (req, reply) => {
    const { project } = needProject(req, req.params.id);
    const body = z
      .object({
        title: z.string().max(120),
        mime: z.string().max(40),
        dataBase64: z.string().max(9_000_000),
        filename: z.string().max(200).optional(),
        agentId: z.string().max(80).optional(),
        missionId: z.string().max(80).optional(),
      })
      .parse(req.body);
    const p = previews.upload(project, body);
    audit.record({
      actor: actor(req),
      action: 'preview.upload',
      target: p.id,
      detail: { projectId: project.id },
    });
    bus.publish({ type: 'preview', preview: signPreview(p) });
    reply.code(201);
    return signPreview(p);
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/previews/capture', async (req, reply) => {
    const { project } = needProject(req, req.params.id);
    const body = z
      .object({ url: z.string().max(2000).optional(), title: z.string().max(120).default('') })
      .parse(req.body ?? {});
    const p = await previews.capture(project, body);
    audit.record({
      actor: actor(req),
      action: 'preview.capture',
      target: p.id,
      detail: { url: p.origin },
    });
    bus.publish({ type: 'preview', preview: signPreview(p) });
    reply.code(201);
    return signPreview(p);
  });
  app.delete<{ Params: { id: string } }>('/api/previews/:id', async (req, reply) => {
    const p = store.previews.get(req.params.id);
    if (!p) throw new HttpError(404, 'Prévia não encontrada');
    needProject(req, p.projectId);
    previews.remove(p.id);
    audit.record({ actor: actor(req), action: 'preview.delete', target: p.id });
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string }; Querystring: { exp?: string; sig?: string } }>(
    '/api/assets/:id',
    async (req, reply) => {
      const ok =
        assets.verify(req.params.id, req.query.exp, req.query.sig) ||
        Boolean(tokens.verify(extractBearer(req.headers.authorization)));
      if (!ok) return reply.code(403).send({ error: 'Link expirado ou inválido' });
      const a = assets.read(req.params.id);
      if (!a) return reply.code(404).send({ error: 'Asset não encontrado' });
      reply.header('Content-Type', a.mime);
      reply.header('Cache-Control', 'private, max-age=3600');
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      );
      return reply.send(a.buf);
    },
  );

  // ── Missions ─────────────────────────────────────────────────────────────
  app.get<{
    Querystring: { projectId?: string; agentId?: string; status?: string; kind?: string };
  }>('/api/missions', async (req) => {
    const p = need(req, 'app');
    const q = req.query;
    return store.missions
      .filter(
        (m) =>
          canAccessProject(p, m.projectId) &&
          (!q.projectId || m.projectId === q.projectId) &&
          (!q.agentId || m.agentId === q.agentId) &&
          (!q.status || m.status === q.status) &&
          (!q.kind || m.kind === q.kind),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500);
  });
  app.post('/api/missions', async (req, reply) => {
    const body = MissionCreateSchema.parse(req.body);
    const { principal } = needProject(req, body.projectId);
    reply.code(201);
    return missions.create(body, principal.name);
  });
  const missionFor = (req: FastifyRequest, id: string) => {
    const m = store.missions.get(id);
    if (!m) throw new HttpError(404, 'Missão não encontrada');
    needProject(req, m.projectId);
    return m;
  };
  app.get<{ Params: { id: string } }>('/api/missions/:id', async (req) =>
    missionFor(req, req.params.id),
  );
  app.get<{ Params: { id: string }; Querystring: { after?: string } }>(
    '/api/missions/:id/events',
    async (req) => {
      const m = missionFor(req, req.params.id);
      return store.events(m.id, Number(req.query.after ?? 0) || 0);
    },
  );
  app.get<{ Params: { id: string } }>('/api/missions/:id/diff', async (req, reply) => {
    const m = missionFor(req, req.params.id);
    const file = path.join(config.dataDir, 'diffs', `${m.id}.patch`);
    const patch = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    reply.header('Content-Type', 'application/json');
    return { stat: m.diffStat ?? '', patch, branch: m.branch, baseCommit: m.baseCommit };
  });
  for (const action of ['start', 'cancel', 'retry'] as const) {
    app.post<{ Params: { id: string } }>(`/api/missions/:id/${action}`, async (req) => {
      const m = missionFor(req, req.params.id);
      return missions[action](m.id, actor(req));
    });
  }

  // ── Approvals ────────────────────────────────────────────────────────────
  app.get<{ Querystring: { status?: string } }>('/api/approvals', async (req) => {
    const p = need(req, 'app');
    return store.approvals
      .filter(
        (a) =>
          canAccessProject(p, a.projectId) && (!req.query.status || a.status === req.query.status),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200);
  });
  app.post<{ Params: { id: string } }>('/api/approvals/:id', async (req) => {
    const a = store.approvals.get(req.params.id);
    if (!a) throw new HttpError(404, 'Aprovação não encontrada');
    needProject(req, a.projectId);
    const body = ApprovalDecisionSchema.parse(req.body);
    return missions.resolveApproval(a.id, body.decision, actor(req));
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/api/agents/:id/chat', async (req) => {
    const p = need(req, 'app');
    return missions
      .chatHistory(req.params.id)
      .filter((c) => !c.projectId || canAccessProject(p, c.projectId));
  });
  app.post<{ Params: { id: string } }>('/api/agents/:id/chat', async (req, reply) => {
    const body = ChatSendSchema.parse(req.body);
    const agent = store.agents.get(req.params.id);
    if (!agent) throw new HttpError(404, 'Agente não encontrado');
    const projectId = body.projectId ?? agent.projectId;
    if (!projectId) throw new HttpError(400, 'Selecione um projeto para conversar com o agente');
    const { principal } = needProject(req, projectId);
    reply.code(202);
    return missions.sendChat(agent.id, { ...body, projectId }, principal.name);
  });

  // ── Usage ────────────────────────────────────────────────────────────────
  app.get('/api/usage/summary', async (req) => {
    need(req, 'app');
    return usage.summary();
  });
  app.get('/api/usage/alerts', async (req) => {
    need(req, 'app');
    return store.alertRules.all();
  });
  app.put('/api/usage/alerts', async (req) => {
    need(req, 'admin');
    const rules = z.array(UsageAlertRuleSchema).max(20).parse(req.body);
    for (const r of store.alertRules.all()) store.alertRules.delete(r.id);
    for (const r of rules) store.alertRules.put(r);
    audit.record({ actor: actor(req), action: 'usage.alerts.update' });
    usage.evaluateAlerts();
    return store.alertRules.all();
  });

  // ── Desktop Bridge ───────────────────────────────────────────────────────
  app.post('/api/bridge/statusline', async (req) => {
    need(req, 'bridge');
    const limits = limitsFromStatusline(req.body, nowIso());
    desktop.heartbeat();
    if (limits.available) usage.setLimits(limits);
    return { accepted: limits.available, limits };
  });
  app.post('/api/bridge/events', async (req) => {
    need(req, 'bridge');
    const body = z.object({ messages: z.array(z.unknown()).max(500) }).parse(req.body);
    return { accepted: desktop.ingest(body.messages) };
  });
  app.get<{ Querystring: { after?: string } }>('/api/bridge/commands', async (req) => {
    need(req, 'bridge');
    return desktop.pullCommands(Number(req.query.after ?? 0) || 0);
  });
  app.post('/api/bridge/commands', async (req) => {
    need(req, 'app');
    const cmd = z
      .discriminatedUnion('type', [
        z.object({ type: z.literal('focusAgent'), id: z.number().int() }),
        z.object({ type: z.literal('closeAgent'), id: z.number().int() }),
        z.object({
          type: z.literal('launchAgent'),
          folderPath: z.string().max(1000).optional(),
          bypassPermissions: z.literal(false).optional(),
        }),
      ])
      .parse(req.body) as DesktopCommand;
    audit.record({ actor: actor(req), action: 'bridge.command', detail: { type: cmd.type } });
    return { id: desktop.queueCommand(cmd) };
  });
  app.get('/api/bridge/status', async (req) => {
    need(req, 'app');
    return desktop.status();
  });

  // ── Admin: tokens & audit ────────────────────────────────────────────────
  app.get('/api/tokens', async (req) => {
    need(req, 'admin');
    return tokens.list();
  });
  app.post('/api/tokens', async (req, reply) => {
    need(req, 'admin');
    const body = z
      .object({
        name: z.string().min(1).max(80),
        scopes: z.array(z.enum(['admin', 'app', 'bridge'])).min(1),
        projects: z.union([z.literal('*'), z.array(z.string().max(80)).max(100)]).default('*'),
      })
      .parse(req.body);
    const created = tokens.create(body);
    audit.record({
      actor: actor(req),
      action: 'token.create',
      target: created.record.id,
      detail: { scopes: body.scopes },
    });
    reply.code(201);
    const { hash: _hash, ...record } = created.record;
    return { token: created.token, record };
  });
  app.delete<{ Params: { id: string } }>('/api/tokens/:id', async (req, reply) => {
    need(req, 'admin');
    if (!tokens.revoke(req.params.id))
      throw new HttpError(404, 'Token não encontrado ou já revogado');
    audit.record({ actor: actor(req), action: 'token.revoke', target: req.params.id });
    return reply.code(204).send();
  });
  app.get('/api/audit', async (req) => {
    need(req, 'admin');
    return audit.recent(300);
  });

  // ── WebSocket ────────────────────────────────────────────────────────────
  app.get('/api/ws', { websocket: true }, (socket, req) => {
    const principal = req.principal;
    if (!principal || !hasScope(principal, 'app')) {
      socket.close(WS_CLOSE_UNAUTHORIZED, 'unauthorized');
      return;
    }
    const send = (e: AgencyServerEvent) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(e));
    };
    send(snapshot(principal));
    const replay = desktop.replay();
    if (replay.length > 0) send({ type: 'desktop', messages: replay, receivedAt: nowIso() });
    const visible = (e: AgencyServerEvent): boolean => {
      if (principal.projects === '*') return true;
      const pid =
        e.type === 'mission'
          ? e.mission.projectId
          : e.type === 'approval'
            ? e.approval.projectId
            : e.type === 'project'
              ? e.project.id
              : e.type === 'branding'
                ? e.branding.projectId
                : e.type === 'preview'
                  ? e.preview.projectId
                  : e.type === 'chat'
                    ? e.message.projectId
                    : e.type === 'missionEvent'
                      ? store.missions.get(e.event.missionId)?.projectId
                      : undefined;
      return pid === undefined || canAccessProject(principal, pid);
    };
    const unsubscribe = bus.subscribe((e) => {
      if (visible(e)) send(e);
    });
    const ping = setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping();
    }, 25_000);
    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string };
        if (msg.type === 'ping') send({ type: 'pong', ts: nowIso() });
      } catch {
        // ignore malformed client frames
      }
    });
    socket.on('close', () => {
      clearInterval(ping);
      unsubscribe();
    });
  });

  missions.recover();

  return {
    app,
    store,
    missions,
    tokens,
    bus,
    async close() {
      missions.shutdown();
      await app.close();
      store.flushAll();
    },
  };
}

export { newId };
