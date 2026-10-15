import { departmentName } from '@pixel-agency/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentActivityRenderer } from '../../src/components/AgentActivityRenderer';
import { AgentAvatar } from '../../src/components/AgentAvatar';
import { DemoBanner, EmptyState, PixelButton, Txt } from '../../src/components/ui';
import { clock } from '../../src/lib/labels';
import { useAgency } from '../../src/state/store';
import { colors } from '../../src/theme/theme';

export default function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const agents = useAgency((s) => s.agents);
  const runtimes = useAgency((s) => s.runtimes);
  const chat = useAgency((s) => s.chat);
  const mode = useAgency((s) => s.mode);
  const connection = useAgency((s) => s.connection);
  const loadChat = useAgency((s) => s.loadChat);
  const list = Object.values(agents).sort(
    (a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name),
  );

  useEffect(() => {
    if (connection === 'online') for (const a of list) void loadChat(a.id).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, list.length]);

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      {mode === 'demo' ? <DemoBanner /> : null}
      <View style={s.header}>
        <Txt size={20} style={s.flex}>
          Chat com os agentes
        </Txt>
        <PixelButton
          label="Novo agente"
          icon="person-add-outline"
          small
          onPress={() => router.push({ pathname: '/agent/[id]', params: { id: 'new' } })}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<EmptyState icon="people-outline" title="Nenhum agente" />}
        renderItem={({ item }) => {
          const last = chat[item.id]?.[chat[item.id].length - 1];
          return (
            <Pressable
              style={s.item}
              onPress={() =>
                router.push({ pathname: '/chat/[agentId]', params: { agentId: item.id } })
              }
            >
              <AgentAvatar palette={item.palette} size={46} />
              <View style={s.flex}>
                <View style={s.row}>
                  <Txt size={15} style={s.flex}>
                    {item.name}
                    {!item.enabled ? ' (desativado)' : ''}
                  </Txt>
                  {last ? (
                    <Txt size={10} muted>
                      {clock(last.ts)}
                    </Txt>
                  ) : null}
                </View>
                <Txt size={10} muted>
                  {item.role} · {departmentName(item.department)}
                </Txt>
                <AgentActivityRenderer
                  activity={runtimes[item.id]?.activity ?? (item.enabled ? 'idle' : 'offline')}
                  compact
                />
                {last ? (
                  <Txt size={11} color={colors.textMuted} numberOfLines={1}>
                    {last.role === 'user' ? 'Você: ' : ''}
                    {last.text || '…'}
                  </Txt>
                ) : null}
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
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  list: { gap: 8, paddingBottom: 30, maxWidth: 900, width: '100%', alignSelf: 'center' },
  item: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.border,
  },
});
