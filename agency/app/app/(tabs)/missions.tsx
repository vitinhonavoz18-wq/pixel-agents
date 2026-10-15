import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApprovalCard } from '../../src/components/ApprovalCard';
import { KanbanBoard } from '../../src/components/KanbanBoard';
import { ProjectLogo } from '../../src/components/ProjectLogo';
import { DemoBanner, EmptyState, PixelButton, SectionTitle, Txt } from '../../src/components/ui';
import { useShallow } from 'zustand/react/shallow';

import { selectPendingApprovals, useAgency } from '../../src/state/store';
import { useProjectTheme } from '../../src/theme/ProjectThemeProvider';
import { colors, TABLET_MIN_WIDTH } from '../../src/theme/theme';

export default function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useProjectTheme();
  const mode = useAgency((s) => s.mode);
  const missions = useAgency((s) => s.missions);
  const pending = useAgency(useShallow((s) => selectPendingApprovals(s)));
  const [scope, setScope] = useState<'project' | 'all'>('project');
  const list = Object.values(missions).filter(
    (m) => scope === 'all' || !theme.projectId || m.projectId === theme.projectId,
  );
  const columnWidth = width >= TABLET_MIN_WIDTH ? Math.max(200, (width - 80) / 6) : 230;

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      {mode === 'demo' ? <DemoBanner /> : null}
      <View style={[s.header, { borderBottomColor: theme.accent }]}>
        {scope === 'project' ? (
          <ProjectLogo projectId={theme.projectId ?? undefined} size={30} />
        ) : null}
        <View style={s.flex}>
          <Txt size={20}>Missões</Txt>
          <Txt size={11} muted>
            {scope === 'project' ? theme.projectName || 'Projeto' : 'Todos os projetos'}
          </Txt>
        </View>
        <PixelButton
          label={scope === 'project' ? 'Todos' : 'Só o projeto'}
          small
          variant="ghost"
          onPress={() => setScope(scope === 'project' ? 'all' : 'project')}
        />
        <PixelButton
          label="Nova missão"
          icon="add"
          variant="primary"
          small
          onPress={() =>
            router.push({ pathname: '/mission/new', params: { projectId: theme.projectId ?? '' } })
          }
        />
      </View>

      {pending.length > 0 ? (
        <View style={s.section}>
          <SectionTitle
            title={`Aguardando sua aprovação (${pending.length})`}
            icon="hand-left-outline"
          />
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </View>
      ) : null}

      {list.filter((m) => m.kind === 'task').length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="Nenhuma missão ainda"
          body="Delegue uma tarefa a um agente: ele trabalhará num workspace isolado do repositório autorizado."
          action={
            <PixelButton
              label="Criar missão"
              icon="add"
              variant="primary"
              onPress={() => router.push('/mission/new')}
            />
          }
        />
      ) : (
        <KanbanBoard missions={list} columnWidth={columnWidth} />
      )}
      <Txt size={10} color={colors.textDim}>
        Conversas de chat também rodam como missões e aparecem no histórico de cada agente.
      </Txt>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 2,
    paddingBottom: 8,
  },
  flex: { flex: 1 },
  section: { gap: 8 },
});
