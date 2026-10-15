import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { clock } from '../lib/labels';
import { useAgency } from '../state/store';
import { colors } from '../theme/theme';
import { AgentAvatar } from './AgentAvatar';
import { Panel, SectionTitle, Txt } from './ui';

/** "Chat da Agência" — the latest real messages across agents. */
export function ChatPreview({ limit = 3 }: { limit?: number }) {
  const chat = useAgency((s) => s.chat);
  const agents = useAgency((s) => s.agents);
  const latest = Object.values(chat)
    .flat()
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit)
    .reverse();
  return (
    <Panel style={s.panel}>
      <SectionTitle
        title="Chat da Agência"
        icon="chatbubbles-outline"
        right={
          <Pressable onPress={() => router.push('/chat')}>
            <Txt size={11} color={colors.blueSoft}>
              Ver todas
            </Txt>
          </Pressable>
        }
      />
      {latest.length === 0 ? (
        <Txt size={11} muted>
          Nenhuma conversa ainda. Toque em um agente no escritório e escolha “Conversar”.
        </Txt>
      ) : (
        latest.map((m) => {
          const agent = agents[m.agentId];
          const mine = m.role === 'user';
          return (
            <Pressable
              key={m.id}
              style={[s.msg, mine && s.mine]}
              onPress={() =>
                router.push({ pathname: '/chat/[agentId]', params: { agentId: m.agentId } })
              }
            >
              {!mine && agent ? <AgentAvatar palette={agent.palette} size={26} /> : null}
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleAgent]}>
                <Txt size={10} muted>
                  {mine ? 'Você' : agent?.name} · {clock(m.ts)}
                  {m.demo ? ' · DEMO' : ''}
                </Txt>
                <Txt size={11} numberOfLines={3}>
                  {m.text || (m.streaming ? '…' : '')}
                </Txt>
              </View>
            </Pressable>
          );
        })
      )}
    </Panel>
  );
}

const s = StyleSheet.create({
  panel: { gap: 6, backgroundColor: 'rgba(14, 22, 44, 0.96)' },
  msg: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  mine: { justifyContent: 'flex-end' },
  bubble: { padding: 6, maxWidth: '88%', borderWidth: 1 },
  bubbleMine: { backgroundColor: '#1d3a6e', borderColor: colors.blue },
  bubbleAgent: { backgroundColor: colors.panelAlt, borderColor: colors.border, flex: 1 },
});
