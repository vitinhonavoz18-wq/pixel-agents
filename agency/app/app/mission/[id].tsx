import Ionicons from '@expo/vector-icons/Ionicons';
import {
  activityForTool,
  formatTokens,
  formatUsd,
  type MissionEvent,
  totalTokens,
} from '@pixel-agency/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { MissionDiff } from '../../src/api/types';
import { ACTIVITY_STYLE } from '../../src/components/AgentActivityRenderer';
import { AgentAvatar } from '../../src/components/AgentAvatar';
import { ApprovalCard } from '../../src/components/ApprovalCard';
import { ProjectLogo } from '../../src/components/ProjectLogo';
import {
  Chip,
  DemoBanner,
  EmptyState,
  KeyValue,
  Panel,
  PixelButton,
  SectionTitle,
  Txt,
} from '../../src/components/ui';
import { clock, isFinished, STATUS_COLOR, STATUS_LABEL } from '../../src/lib/labels';
import { useShallow } from 'zustand/react/shallow';

import { useAgency } from '../../src/state/store';
import { useThemeForProject } from '../../src/theme/ProjectThemeProvider';
import { colors } from '../../src/theme/theme';

type Tab = 'etapas' | 'resultado' | 'alteracoes' | 'logs';

export default function MissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mission = useAgency((s) => s.missions[id]);
  const agent = useAgency((s) => (mission ? s.agents[mission.agentId] : undefined));
  const project = useAgency((s) => (mission ? s.projects[mission.projectId] : undefined));
  const events = useAgency((s) => s.missionEvents[id]);
  const streaming = useAgency((s) => s.streaming[id]);
  const approvals = useAgency(
    useShallow((s) => Object.values(s.approvals).filter((a) => a.missionId === id)),
  );
  const loadEvents = useAgency((s) => s.loadMissionEvents);
  const api = useAgency((s) => s.api);
  const theme = useThemeForProject(mission?.projectId);
  const [tab, setTab] = useState<Tab>('etapas');
  const [diff, setDiff] = useState<MissionDiff | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadEvents(id).catch((e: Error) => setError(e.message));
  }, [id, loadEvents, mission?.status]);

  useEffect(() => {
    if (tab === 'alteracoes' && api && mission)
      void api
        .missionDiff(mission.id)
        .then(setDiff)
        .catch((e: Error) => setError(e.message));
  }, [tab, api, mission?.id, mission?.status]);

  const act = useCallback(
    async (action: 'start' | 'cancel' | 'retry') => {
      if (!api) return;
      setBusy(action);
      setError(null);
      try {
        await api.missionAction(id, action);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [api, id],
  );

  if (!mission) return <EmptyState icon="search-outline" title="Missão não encontrada" />;
  const finished = isFinished(mission);
  const toolEnds = new Map(
    (events ?? [])
      .filter((e): e is Extract<MissionEvent, { kind: 'tool_end' }> => e.kind === 'tool_end')
      .map((e) => [e.toolUseId, e]),
  );
  const steps = (events ?? []).filter(
    (e): e is Extract<MissionEvent, { kind: 'tool_start' }> => e.kind === 'tool_start',
  );
  const logs = (events ?? []).filter(
    (e) =>
      e.kind === 'log' ||
      e.kind === 'status' ||
      e.kind === 'approval_requested' ||
      e.kind === 'approval_resolved',
  );

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: mission.kind === 'chat' ? 'Conversa' : 'Missão' }} />
      {mission.demo ? <DemoBanner /> : null}
      <Panel accent={theme.accent} style={s.headCard}>
        <View style={s.row}>
          <ProjectLogo projectId={mission.projectId} size={34} />
          <View style={s.flex}>
            <Txt size={17}>{mission.title}</Txt>
            <Txt size={11} muted>
              {project?.name} {mission.branch ? `· branch ${mission.branch}` : ''}
            </Txt>
          </View>
          <Chip
            label={STATUS_LABEL[mission.status]}
            color={STATUS_COLOR[mission.status]}
            textColor={colors.bgDeep}
          />
        </View>
        <View style={s.row}>
          {agent ? <AgentAvatar palette={agent.palette} size={36} /> : null}
          <View style={s.flex}>
            <Txt size={13}>{agent?.name ?? mission.agentId}</Txt>
            <Txt size={10} muted>
              {agent?.role}
            </Txt>
          </View>
          <View style={s.actions}>
            {mission.status === 'backlog' ? (
              <PixelButton
                label="Iniciar"
                icon="play"
                small
                variant="primary"
                busy={busy === 'start'}
                onPress={() => act('start')}
              />
            ) : null}
            {!finished && mission.status !== 'backlog' ? (
              <PixelButton
                label="Cancelar"
                icon="stop"
                small
                variant="danger"
                busy={busy === 'cancel'}
                onPress={() => act('cancel')}
              />
            ) : null}
            {mission.status === 'failed' || mission.status === 'cancelled' ? (
              <PixelButton
                label="Repetir"
                icon="refresh"
                small
                busy={busy === 'retry'}
                onPress={() => act('retry')}
              />
            ) : null}
          </View>
        </View>
        <KeyValue label="Objetivo" value={mission.objective} />
        <KeyValue
          label="Criada"
          value={`${new Date(mission.createdAt).toLocaleDateString('pt-BR')} ${clock(mission.createdAt)} por ${mission.createdBy}`}
        />
        {mission.startedAt ? (
          <KeyValue
            label="Início / fim"
            value={`${clock(mission.startedAt)} → ${clock(mission.finishedAt)}`}
          />
        ) : null}
        <KeyValue
          label="Consumo"
          value={`${formatTokens(totalTokens(mission.usage))} tokens · ${formatUsd(mission.usage.costUsd)} (estimativa do SDK)${mission.model ? ` · ${mission.model}` : ''}${mission.numTurns ? ` · ${mission.numTurns} turnos` : ''}`}
        />
        {error ? (
          <Txt size={12} color={colors.red}>
            {error}
          </Txt>
        ) : null}
      </Panel>

      {approvals
        .filter((a) => a.status === 'pending')
        .map((a) => (
          <ApprovalCard key={a.id} approval={a} />
        ))}

      <View style={s.tabs}>
        {(
          [
            ['etapas', 'Etapas'],
            ['resultado', 'Resultado'],
            ['alteracoes', 'Alterações'],
            ['logs', 'Logs'],
          ] as Array<[Tab, string]>
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
            <Txt size={12} color={tab === k ? colors.orange : colors.textMuted}>
              {label}
            </Txt>
          </Pressable>
        ))}
      </View>

      {tab === 'etapas' ? (
        <Panel style={s.gap}>
          {steps.length === 0 ? (
            <Txt size={12} muted>
              {finished
                ? 'Nenhuma ferramenta foi usada.'
                : 'Aguardando as primeiras ações do agente…'}
            </Txt>
          ) : (
            steps.map((st) => {
              const end = toolEnds.get(st.toolUseId);
              const style = ACTIVITY_STYLE[activityForTool(st.toolName, st.input)];
              return (
                <View key={st.seq} style={s.step}>
                  <Ionicons
                    name={end ? (end.isError ? 'close-circle' : 'checkmark-circle') : style.icon}
                    size={16}
                    color={end ? (end.isError ? colors.red : colors.green) : style.color}
                  />
                  <View style={s.flex}>
                    <Txt size={12}>{st.statusText}</Txt>
                    <Txt size={9} color={colors.textDim}>
                      {st.toolName} · {clock(st.ts)}
                    </Txt>
                    {end?.output ? (
                      <View style={s.code}>
                        <Txt
                          size={10}
                          color={end.isError ? colors.red : colors.blueSoft}
                          numberOfLines={8}
                        >
                          {end.output}
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
          {streaming ? (
            <View style={s.code}>
              <Txt size={11}>{streaming}▍</Txt>
            </View>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'resultado' ? (
        <Panel style={s.gap}>
          <SectionTitle title="Relatório do agente" icon="document-text-outline" />
          {mission.result ? (
            <Txt size={13}>{mission.result}</Txt>
          ) : (
            <Txt size={12} muted>
              {finished ? 'Sem relatório.' : 'O relatório aparece quando a missão termina.'}
            </Txt>
          )}
          {mission.error && mission.error !== mission.result ? (
            <Txt size={12} color={colors.red}>
              {mission.error}
            </Txt>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'alteracoes' ? (
        <Panel style={s.gap}>
          <SectionTitle title="Alterações no workspace" icon="git-compare-outline" />
          {!diff ? (
            <Txt size={12} muted>
              Carregando…
            </Txt>
          ) : diff.stat || diff.patch ? (
            <>
              <View style={s.code}>
                <Txt size={10}>{diff.stat}</Txt>
              </View>
              <ScrollView horizontal style={s.code}>
                <View>
                  {diff.patch
                    .split('\n')
                    .slice(0, 1500)
                    .map((line, i) => (
                      <Txt
                        key={i}
                        size={10}
                        color={
                          line.startsWith('+')
                            ? colors.green
                            : line.startsWith('-')
                              ? colors.red
                              : line.startsWith('@@')
                                ? colors.purple
                                : colors.textMuted
                        }
                      >
                        {line || ' '}
                      </Txt>
                    ))}
                </View>
              </ScrollView>
              <Txt size={10} color={colors.textDim}>
                As alterações ficam na branch {mission.branch} do workspace isolado; nada é enviado
                ao GitHub sem a sua aprovação.
              </Txt>
            </>
          ) : (
            <Txt size={12} muted>
              {finished
                ? 'Nenhum arquivo foi alterado.'
                : 'O diff fica disponível ao fim da missão.'}
            </Txt>
          )}
        </Panel>
      ) : null}

      {tab === 'logs' ? (
        <Panel style={s.gap}>
          {logs.map((e) => (
            <Txt
              key={e.seq}
              size={11}
              color={
                e.kind === 'log' && e.level === 'error'
                  ? colors.red
                  : e.kind === 'log' && e.level === 'warn'
                    ? colors.amber
                    : colors.textMuted
              }
            >
              {clock(e.ts)}{' '}
              {e.kind === 'log'
                ? e.message
                : e.kind === 'status'
                  ? `status → ${STATUS_LABEL[e.status]}${e.note ? ` (${e.note})` : ''}`
                  : e.kind === 'approval_requested'
                    ? `aprovação solicitada: ${e.summary}`
                    : e.kind === 'approval_resolved'
                      ? `aprovação: ${e.decision}`
                      : ''}
            </Txt>
          ))}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  headCard: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 6 },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  tabOn: { borderBottomColor: colors.orange },
  gap: { gap: 8 },
  step: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  code: { backgroundColor: colors.bgDeep, padding: 6, marginTop: 4 },
});
