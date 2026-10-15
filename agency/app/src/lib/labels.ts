import type { Mission, MissionStatus } from '@pixel-agency/shared';

import { colors } from '../theme/theme';

export const STATUS_LABEL: Record<MissionStatus, string> = {
  backlog: 'Backlog',
  queued: 'Na fila',
  running: 'Em execução',
  awaiting_approval: 'Aguardando aprovação',
  testing: 'Testes',
  done: 'Concluída',
  failed: 'Com erro',
  cancelled: 'Cancelada',
};

export const STATUS_COLOR: Record<MissionStatus, string> = {
  backlog: colors.textMuted,
  queued: colors.blueSoft,
  running: colors.blue,
  awaiting_approval: colors.amber,
  testing: colors.orange,
  done: colors.green,
  failed: colors.red,
  cancelled: colors.textDim,
};

/** Kanban columns, in the order the agency works. */
export const KANBAN_COLUMNS: Array<{
  key: string;
  title: string;
  statuses: MissionStatus[];
  color: string;
}> = [
  { key: 'backlog', title: 'Backlog', statuses: ['backlog'], color: colors.textMuted },
  { key: 'running', title: 'Em execução', statuses: ['queued', 'running'], color: colors.blue },
  {
    key: 'approval',
    title: 'Aguardando aprovação',
    statuses: ['awaiting_approval'],
    color: colors.amber,
  },
  { key: 'testing', title: 'Testes', statuses: ['testing'], color: colors.orange },
  { key: 'done', title: 'Concluídas', statuses: ['done'], color: colors.green },
  { key: 'failed', title: 'Com erro', statuses: ['failed', 'cancelled'], color: colors.red },
];

export function isFinished(m: Mission): boolean {
  return m.status === 'done' || m.status === 'failed' || m.status === 'cancelled';
}

export function timeAgo(iso?: string, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

export function clock(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
