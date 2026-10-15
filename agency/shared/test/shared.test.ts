import { describe, expect, it } from 'vitest';

import {
  activityForTool,
  AGENT_TEMPLATES,
  type AgentProfile,
  type AgentRuntimeState,
  formatCountdown,
  importAgentDefinition,
  interpretOfficeMessage,
  limitsFromStatusline,
  OfficeSync,
} from '../src/index.js';

const now = '2026-10-15T00:00:00.000Z';
const agent = (id: string, over: Partial<AgentProfile> = {}): AgentProfile =>
  ({
    ...AGENT_TEMPLATES.franklin,
    id,
    name: id,
    description: '',
    responsibilities: [],
    instructions: '',
    tools: [],
    autonomy: 'standard',
    enabled: true,
    palette: 0,
    hueShift: 0,
    source: 'custom',
    createdAt: now,
    updatedAt: now,
    ...over,
  }) as AgentProfile;
const rt = (
  agentId: string,
  activity: AgentRuntimeState['activity'],
  statusText = '',
): AgentRuntimeState => ({
  agentId,
  activity,
  statusText,
  updatedAt: now,
  demo: false,
});

describe('activityForTool', () => {
  it('maps real tool calls to operational states', () => {
    expect(activityForTool('Read')).toBe('reading');
    expect(activityForTool('Edit')).toBe('coding');
    expect(activityForTool('Bash', { command: 'npm test' })).toBe('testing');
    expect(activityForTool('Bash', { command: 'npx vitest run' })).toBe('testing');
    expect(activityForTool('Bash', { command: 'git diff --stat' })).toBe('reviewing');
    expect(activityForTool('Bash', { command: 'npm install' })).toBe('running_command');
    expect(activityForTool('TodoWrite')).toBe('planning');
  });
});

describe('OfficeSync', () => {
  it('sends a snapshot first, then only diffs', () => {
    const sync = new OfficeSync();
    const first = sync.sync([
      { agent: agent('franklin', { department: 'automacoes', name: 'Franklin' }) },
    ]);
    expect(first.map((m) => m.type)).toEqual([
      'providerCapabilities',
      'areaMappingsLoaded',
      'existingAgents',
      'agentTeamInfo',
    ]);
    expect(first.find((m) => m.type === 'existingAgents')).toMatchObject({
      folderNames: { 1: 'dept:automacoes' },
    });
    expect(
      sync.sync([{ agent: agent('franklin', { department: 'automacoes', name: 'Franklin' }) }]),
    ).toEqual([]);
  });

  it('animates working states, permission bubbles and the finished cue', () => {
    const sync = new OfficeSync();
    const a = agent('franklin');
    sync.sync([{ agent: a }]);
    const reading = sync.sync([{ agent: a, runtime: rt('franklin', 'reading', 'Reading pay.ts') }]);
    expect(reading).toEqual([
      {
        type: 'agentToolStart',
        id: 1,
        toolId: 'agency-1-1',
        status: 'Reading pay.ts',
        toolName: 'Read',
        permissionActive: false,
      },
      { type: 'agentStatus', id: 1, status: 'active' },
    ]);
    const approval = sync.sync([
      { agent: a, runtime: rt('franklin', 'awaiting_approval', 'git push') },
    ]);
    expect(approval.map((m) => m.type)).toEqual([
      'agentToolDone',
      'agentToolStart',
      'agentStatus',
      'agentToolPermission',
    ]);
    const done = sync.sync([{ agent: a, runtime: rt('franklin', 'done') }]);
    expect(done.map((m) => m.type)).toEqual([
      'agentToolDone',
      'agentToolPermissionClear',
      'agentToolsClear',
      'agentStatus',
    ]);
    expect(done[3]).toMatchObject({ status: 'waiting' });
  });

  it('handles added, renamed, moved and disabled agents', () => {
    const sync = new OfficeSync();
    sync.sync([{ agent: agent('a') }]);
    const added = sync.sync([
      { agent: agent('a') },
      { agent: agent('b', { department: 'design' }) },
    ]);
    expect(added.map((m) => m.type)).toEqual(['agentCreated', 'agentTeamInfo']);
    expect(
      sync.sync([
        { agent: agent('a', { name: 'Ana' }) },
        { agent: agent('b', { department: 'design' }) },
      ]),
    ).toEqual([{ type: 'agentTeamInfo', id: 1, agentName: 'Ana' }]);
    const moved = sync.sync([
      { agent: agent('a', { name: 'Ana', department: 'qualidade' }) },
      { agent: agent('b', { department: 'design' }) },
    ]);
    expect(moved.map((m) => m.type)).toEqual(['agentClosed', 'agentCreated', 'agentTeamInfo']);
    const disabled = sync.sync([
      { agent: agent('a', { name: 'Ana', department: 'qualidade' }) },
      { agent: agent('b', { enabled: false }) },
    ]);
    expect(disabled).toEqual([{ type: 'agentClosed', id: 2 }]);
  });

  it('interprets office clicks and saves', () => {
    expect(interpretOfficeMessage({ type: 'focusAgent', id: 3 })).toEqual({
      kind: 'selectAgent',
      numericId: 3,
    });
    expect(interpretOfficeMessage({ type: 'webviewReady' })).toEqual({ kind: 'ready' });
    expect(
      interpretOfficeMessage({
        type: 'saveAgentSeats',
        seats: { 1: { palette: 0, hueShift: 0, seatId: 's1' } },
      }),
    ).toEqual({
      kind: 'saveSeats',
      seats: { 1: 's1' },
    });
  });
});

describe('importAgentDefinition', () => {
  it('imports a Claude Code subagent markdown file', () => {
    const md =
      '---\nname: franklin\ndescription: Especialista em automações\ntools: Read, Grep, Bash\nmodel: sonnet\n---\nVocê audita integrações.\n';
    const r = importAgentDefinition(md, { department: 'automacoes' });
    expect(r.ok).toBe(true);
    expect(r.agent).toMatchObject({
      id: 'franklin',
      name: 'Franklin',
      tools: ['Read', 'Grep', 'Bash'],
      model: 'claude-sonnet-5-5',
      instructions: 'Você audita integrações.',
      source: 'imported',
      department: 'automacoes',
    });
  });

  it('reports errors instead of guessing', () => {
    expect(importAgentDefinition('').ok).toBe(false);
    expect(importAgentDefinition('just text').ok).toBe(false);
    expect(importAgentDefinition('{bad json').ok).toBe(false);
  });
});

describe('usage helpers', () => {
  it('reads the documented statusline rate_limits only', () => {
    expect(limitsFromStatusline({}, now).available).toBe(false);
    const l = limitsFromStatusline(
      { rate_limits: { five_hour: { used_percentage: 69, resets_at: 1_760_000_000 } } },
      now,
    );
    expect(l).toMatchObject({
      available: true,
      source: 'claude_code_statusline',
      session: { usedPercent: 69 },
    });
  });

  it('formats countdowns in pt-BR', () => {
    const base = Date.parse(now);
    expect(formatCountdown(new Date(base + (2 * 60 + 42) * 60_000).toISOString(), base)).toBe(
      '2 h 42 min',
    );
    expect(formatCountdown(new Date(base - 1).toISOString(), base)).toBe('agora');
  });
});
