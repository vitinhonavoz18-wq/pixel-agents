import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgencyServerEvent, AgentActivityState, Mission } from '@pixel-agency/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';
import { ClaudeAgentSdkExecutor } from '../src/executor/claudeAgentSdk.js';
import { type AgencyServer, buildServer } from '../src/server.js';

const ADMIN = 'test-admin-token-0123456789';
const auth = { authorization: `Bearer ${ADMIN}` };

/**
 * A scripted stand-in for the SDK's `query()`: it emits the same message
 * shapes the real Claude Code harness does and, like the real harness, runs
 * the PreToolUse hook and asks `canUseTool` before a tool that needs it.
 */
function scriptedQuery(script: { askCommand?: string; text: string }) {
  return (({ options }: { prompt: string; options: Options }) =>
    (async function* (): AsyncGenerator<SDKMessage> {
      const session_id = 'sess-123';
      yield {
        type: 'system',
        subtype: 'init',
        session_id,
        model: 'claude-opus-5-5',
      } as unknown as SDKMessage;
      yield {
        type: 'assistant',
        parent_tool_use_id: null,
        session_id,
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tu1',
              name: 'Read',
              input: { file_path: `${options.cwd}/README.md` },
            },
          ],
        },
      } as unknown as SDKMessage;
      yield {
        type: 'user',
        parent_tool_use_id: null,
        session_id,
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'conteúdo' }],
        },
      } as unknown as SDKMessage;
      if (script.askCommand) {
        const input = { command: script.askCommand };
        yield {
          type: 'assistant',
          parent_tool_use_id: null,
          session_id,
          message: { content: [{ type: 'tool_use', id: 'tu2', name: 'Bash', input }] },
        } as unknown as SDKMessage;
        const hook = options.hooks!.PreToolUse![0].hooks[0];
        const verdict = (await hook(
          {
            hook_event_name: 'PreToolUse',
            tool_name: 'Bash',
            tool_input: input,
            tool_use_id: 'tu2',
            session_id,
            transcript_path: '',
            cwd: options.cwd!,
          } as never,
          'tu2',
          { signal: new AbortController().signal },
        )) as { hookSpecificOutput?: { permissionDecision?: string } };
        let allowed = verdict.hookSpecificOutput?.permissionDecision !== 'deny';
        if (verdict.hookSpecificOutput?.permissionDecision === 'ask') {
          const r = await options.canUseTool!('Bash', input, {
            signal: new AbortController().signal,
            toolUseID: 'tu2',
          } as never);
          allowed = r?.behavior === 'allow';
        }
        yield {
          type: 'user',
          parent_tool_use_id: null,
          session_id,
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tu2',
                content: allowed ? 'ok' : 'negado',
                is_error: !allowed,
              },
            ],
          },
        } as unknown as SDKMessage;
      }
      yield {
        type: 'stream_event',
        parent_tool_use_id: null,
        session_id,
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Relat' } },
      } as unknown as SDKMessage;
      yield {
        type: 'assistant',
        parent_tool_use_id: null,
        session_id,
        message: { content: [{ type: 'text', text: script.text }] },
      } as unknown as SDKMessage;
      yield {
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: script.text,
        session_id,
        num_turns: 3,
        total_cost_usd: 0.0421,
        usage: {},
        modelUsage: {
          'claude-opus-5-5': {
            inputTokens: 1200,
            outputTokens: 340,
            cacheReadInputTokens: 5000,
            cacheCreationInputTokens: 800,
            costUSD: 0.0421,
            webSearchRequests: 0,
            contextWindow: 1_000_000,
            maxOutputTokens: 128_000,
          },
        },
      } as unknown as SDKMessage;
    })()) as never;
}

let server: AgencyServer;
let events: AgencyServerEvent[];

async function boot(script: Parameters<typeof scriptedQuery>[0]) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-api-'));
  const config = loadConfig({
    AGENCY_DATA_DIR: dataDir,
    AGENCY_ADMIN_TOKEN: ADMIN,
  } as NodeJS.ProcessEnv);
  server = await buildServer({
    config,
    executor: new ClaudeAgentSdkExecutor({
      defaultModel: 'claude-opus-5-5',
      maxTurns: 10,
      claudeConfigDir: path.join(dataDir, 'claude-home'),
      queryFn: scriptedQuery(script),
    }),
  });
  events = [];
  server.bus.subscribe((e) => events.push(e));
  // A project with no repository runs in an empty isolated workspace.
  const res = await server.app.inject({
    method: 'PATCH',
    url: '/api/projects/flydelivery',
    headers: auth,
    payload: { authorized: true },
  });
  expect(res.statusCode).toBe(200);
}

