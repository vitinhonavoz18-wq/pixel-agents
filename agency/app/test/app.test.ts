import type { AgencyServerEvent, Mission } from '@pixel-agency/shared';
import { describe, expect, it } from 'vitest';

import { createDemoApi } from '../src/demo/demoApi';
import { computeAgencyStats } from '../src/state/agencyStats';

describe('DEMO mode never passes simulation off as real work', () => {
  it('labels every mission, event and agent reply as demo and reports zero usage', async () => {
    const api = createDemoApi();
    const events: AgencyServerEvent[] = [];
    api.connect(
      (e) => events.push(e),
      () => {},
    );
    const snapshot = events[0];
    expect(snapshot.type).toBe('snapshot');
    if (snapshot.type === 'snapshot') {
      expect(snapshot.capabilities.mode).toBe('demo');
      expect(snapshot.branding).toEqual([]); // no invented logos
    }
    await api.sendChat('franklin', { text: 'oi' });
    const usage = await api.usageSummary();
    expect(usage.totals.costUsd).toBe(0);
    expect(usage.limits.available).toBe(false);
    for (const e of events) {
      if (e.type === 'mission') expect(e.mission.demo).toBe(true);
      if (e.type === 'missionEvent') expect(e.event.demo).toBe(true);
      if (e.type === 'runtime') expect(e.state.demo).toBe(true);
      if (e.type === 'chat' && e.message.role === 'agent') expect(e.message.demo).toBe(true);
    }
    await expect(api.refreshBranding('flydelivery')).rejects.toThrow(/DEMO/);
  });
});

describe('computeAgencyStats', () => {
  const base = {
    kind: 'task',
    usage: {},
    createdBy: 'x',
    projectId: 'p',
    agentId: 'a',
    objective: 'o',
    title: 't',
  } as unknown as Mission;
  const m = (over: Partial<Mission>): Mission =>
    ({
      ...base,
      id: Math.random().toString(36).slice(2),
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:00:00Z',
      status: 'done',
      demo: false,
      ...over,
    }) as Mission;

  it('derives level and productivity from real finished missions only', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const missions = [
      ...Array.from({ length: 6 }, () => m({ finishedAt: '2026-10-15T11:00:00Z' })),
      m({ status: 'failed', finishedAt: '2026-10-15T11:00:00Z' }),
      m({ status: 'done', demo: true, finishedAt: '2026-10-15T11:00:00Z' }),
    ];
    const s = computeAgencyStats(missions, [], {}, now);
    expect(s.xp).toBe(60);
    expect(s.level).toBe(2); // 50 XP reaches level 2
    expect(s.productivity).toBe(86);
    expect(s.doneToday).toBe(7);
    expect(computeAgencyStats([], [], {}, now).productivity).toBeNull();
  });
});
