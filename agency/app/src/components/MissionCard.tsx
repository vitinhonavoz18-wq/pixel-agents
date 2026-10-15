import type { Mission } from '@pixel-agency/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { STATUS_COLOR, STATUS_LABEL, timeAgo } from '../lib/labels';
import { useAgency } from '../state/store';
import { colors } from '../theme/theme';
import { AgentAvatar } from './AgentAvatar';
import { ProjectLogo } from './ProjectLogo';
import { Chip, Txt } from './ui';

export function MissionCard({ mission, compact }: { mission: Mission; compact?: boolean }) {
  const agent = useAgency((s) => s.agents[mission.agentId]);
  const runtime = useAgency((s) => s.runtimes[mission.agentId]);
  const project = useAgency((s) => s.projects[mission.projectId]);
  const live = runtime?.missionId === mission.id ? runtime.statusText : '';
  const active = ['running', 'testing', 'awaiting_approval'].includes(mission.status);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/mission/[id]', params: { id: mission.id } })}
      style={({ pressed }) => [
        s.card,
        { borderLeftColor: STATUS_COLOR[mission.status] },
        pressed && s.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Missão ${mission.title}, ${STATUS_LABEL[mission.status]}`}
    >
      <View style={s.head}>
        <ProjectLogo projectId={mission.projectId} size={16} />
        <Txt size={12} numberOfLines={compact ? 2 : 3} style={s.flex}>
          {mission.title}
        </Txt>
      </View>
      {!compact ? (
        <Txt size={10} muted numberOfLines={1}>
          {project?.name ?? mission.projectId} · {timeAgo(mission.updatedAt)}
        </Txt>
      ) : null}
      <View style={s.foot}>
        {agent ? <AgentAvatar palette={agent.palette} size={22} framed={false} /> : null}
        <View style={s.flex}>
          <Chip
            label={STATUS_LABEL[mission.status]}
            icon={active ? 'pulse' : undefined}
            color={colors.panelHi}
            textColor={STATUS_COLOR[mission.status]}
          />
        </View>
        {mission.demo ? <Chip label="DEMO" color={colors.demo} textColor="#fff" /> : null}
      </View>
      {live && !compact ? (
        <Txt size={10} color={colors.blueSoft} numberOfLines={1}>
          {live}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.panelAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: 8,
    gap: 5,
  },
  pressed: { opacity: 0.8 },
  head: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
});