async function waitFor<T>(fn: () => T | undefined, ms = 5000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const mission = (id: string) => server.store.missions.get(id) as Mission;
const activities = (agentId: string): AgentActivityState[] =>
  events.flatMap((e) =>
    e.type === 'runtime' && e.state.agentId === agentId ? [e.state.activity] : [],
  );

afterEach(async () => {
  await server?.close();
});

describe('auth & authorization', () => {
  beforeEach(() => boot({ text: 'ok' }));

  it('rejects missing/invalid tokens and keeps /api/health public', async () => {
    expect((await server.app.inject({ url: '/api/agents' })).statusCode).toBe(401);
    expect(
      (
        await server.app.inject({
          url: '/api/agents',
          headers: { authorization: 'Bearer nope-nope-nope-nope' },
        })
      ).statusCode,
    ).toBe(401);
    expect((await server.app.inject({ url: '/api/health' })).statusCode).toBe(200);
  });

  it('refuses missions on projects that are not authorized', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/missions',
      headers: auth,
      payload: { title: 'x', objective: 'y', projectId: 'conectfly', agentId: 'allyson' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('scopes app tokens to their projects and supports revocation', async () => {
    const created = await server.app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: auth,
      payload: { name: 'tablet', scopes: ['app'], projects: ['conectfly'] },
    });
    const { token, record } = created.json() as { token: string; record: { id: string } };
    const h = { authorization: `Bearer ${token}` };
    const projects = (
      await server.app.inject({ url: '/api/projects', headers: h })
    ).json() as Array<{ id: string }>;
    expect(projects.map((p) => p.id)).toEqual(['conectfly']);
    const forbidden = await server.app.inject({
      method: 'POST',
      url: '/api/missions',
      headers: h,
      payload: { title: 'x', objective: 'y', projectId: 'flydelivery', agentId: 'franklin' },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(
      (await server.app.inject({ method: 'POST', url: '/api/agents', headers: h, payload: {} }))
        .statusCode,
    ).toBe(403);
    await server.app.inject({ method: 'DELETE', url: `/api/tokens/${record.id}`, headers: auth });
    expect((await server.app.inject({ url: '/api/projects', headers: h })).statusCode).toBe(401);
  });

  it('records state-changing actions in the audit log', async () => {
    const audit = (await server.app.inject({ url: '/api/audit', headers: auth })).json() as Array<{
      action: string;
    }>;
    expect(audit.map((a) => a.action)).toContain('project.update');
  });
});

describe('mission lifecycle with the Claude Agent SDK executor', () => {
  beforeEach(() =>
    boot({
      askCommand: 'git push origin pixel-agency/x',
      text: 'Relatório: 2 problemas encontrados.',
    }),
  );

  it('runs, asks for approval on a sensitive command, finishes with result, usage and evidence', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/missions',
      headers: auth,
      payload: {
        title: 'Auditoria pagamentos',
        objective: 'Franklin, audite as integrações de pagamento do FlyDelivery.',
        projectId: 'flydelivery',
        agentId: 'franklin',
      },
    });
    expect(res.statusCode).toBe(201);
    const id = (res.json() as Mission).id;

    const approval = await waitFor(() =>
      server.store.approvals.all().find((a) => a.missionId === id && a.status === 'pending'),
    );
    expect(approval.toolName).toBe('Bash');
    expect(approval.risk).toBe('high');
    expect(mission(id).status).toBe('awaiting_approval');
    expect(server.missions.runtimeOf('franklin').activity).toBe('awaiting_approval');

    const decided = await server.app.inject({
      method: 'POST',
      url: `/api/approvals/${approval.id}`,
      headers: auth,
      payload: { decision: 'approve' },
    });
    expect(decided.statusCode).toBe(200);

    await waitFor(() => (mission(id).status === 'done' ? true : undefined));
    const m = mission(id);
    expect(m.sessionId).toBe('sess-123');
    expect(m.result).toContain('2 problemas');
    expect(m.usage).toMatchObject({
      inputTokens: 1200,
      outputTokens: 340,
      cacheReadTokens: 5000,
      cacheCreationTokens: 800,
      costUsd: 0.0421,
    });

    // Operational states came from real events, in order.
    const acts = activities('franklin');
    expect(acts[0]).toBe('planning');
    expect(acts).toContain('reading');
    expect(acts).toContain('awaiting_approval');
    expect(acts[acts.length - 1]).toBe('done');

    const evs = (
      await server.app.inject({ url: `/api/missions/${id}/events`, headers: auth })
    ).json() as Array<{ kind: string }>;
    const kinds = evs.map((e) => e.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'status',
        'tool_start',
        'tool_end',
        'approval_requested',
        'approval_resolved',
        'usage',
        'result',
      ]),
    );
    expect(kinds).not.toContain('text_partial');

    const summary = (
      await server.app.inject({ url: '/api/usage/summary', headers: auth })
    ).json() as {
      totals: { costUsd: number };
      byAgent: Array<{ key: string }>;
      recent: Array<{ costSource: string }>;
      limits: { available: boolean };
      credits: { available: boolean };
    };
    expect(summary.totals.costUsd).toBeCloseTo(0.0421);
    expect(summary.byAgent[0].key).toBe('franklin');
    expect(summary.recent[0].costSource).toBe('agent_sdk_estimate');
    expect(summary.limits.available).toBe(false);
    expect(summary.credits.available).toBe(false);
  });

  it('denies a destructive command without asking anyone', async () => {
    await server.close();
    await boot({ askCommand: 'rm -rf / --no-preserve-root', text: 'feito' });
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/missions',
      headers: auth,
      payload: { title: 't', objective: 'o', projectId: 'flydelivery', agentId: 'franklin' },
    });
    const id = (res.json() as Mission).id;
    await waitFor(() => (mission(id).status === 'done' ? true : undefined));
    expect(server.store.approvals.all()).toHaveLength(0);
    const evs = server.store.events(id);
    expect(evs.some((e) => e.kind === 'tool_end' && e.isError)).toBe(true);
    expect(evs.some((e) => e.kind === 'log' && e.message.includes('bloqueado'))).toBe(true);
  });

  it('cancels a mission waiting for approval', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/missions',
      headers: auth,
      payload: { title: 't', objective: 'o', projectId: 'flydelivery', agentId: 'franklin' },
    });
    const id = (res.json() as Mission).id;
    await waitFor(() => (mission(id).status === 'awaiting_approval' ? true : undefined));
    await server.app.inject({ method: 'POST', url: `/api/missions/${id}/cancel`, headers: auth });
    await waitFor(() => (['cancelled', 'done'].includes(mission(id).status) ? true : undefined));
    expect(server.store.approvals.all().every((a) => a.status !== 'pending')).toBe(true);
  });

  it('keeps backlog missions out of the queue until started', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/missions',
      headers: auth,
      payload: {
        title: 'depois',
        objective: 'o',
        projectId: 'flydelivery',
        agentId: 'franklin',
        start: false,
      },
    });
    const m = res.json() as Mission;
    expect(m.status).toBe('backlog');
    await new Promise((r) => setTimeout(r, 100));
    expect(mission(m.id).status).toBe('backlog');
  });
});

