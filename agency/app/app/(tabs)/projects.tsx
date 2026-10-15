import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentAvatar } from '../../src/components/AgentAvatar';
import { ProjectLogo } from '../../src/components/ProjectLogo';
import { Chip, DemoBanner, PixelButton, Txt } from '../../src/components/ui';
import { useAgency } from '../../src/state/store';
import { colors } from '../../src/theme/theme';

export default function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const projects = useAgency((s) => s.projects);
  const agents = useAgency((s) => s.agents);
  const missions = useAgency((s) => s.missions);
  const branding = useAgency((s) => s.branding);
  const selected = useAgency((s) => s.selectedProjectId);
  const select = useAgency((s) => s.selectProject);
  const mode = useAgency((s) => s.mode);
  const list = Object.values(projects)
    .filter((p) => !p.archived)
    .sort((a, b) => Number(b.authorized) - Number(a.authorized) || a.name.localeCompare(b.name));
  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      {mode === 'demo' ? <DemoBanner /> : null}
      <View style={s.header}>
        <Txt size={20} style={s.flex}>
          Projetos
        </Txt>
        <PixelButton
          label="Novo"
          icon="add"
          small
          onPress={() => router.push({ pathname: '/project/[id]', params: { id: 'new' } })}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const ms = Object.values(missions).filter(
            (m) => m.projectId === item.id && m.kind === 'task',
          );
          const active = ms.filter((m) =>
            ['queued', 'running', 'testing', 'awaiting_approval'].includes(m.status),
          ).length;
          const accent = branding[item.id]?.theme.primary ?? colors.border;
          return (
            <Pressable
              style={[
                s.card,
                {
                  borderColor: item.id === selected ? colors.orange : colors.border,
                  borderLeftColor: accent,
                },
              ]}
              onPress={() => {
                select(item.id);
                router.push({ pathname: '/project/[id]', params: { id: item.id } });
              }}
            >
              <ProjectLogo projectId={item.id} size={48} />
              <View style={s.flex}>
                <Txt size={16}>{item.name}</Txt>
                <Txt size={11} muted numberOfLines={1}>
                  {item.repo
                    ? `github.com/${item.repo.owner}/${item.repo.name}`
                    : 'Repositório não conectado'}
                </Txt>
                <View style={s.row}>
                  {item.authorized ? (
                    <Chip label="autorizado" color={colors.green} textColor={colors.bgDeep} />
                  ) : (
                    <Chip label="não autorizado" />
                  )}
                  <Chip label={`${active} em execução · ${ms.length} missões`} />
                </View>
                <View style={s.row}>
                  {item.team.map((id) =>
                    agents[id] ? (
                      <AgentAvatar key={id} palette={agents[id].palette} size={24} framed={false} />
                    ) : null,
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  flex: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  list: { gap: 8, paddingBottom: 30, maxWidth: 900, width: '100%', alignSelf: 'center' },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderLeftWidth: 6,
  },
});
