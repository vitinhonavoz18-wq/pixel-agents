import { Ionicons } from '@expo/vector-icons';
import { type ChatMessage, type MissionEvent } from '@pixel-agency/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { AgentActivityRenderer } from '../../src/components/AgentActivityRenderer';
import { AgentAvatar } from '../../src/components/AgentAvatar';
import { ApprovalCard } from '../../src/components/ApprovalCard';
import { ProjectLogo } from '../../src/components/ProjectLogo';
import { Chip, DemoBanner, PixelButton, Txt } from '../../src/components/ui';
import { clock } from '../../src/lib/labels';
import { useShallow } from 'zustand/react/shallow';

import { useAgency } from '../../src/state/store';
import { colors, fonts } from '../../src/theme/theme';

/**
 * Chat with one agent. Each message runs as a `chat` mission on the backend
 * (same isolated workspace, same Claude session resumed), so the tools the
 * agent uses, approvals and errors show up live right here.
 */
export default function ChatScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const agent = useAgency((s) => s.agents[agentId]);
  const runtime = useAgency((s) => s.runtimes[agentId]);
  const messages = useAgency((s) => s.chat[agentId]);
  const projects = useAgency((s) => s.projects);
  const selectedProjectId = useAgency((s) => s.selectedProjectId);
  const api = useAgency((s) => s.api);
  const loadChat = useAgency((s) => s.loadChat);
  const loadEvents = useAgency((s) => s.loadMissionEvents);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [text, setText] = useState('');
  const [newSession, setNewSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const effectiveProject = projectId ?? agent?.projectId ?? selectedProjectId ?? undefined;
  const activeMission = useAgency(
    (s) =>
      Object.values(s.missions)
        .filter(
          (m) =>
            m.agentId === agentId &&
            m.kind === 'chat' &&
            ['queued', 'running', 'testing', 'awaiting_approval'].includes(m.status),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
  );
  const events = useAgency((s) => (activeMission ? s.missionEvents[activeMission.id] : undefined));
  const approvals = useAgency(
    useShallow((s) =>
      Object.values(s.approvals).filter((a) => a.agentId === agentId && a.status === 'pending'),
    ),
  );

  useEffect(() => {
    void loadChat(agentId).catch((e: Error) => setError(e.message));
  }, [agentId, loadChat]);

  useEffect(() => {
    if (activeMission) void loadEvents(activeMission.id).catch(() => undefined);
  }, [activeMission?.id, loadEvents]);

  const tools = useMemo(() => {
    const ended = new Set(
      (events ?? [])
        .filter((e) => e.kind === 'tool_end')
        .map((e) => (e as Extract<MissionEvent, { kind: 'tool_end' }>).toolUseId),
    );
    return (events ?? [])
      .filter((e): e is Extract<MissionEvent, { kind: 'tool_start' }> => e.kind === 'tool_start')
      .slice(-6)
      .map((e) => ({ ...e, done: ended.has(e.toolUseId) }));
  }, [events]);

  const send = async () => {
    if (!api || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendChat(agentId, { text: text.trim(), projectId: effectiveProject, newSession });
      setText('');
      setNewSession(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (api && activeMission)
      await api.missionAction(activeMission.id, 'cancel').catch((e: Error) => setError(e.message));
  };

  if (!agent) return null;
  const projectList = Object.values(projects).filter((p) => !p.archived);

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              style={s.headerTitle}
              onPress={() => router.push({ pathname: '/agent/[id]', params: { id: agentId } })}
            >
              <AgentAvatar palette={agent.palette} size={30} />
              <View>
                <Txt size={14}>{agent.name}</Txt>
                <Txt size={9} muted>
                  {agent.role}
                </Txt>
              </View>
            </Pressable>
          ),
        }}
      />
      {messages?.some((m) => m.demo) ? <DemoBanner /> : null}
      <View style={s.bar}>
        <AgentActivityRenderer
          activity={runtime?.activity ?? 'idle'}
          statusText={runtime?.statusText}
          demo={runtime?.demo}
          compact
        />
      </View>
      <FlatList
        horizontal
        data={projectList}
        keyExtractor={(p) => p.id}
        style={s.projects}
        contentContainerStyle={s.projectsInner}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setProjectId(item.id)}
            style={[s.projectChip, effectiveProject === item.id && s.projectChipOn]}
          >
            <ProjectLogo projectId={item.id} size={16} />
            <Txt size={11}>{item.name}</Txt>
          </Pressable>
        )}
      />
      <FlatList
        ref={listRef}
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Txt size={12} muted style={s.emptyText}>
            Escreva uma instrução para {agent.name}. Ex.: “{agent.name}, faça uma auditoria nas
            automações de pagamento e pedidos do projeto.”
          </Txt>
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <View style={[s.msgRow, mine && s.msgRowMine]}>
              {!mine ? <AgentAvatar palette={agent.palette} size={28} framed={false} /> : null}
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleAgent]}>
                <Txt size={10} muted>
                  {mine ? 'Você' : agent.name} · {clock(item.ts)}
                  {item.projectId ? ` · ${projects[item.projectId]?.name ?? item.projectId}` : ''}
                  {item.demo ? ' · DEMO' : ''}
                </Txt>
                <Txt size={13} selectable>
                  {item.text || (item.streaming ? '…' : '')}
                  {item.streaming ? '▍' : ''}
                </Txt>
                {!mine && item.missionId && !item.streaming ? (
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/mission/[id]', params: { id: item.missionId! } })
                    }
                  >
                    <Txt size={10} color={colors.blueSoft}>
                      ver ferramentas, alterações e logs →
                    </Txt>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={s.footer}>
            {tools.length > 0 && activeMission ? (
              <View style={s.tools}>
                <Txt size={10} muted>
                  Ferramentas em uso
                </Txt>
                {tools.map((t) => (
                  <View key={t.seq} style={s.toolRow}>
                    <Ionicons
                      name={t.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={12}
                      color={t.done ? colors.green : colors.orange}
                    />
                    <Txt size={11} numberOfLines={1} style={s.flex}>
                      {t.statusText}
                    </Txt>
                  </View>
                ))}
              </View>
            ) : null}
            {approvals.map((a) => (
              <ApprovalCard key={a.id} approval={a} />
            ))}
          </View>
        }
      />
      {error ? (
        <Txt size={12} color={colors.red} style={s.error}>
          {error}
        </Txt>
      ) : null}
      <View style={s.composer}>
        <View style={s.composerOpts}>
          <Switch
            value={newSession}
            onValueChange={setNewSession}
            trackColor={{ true: colors.orange, false: colors.border }}
          />
          <Txt size={10} muted style={s.flex}>
            {newSession
              ? 'Nova sessão (sem memória da conversa anterior)'
              : 'Continuar a sessão anterior'}
          </Txt>
          {activeMission ? (
            <Chip
              label="respondendo"
              icon="pulse"
              color={colors.panelHi}
              textColor={colors.orange}
            />
          ) : null}
        </View>
        <View style={s.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`Mensagem para ${agent.name}…`}
            placeholderTextColor={colors.textDim}
            multiline
            style={s.input}
            editable={!activeMission}
          />
          {activeMission ? (
            <PixelButton icon="stop" a11yLabel="Parar resposta" variant="danger" onPress={cancel} />
          ) : (
            <PixelButton
              icon="send"
              a11yLabel="Enviar"
              variant="primary"
              onPress={send}
              busy={busy}
              disabled={!text.trim() || !effectiveProject}
            />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  projects: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  projectsInner: { gap: 6, padding: 8 },
  projectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectChipOn: { borderColor: colors.orange, backgroundColor: colors.panelHi },
  messages: { padding: 12, gap: 10, maxWidth: 900, width: '100%', alignSelf: 'center' },
  emptyText: { textAlign: 'center', marginTop: 40 },
  msgRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  msgRowMine: { justifyContent: 'flex-end' },
  bubble: { padding: 8, maxWidth: '85%', borderWidth: 2, gap: 4 },
  bubbleMine: { backgroundColor: '#1d3a6e', borderColor: colors.blue },
  bubbleAgent: { backgroundColor: colors.panelAlt, borderColor: colors.border, flexShrink: 1 },
  footer: { gap: 8 },
  tools: { gap: 3, backgroundColor: colors.bgDeep, padding: 8 },
  toolRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  error: { paddingHorizontal: 12 },
  composer: {
    borderTopWidth: 2,
    borderTopColor: colors.border,
    padding: 8,
    gap: 6,
    backgroundColor: colors.panel,
  },
  composerOpts: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: {
    flex: 1,
    maxHeight: 140,
    minHeight: 44,
    backgroundColor: colors.bgDeep,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.pixel,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
