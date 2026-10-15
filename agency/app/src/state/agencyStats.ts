import {
  isWorking,
  type AgentProfile,
  type AgentRuntimeState,
  type Mission,
} from '@pixel-agency/shared';

export interface AgencyStats {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForLevel: number;
  /** done / (done + failed) over the last 7 days; null when nothing finished. */
  productivity: number | null;
  doneToday: number;
  createdToday: number;
  activeAgents: number;
  enabledAgents: number;
}

const XP_PER_TASK = 10;
const XP_PER_CHAT = 2;

/** Level curve: level n needs 50·n² XP in total. */
const xpAt = (level: number) => 50 * (level - 1) ** 2;

/**
 * Agency progression and HUD numbers — all derived from REAL finished
 * missions and live agent states (DEMO missions excluded), never made up.
 */
export function computeAgencyStats(
  missions: Mission[],
  agents: AgentProfile[],
  runtimes: Record<string, AgentRuntimeState>,
  now = new Date(),
): AgencyStats {
  const real = missions.filter((m) => !m.demo);
  const xp = real.reduce(
    (s, m) => s + (m.status === 'done' ? (m.kind === 'task' ? XP_PER_TASK : XP_PER_CHAT) : 0),
    0,
  );
  let level = 1;
  while (xp >= xpAt(level + 1)) level++;
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const finished = real.filter(
    (m) => m.kind === 'task' && m.finishedAt && Date.parse(m.finishedAt) >= weekAgo,
  );
  const done = finished.filter((m) => m.status === 'done').length;
  const failed = finished.filter((m) => m.status === 'failed').length;
  const today = now.toISOString().slice(0, 10);
  const tasks = missions.filter((m) => m.kind === 'task');
  const enabled = agents.filter((a) => a.enabled);
  return {
    level,
    xp,
    xpIntoLevel: xp - xpAt(level),
    xpForLevel: xpAt(level + 1) - xpAt(level),
    productivity: done + failed > 0 ? Math.round((done / (done + failed)) * 100) : null,
    doneToday: tasks.filter((m) => m.status === 'done' && m.finishedAt?.startsWith(today)).length,
    createdToday: tasks.filter((m) => m.createdAt.startsWith(today)).length,
    activeAgents: enabled.filter((a) => runtimes[a.id] && isWorking(runtimes[a.id].activity))
      .length,
    enabledAgents: enabled.length,
  };
}
