import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgencyHeader, AgencyLogo, AgencyStatsRow } from '../../src/components/AgencyHeader';
import { AgentActivityRenderer } from '../../src/components/AgentActivityRenderer';
import { AgentAvatar } from '../../src/components/AgentAvatar';
import { AgentPanel } from '../../src/components/AgentPanel';
import { ChatPreview } from '../../src/components/ChatPreview';
import { ClaudeUsageDashboard } from '../../src/components/ClaudeUsageDashboard';
import { KanbanBoard } from '../../src/components/KanbanBoard';
import { ProjectLogo } from '../../src/components/ProjectLogo';
import { ProjectSelector } from '../../src/components/ProjectSelector';
import { DemoBanner, Panel, PixelButton, SectionTitle, Txt } from '../../src/components/ui';
import { OfficeView } from '../../src/office/OfficeView';
import { useAgency } from '../../src/state/store';
import { useProjectTheme } from '../../src/theme/ProjectThemeProvider';
import { colors, TABLET_MIN_WIDTH } from '../../src/theme/theme';

/**
 * Agência — the game screen. The pixel office fills the screen; HUD panels
 * float over it (collapsible on phones, docked on tablets).
 */
export default function AgencyScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= TABLET_MIN_WIDTH;
  const mode = useAgency((s) => s.mode);
  const connection = useAgency((s) => s.connection);
  const selectedAgentId = useAgency((s) => s.selectedAgentId);
  const selectAgent = useAgency((s) => s.selectAgent);
  const agents = useAgency((s) => s.agents);
  const runtimes = useAgency((s) => s.runtimes);
  const missions = useAgency((s) => s.missions);
  const loadChat = useAgency((s) => s.loadChat);
  const theme = useProjectTheme();
  const [hudOpen, setHudOpen] = useState(true);

  // Pull recent chat history once connected, for the "Chat da Agência" preview.
  const agentIds = Object.keys(agents).join(',');
  useEffect(() => {
    if (connection !== 'online') return;
    for (const id of agentIds.split(',').filter(Boolean)) void loadChat(id).catch(() => undefined);
  }, [connection, agentIds, loadChat]);

  if (mode === 'unset') return <Welcome />;

  const roster = Object.values(agents).filter((a) => a.enabled);
  const projectMissions = Object.values(missions).filter(
    (m) => !theme.projectId || m.projectId === theme.projectId,
  );

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill}>
        <OfficeView />
      </View>

      <View style={[s.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        {mode === 'demo' ? <DemoBanner /> : null}
        <AgencyHeader wide={wide} />
        {hudOpen ? (
          <View style={[s.hudRow, !wide && s.hudRowPhone]} pointerEvents="box-none">
            <View style={wide ? s.usageWide : s.usagePhone}>
              <ClaudeUsageDashboard defaultOpen={wide} />
            </View>
            <View style={s.hudRight} pointerEvents="box-none">
              <ProjectSelector />
              <AgencyStatsRow />
              {wide ? (
                <View style={s.sideDock} pointerEvents="box-none">
                  {selectedAgentId && agents[selectedAgentId] ? (
                    <AgentPanel agentId={selectedAgentId} onClose={() => selectAgent(null)} />
                  ) : (
                    <Roster agents={roster.map((a) => a.id)} />
                  )}
                  <ChatPreview />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        <Pressable
          onPress={() => setHudOpen((o) => !o)}
          style={s.hudToggle}
          accessibilityLabel={hudOpen ? 'Recolher painéis' : 'Expandir painéis'}
        >
          <Txt size={10} muted>
            {hudOpen ? '▲ recolher' : '▼ painéis'}
          </Txt>
        </Pressable>
      </View>

      <View style={[s.bottom, { paddingBottom: 8 }]} pointerEvents="box-none">
        {wide ? (
          <Panel style={s.kanbanDock} padded={false}>
            <View style={s.kanbanHead}>
              <ProjectLogo projectId={theme.projectId ?? undefined} size={18} />
              <Txt size={13} style={s.flex}>
                Quadro do Projeto{theme.projectName ? ` – ${theme.projectName}` : ''}
              </Txt>
              <Pressable onPress={() => router.push('/missions')}>
                <Txt size={11} color={colors.blueSoft}>
                  Ver tudo
                </Txt>
              </Pressable>
            </View>
            <KanbanBoard missions={projectMissions} compact columnWidth={150} maxPerColumn={2} />
          </Panel>
        ) : selectedAgentId && agents[selectedAgentId] ? (
          <AgentPanel agentId={selectedAgentId} onClose={() => selectAgent(null)} />
        ) : (
          <ScrollView
            horizontal
            contentContainerStyle={s.chips}
            showsHorizontalScrollIndicator={false}
          >
            {roster.map((a) => (
              <Pressable
                key={a.id}
                style={s.agentChip}
                onPress={() => selectAgent(a.id)}
                accessibilityLabel={`Selecionar ${a.name}`}
              >
                <AgentAvatar palette={a.palette} size={30} framed={false} />
                <View>
                  <Txt size={12}>{a.name}</Txt>
                  <AgentActivityRenderer activity={runtimes[a.id]?.activity ?? 'idle'} compact />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function Roster({ agents }: { agents: string[] }) {
  const all = useAgency((s) => s.agents);
  const runtimes = useAgency((s) => s.runtimes);
  const selectAgent = useAgency((s) => s.selectAgent);
  return (
    <Panel style={s.roster}>
      <SectionTitle
        title="Equipe"
        icon="people-outline"
        right={
          <PixelButton
            label="Novo"
            icon="add"
            small
            onPress={() => router.push({ pathname: '/agent/[id]', params: { id: 'new' } })}
          />
        }
      />
      {agents.map((id) => {
        const a = all[id];
        return (
          <Pressable key={id} style={s.rosterItem} onPress={() => selectAgent(id)}>
            <AgentAvatar palette={a.palette} size={32} />
            <View style={s.flex}>
              <Txt size={13}>{a.name}</Txt>
              <AgentActivityRenderer
                activity={runtimes[id]?.activity ?? 'idle'}
                statusText={runtimes[id]?.statusText}
                compact
              />
            </View>
          </Pressable>
        );
      })}
      <Txt size={10} color={colors.textDim}>
        Toque em um personagem no escritório para ver o painel do agente.
      </Txt>
    </Panel>
  );
}

function Welcome() {
  const configure = useAgency((s) => s.configure);
  return (
    <ScrollView contentContainerStyle={s.welcome}>
      <AgencyLogo height={120} />
      <Txt size={18} style={s.center}>
        IA trabalhando por grandes ideias
      </Txt>
      <Panel style={s.welcomeCard}>
        <Txt size={14}>Conectar ao backend PIXEL AGENCY</Txt>
        <Txt size={12} muted>
          Execução real dos agentes Claude na nuvem, com aprovações, missões e relatórios. Requer o
          backend publicado e um token de acesso.
        </Txt>
        <PixelButton
          label="Configurar conexão"
          icon="cloud-outline"
          variant="primary"
          onPress={() => router.push('/settings')}
        />
      </Panel>
      <Panel style={s.welcomeCard}>
        <Txt size={14}>Explorar em MODO DEMO</Txt>
        <Txt size={12} muted>
          Simulação local, sem servidor e sem Claude. Tudo o que aparecer será marcado como DEMO —
          nenhum trabalho real é executado.
        </Txt>
        <PixelButton
          label="Abrir modo DEMO"
          icon="flask-outline"
          onPress={() => void configure({ mode: 'demo' })}
        />
      </Panel>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 8, gap: 6 },
  hudRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  hudRowPhone: { flexDirection: 'column' },
  usageWide: { width: 280 },
  usagePhone: { alignSelf: 'stretch' },
  hudRight: { flex: 1, gap: 6, alignItems: 'flex-end' },
  hudToggle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(7, 12, 25, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  sideDock: { width: 340, gap: 8 },
  bottom: { position: 'absolute', left: 8, right: 8, bottom: 0, gap: 6 },
  kanbanDock: { padding: 8, gap: 6, maxWidth: 1000, backgroundColor: 'rgba(14, 22, 44, 0.95)' },
  kanbanHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { gap: 6 },
  agentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 22, 44, 0.95)',
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roster: { gap: 8, backgroundColor: 'rgba(14, 22, 44, 0.96)' },
  rosterItem: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  welcome: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 14,
    backgroundColor: colors.bg,
  },
  welcomeCard: { width: '100%', maxWidth: 520, gap: 8 },
});
