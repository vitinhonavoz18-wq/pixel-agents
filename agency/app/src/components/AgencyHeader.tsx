import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { computeAgencyStats } from '../state/agencyStats';
import { selectPendingApprovals, useAgency } from '../state/store';
import { colors } from '../theme/theme';
import { IconButton, Panel, ProgressBar, StatusDot, Txt } from './ui';

const CONN_LABEL = {
  online: 'Conectado',
  connecting: 'Conectando…',
  offline: 'Reconectando…',
  unauthorized: 'Token recusado',
  idle: 'Desconectado',
} as const;
const CONN_COLOR = {
  online: colors.green,
  connecting: colors.amber,
  offline: colors.amber,
  unauthorized: colors.red,
  idle: colors.textDim,
} as const;

export function AgencyLogo({ height = 34 }: { height?: number }) {
  return (
    <Image
      source={require('../../assets/brand/wordmark.png')}
      style={{ height, width: height * (600 / 317) }}
      resizeMode="contain"
      accessibilityLabel="PIXEL AGENCY"
    />
  );
}

export function useAgencyStats() {
  const missions = useAgency((s) => s.missions);
  const agents = useAgency((s) => s.agents);
  const runtimes = useAgency((s) => s.runtimes);
  return useMemo(
    () => computeAgencyStats(Object.values(missions), Object.values(agents), runtimes),
    [missions, agents, runtimes],
  );
}

/** Level + connection + approvals bell. */
export function AgencyHeader({ wide }: { wide: boolean }) {
  const stats = useAgencyStats();
  const connection = useAgency((s) => s.connection);
  const pending = useAgency((s) => selectPendingApprovals(s).length);
  const mode = useAgency((s) => s.mode);
  return (
    <View style={s.wrap}>
      <AgencyLogo height={wide ? 40 : 30} />
      <Panel style={s.level} padded={false}>
        <Ionicons name="star" size={18} color={colors.orange} />
        <View style={s.flex}>
          <Txt size={10} muted>
            Nível da Agência
          </Txt>
          <View style={s.levelRow}>
            <Txt size={16}>{stats.level}</Txt>
            <View style={s.flex}>
              <ProgressBar
                value={(stats.xpIntoLevel / Math.max(1, stats.xpForLevel)) * 100}
                color={colors.orange}
                height={7}
              />
            </View>
          </View>
          <Txt size={9} color={colors.textDim}>
            {stats.xpIntoLevel}/{stats.xpForLevel} XP (missões reais)
          </Txt>
        </View>
      </Panel>
      <View style={s.flex} />
      <Pressable
        style={s.conn}
        onPress={() => router.push('/settings')}
        accessibilityLabel="Status da conexão"
      >
        <StatusDot color={CONN_COLOR[connection]} />
        <View>
          <Txt size={11} color={CONN_COLOR[connection]}>
            {mode === 'demo' ? 'DEMO local' : CONN_LABEL[connection]}
          </Txt>
          <Txt size={9} muted>
            {stats.enabledAgents} agentes
          </Txt>
        </View>
      </Pressable>
      <IconButton
        icon="notifications-outline"
        label="Aprovações pendentes"
        badge={pending}
        onPress={() => router.push('/approvals')}
      />
    </View>
  );
}

/** Produtividade · Tarefas hoje · Agentes ativos. */
export function AgencyStatsRow() {
  const stats = useAgencyStats();
  const items = [
    {
      icon: 'stats-chart' as const,
      label: 'Produtividade',
      value: stats.productivity === null ? '—' : `${stats.productivity}%`,
      color: colors.green,
    },
    {
      icon: 'checkbox' as const,
      label: 'Tarefas hoje',
      value: `${stats.doneToday}/${stats.createdToday}`,
      color: colors.blueSoft,
    },
    {
      icon: 'people' as const,
      label: 'Agentes ativos',
      value: `${stats.activeAgents}/${stats.enabledAgents}`,
      color: colors.orange,
    },
  ];
  return (
    <View style={s.stats}>
      {items.map((it) => (
        <Panel key={it.label} style={s.stat} padded={false}>
          <Ionicons name={it.icon} size={16} color={it.color} />
          <Txt size={9} muted numberOfLines={1}>
            {it.label}
          </Txt>
          <Txt size={15} color={it.color}>
            {it.value}
          </Txt>
        </Panel>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 170,
    backgroundColor: 'rgba(14, 22, 44, 0.94)',
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  conn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 22, 44, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stats: { flexDirection: 'row', gap: 6 },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 74,
    backgroundColor: 'rgba(14, 22, 44, 0.94)',
  },
});