describe('chat', () => {
  beforeEach(() => boot({ text: 'Olá! Já estou analisando as automações.' }));

  it('streams the agent reply and resumes the same Claude session next time', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/api/agents/franklin/chat',
      headers: auth,
      payload: { text: 'Franklin, faça uma auditoria nas automações do FlyDelivery.' },
    });
    expect(res.statusCode).toBe(202);
    const { reply, mission: chatMission } = res.json() as {
      reply: { id: string };
      mission: Mission;
    };
    expect(chatMission.kind).toBe('chat');
    await waitFor(() => {
      const m = server.store.chat.get(reply.id);
      return m && !m.streaming ? m : undefined;
    });
    const history = (
      await server.app.inject({ url: '/api/agents/franklin/chat', headers: auth })
    ).json() as Array<{ role: string; text: string }>;
    expect(history.map((h) => h.role)).toEqual(['user', 'agent']);
    expect(history[1].text).toContain('analisando as automações');
    expect(
      events.some((e) => e.type === 'missionEvent' && e.event.kind === 'text' && e.event.partial),
    ).toBe(true);

    const second = await server.app.inject({
      method: 'POST',
      url: '/api/agents/franklin/chat',
      headers: auth,
      payload: { text: 'E agora?' },
    });
    expect((second.json() as { mission: Mission }).mission.sessionId).toBe('sess-123');
  });
});

describe('desktop bridge', () => {
  beforeEach(() => boot({ text: 'ok' }));

  it('accepts official statusline rate_limits only from bridge-scoped tokens', async () => {
    const created = await server.app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: auth,
      payload: { name: 'pc', scopes: ['bridge'] },
    });
    const bridge = { authorization: `Bearer ${(created.json() as { token: string }).token}` };
    const payload = {
      rate_limits: {
        five_hour: { used_percentage: 69, resets_at: 1_900_000_000 },
        seven_day: { used_percentage: 52 },
      },
    };
    expect(
      (
        await server.app.inject({
          method: 'POST',
          url: '/api/bridge/statusline',
          headers: auth,
          payload,
        })
      ).statusCode,
    ).toBe(403);
    const ok = await server.app.inject({
      method: 'POST',
      url: '/api/bridge/statusline',
      headers: bridge,
      payload,
    });
    expect(ok.json()).toMatchObject({ accepted: true });
    const summary = (
      await server.app.inject({ url: '/api/usage/summary', headers: auth })
    ).json() as { limits: { available: boolean; session: { usedPercent: number } } };
    expect(summary.limits).toMatchObject({ available: true, session: { usedPercent: 69 } });
    const relayed = await server.app.inject({
      method: 'POST',
      url: '/api/bridge/events',
      headers: bridge,
      payload: {
        messages: [
          { type: 'agentCreated', id: 1 },
          { type: 'layoutLoaded', layout: {} },
        ],
      },
    });
    expect(relayed.json()).toEqual({ accepted: 1 });
  });
});
