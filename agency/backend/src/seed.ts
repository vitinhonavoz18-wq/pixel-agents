import { AGENT_TEMPLATES, type AgentProfile, type Project } from '@pixel-agency/shared';

import type { AgencyStore } from './store.js';
import { nowIso } from './util/ids.js';

/** Projects the user plans to connect. Created WITHOUT a repository and NOT authorized. */
export const PLANNED_PROJECTS = [
  'FlyDelivery',
  'FlyDelivery Parceiros',
  'FlyBoy',
  'ConectFly',
  'Robô da Loteria',
  'CRM de Prospecção',
  'Barber Connection',
];

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** First-boot content: the two agent templates, planned projects, default alert rules. */
export function seedIfEmpty(store: AgencyStore): void {
  if (store.getKv<boolean>('seeded', false)) return;
  const now = nowIso();
  for (const t of Object.values(AGENT_TEMPLATES)) {
    if (store.agents.get(t.id)) continue;
    const agent: AgentProfile = {
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
      projectId: t.id === 'franklin' ? 'flydelivery' : t.id === 'allyson' ? 'conectfly' : undefined,
      createdAt: now,
      updatedAt: now,
    } as AgentProfile;
    store.agents.put(agent);
  }
  for (const name of PLANNED_PROJECTS) {
    const id = slug(name);
    if (store.projects.get(id)) continue;
    const project: Project = {
      id,
      name,
      description: 'Aguardando conexão do repositório GitHub.',
      team: id === 'flydelivery' ? ['franklin'] : id === 'conectfly' ? ['allyson'] : [],
      authorized: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    store.projects.put(project);
  }
  store.alertRules.put({
    id: 'session-80',
    metric: 'session_percent',
    threshold: 80,
    enabled: true,
  });
  store.alertRules.put({ id: 'weekly-80', metric: 'weekly_percent', threshold: 80, enabled: true });
  store.alertRules.put({ id: 'cost-day', metric: 'cost_usd_day', threshold: 10, enabled: false });
  store.setKv('seeded', true);
}
