import Ionicons from '@expo/vector-icons/Ionicons';
import { departmentName, type ProjectPreview } from '@pixel-agency/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { STATUS_COLOR, STATUS_LABEL } from '../lib/labels';
import { useAgency } from '../state/store';
import { useThemeForProject } from '../theme/ProjectThemeProvider';
import { colors } from '../theme/theme';
import { AgentActivityRenderer } from './AgentActivityRenderer';
import { AgentAvatar } from './AgentAvatar';
import { ProjectLogo } from './ProjectLogo';
import { ProjectMediaViewer } from './ProjectMediaViewer';
import { Chip, Panel, PixelButton, StatusDot, Txt } from './ui';

/**
 * "Agente selecionado" — opened by tapping a character in the office.
 * Everything here is the agent's real state: activity from backend events,
 * its current mission, and its project's real interface on the "monitor".
 */
export function AgentPanel({ agentId, onClose }: { agentId: string; onClose?: () => void }) {
  const agent = useAgency((s) => s.agents[agentId]);
  const runtime = useAgency((s) => s.runtimes[agentId]);
  const missionsDone = useAgency(
    (s) =>
      Object.values(s.missions).filter(
        (m) => m.agentId === agentId && m.status === 'done' && !m.demo,
      ).length,
  );
  const currentMission = useAgency((s) =>
    runtime?.missionId ? s.missions[runtime.missionId] : undefined,
  );
  const projectId = runtime?.projectId ?? agent?.projectId;
  const project = useAgency((s) => (projectId ? s.projects[projectId] : undefined));
  const previews = useAgency((s) => (projectId ? s.previews[projectId] : undefined));
  const loadPreviews = useAgency((s) => s.loadPreviews);
  const api = useAgency((s) => s.api);
  const theme = useThemeForProject(projectId);
  const [viewer, setViewer] = useState<ProjectPreview | null>(null);

  useEffect(() => {
    if (projectId && !previews) void loadPreviews(projectId).catch(() => undefined);
  }, [projectId, previews, loadPreviews]);

  if (!agent) return null;
  const activity = runtime?.activity ?? (agent.enabled ? 'idle' : 'offline');
  const monitor = previews?.find((p) => p.agentId === agentId) ?? previews?.[0];
  const online = agent.enabled;
  return (
    <Panel style={s.panel}>
      <View style={s.header}>
        <Ionicons name="star" size={14} color={colors.orange} />
        <Txt size={12} muted style={s.flex}>
          Agente selecionado
        </Txt>
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fechar painel do agente">
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={s.row}>
        <AgentAvatar palette={agent.palette} size={64} />
        <View style={s.flex}>
          <View style={s.nameRow}>
            <Txt size={18}>{agent.name}</Txt>
            <StatusDot color={online ? colors.green : colors.textDim} />
            <View style={s.flex} />
            <Chip label={`${missionsDone} missões`} />
          </View>
          <AgentActivityRenderer activity={activity} demo={runtime?.demo} compact />
          <Txt size={11} muted numberOfLines={1}>
            {agent.role} · {departmentName(agent.department)}
          </Txt>
        </View>
      </View>

      <Pressable
        style={[s.projectBox, { borderColor: theme.accent }]}
        onPress={() =>
          projectId && router.push({ pathname: '/project/[id]', params: { id: projectId } })
        }
      >
        <ProjectLogo projectId={projectId} size={28} />
        <View style={s.flex}>
          <Txt size={9} muted>
            Projeto atual
          </Txt>
          <Txt size={13}>{project?.name ?? 'Sem projeto'}</Txt>
        </View>
        {currentMission ? (
          <Chip
            label={STATUS_LABEL[currentMission.status]}
            color={colors.panelHi}
            textColor={STATUS_COLOR[currentMission.status]}
          />
        ) : null}
      </Pressable>

      {runtime?.statusText ? (
        <View style={s.statusBox}>
          <Ionicons name="settings-outline" size={18} color={colors.blueSoft} />
          <View style={s.flex}>
            <Txt size={12} numberOfLines={2}>
              {runtime.statusText}
            </Txt>
            {currentMission ? (
              <Txt size={10} muted numberOfLines={1}>
                {currentMission.title}
              </Txt>
            ) : null}
          </View>
        </View>
      ) : null}

      <Pressable
        style={s.monitor}
        onPress={() => monitor && setViewer(monitor)}
        disabled={!monitor}
        accessibilityLabel="Monitor do agente"
      >
        {monitor ? (
          <>
            <Image
              source={{ uri: api?.assetUrl(monitor.url) }}
              style={s.monitorImg}
              contentFit="cover"
            />
            <Txt size={10} muted numberOfLines={1}>
              🖥 {monitor.title}
            </Txt>
          </>
        ) : (
          <Txt size={10} color={colors.textDim}>
            🖥 Nenhuma tela real deste projeto ainda (extraia do repositório ou envie uma imagem em
            Projetos).
          </Txt>
        )}
      </Pressable>

      <View style={s.actions}>
        <PixelButton
          label="Conversar"
          icon="chatbubble-ellipses-outline"
          small
          style={s.flex}
          onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId } })}
        />
        <PixelButton
          label="Atribuir tarefa"
          icon="add"
          small
          style={s.flex}
          onPress={() =>
            router.push({
              pathname: '/mission/new',
              params: { agentId, projectId: projectId ?? '' },
            })
          }
        />
        <PixelButton
          label="Acompanhar"
          icon="stats-chart-outline"
          small
          style={s.flex}
          onPress={() =>
            currentMission
              ? router.push({ pathname: '/mission/[id]', params: { id: currentMission.id } })
              : router.push({ pathname: '/agent/[id]', params: { id: agentId } })
          }
        />
      </View>
      <ProjectMediaViewer preview={viewer} onClose={() => setViewer(null)} />
    </Panel>
  );
}

const s = StyleSheet.create({
  panel: { gap: 8, backgroundColor: 'rgba(14, 22, 44, 0.96)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  projectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    padding: 8,
    backgroundColor: colors.panelAlt,
  },
  statusBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.panelAlt,
    padding: 8,
  },
  monitor: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
    gap: 4,
  },
  monitorImg: { width: '100%', height: 90 },
  actions: { flexDirection: 'row', gap: 6 },
});
