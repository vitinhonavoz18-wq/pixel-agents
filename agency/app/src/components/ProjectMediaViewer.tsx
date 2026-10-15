import type { ProjectPreview } from '@pixel-agency/shared';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { clock } from '../lib/labels';
import { useAgency } from '../state/store';
import { colors } from '../theme/theme';
import { ProjectLogo } from './ProjectLogo';
import { Chip, KeyValue, Panel, PixelButton, Txt } from './ui';

const SOURCE_LABEL = {
  repo: 'Screenshot do repositório',
  capture: 'Captura automática',
  upload: 'Imagem enviada',
} as const;

/**
 * ProjectMediaViewer — the "monitor" opened large: a REAL image of the
 * project's interface with where it came from, the agent and task attached,
 * and shortcuts to the original interface and to the agent's chat.
 */
export function ProjectMediaViewer({
  preview,
  onClose,
}: {
  preview: ProjectPreview | null;
  onClose: () => void;
}) {
  const api = useAgency((s) => s.api);
  const project = useAgency((s) => (preview ? s.projects[preview.projectId] : undefined));
  const agent = useAgency((s) => (preview?.agentId ? s.agents[preview.agentId] : undefined));
  const runtimeAgent = useAgency((s) =>
    preview
      ? Object.values(s.runtimes).find(
          (r) => r.projectId === preview.projectId && r.activity !== 'idle',
        )
      : undefined,
  );
  const mission = useAgency((s) => {
    const id = preview?.missionId ?? runtimeAgent?.missionId;
    return id ? s.missions[id] : undefined;
  });
  const agentId = preview?.agentId ?? runtimeAgent?.agentId ?? project?.team[0];
  const agentName = useAgency((s) => (agentId ? s.agents[agentId]?.name : undefined));
  if (!preview) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Panel style={s.sheet}>
          <View style={s.head}>
            <ProjectLogo projectId={preview.projectId} size={28} />
            <View style={s.flex}>
              <Txt size={15}>{preview.title}</Txt>
              <Txt size={11} muted>
                {project?.name}
              </Txt>
            </View>
            <PixelButton icon="close" variant="ghost" small onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={s.body}>
            <Image
              source={{ uri: api?.assetUrl(preview.url) }}
              style={s.image}
              contentFit="contain"
              accessibilityLabel={preview.title}
            />
            <Chip label={SOURCE_LABEL[preview.source]} icon="image-outline" />
            <KeyValue label="Origem" value={preview.origin} />
            <KeyValue label="Agente" value={agent?.name ?? agentName ?? '—'} />
            <KeyValue label="Tarefa" value={mission?.title ?? '—'} />
            <KeyValue
              label="Atualizado"
              value={`${new Date(preview.createdAt).toLocaleDateString('pt-BR')} ${clock(preview.createdAt)}${preview.commitSha ? ` · commit ${preview.commitSha.slice(0, 7)}` : ''}`}
            />
            <View style={s.actions}>
              {project?.appUrl ? (
                <PixelButton
                  label="Abrir interface original"
                  icon="open-outline"
                  onPress={() => Linking.openURL(project.appUrl!)}
                />
              ) : null}
              {agentId ? (
                <PixelButton
                  label="Conversar com o agente"
                  icon="chatbubbles-outline"
                  variant="primary"
                  onPress={() => {
                    onClose();
                    router.push({ pathname: '/chat/[agentId]', params: { agentId } });
                  }}
                />
              ) : null}
            </View>
          </ScrollView>
        </Panel>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  sheet: { width: '100%', maxWidth: 900, maxHeight: '92%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flex: { flex: 1 },
  body: { gap: 8 },
  image: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.bgDeep },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});
