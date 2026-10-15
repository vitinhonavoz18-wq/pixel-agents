import { DEPARTMENTS } from '@pixel-agency/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AgentAvatar } from '../../src/components/AgentAvatar';
import { ProjectLogo } from '../../src/components/ProjectLogo';
import { Chip, DemoBanner, PixelButton, Txt } from '../../src/components/ui';
import { useAgency } from '../../src/state/store';
import { colors, fonts } from '../../src/theme/theme';

export default function NewMissionScreen() {
  const params = useLocalSearchParams<{ agentId?: string; projectId?: string }>();
  const agents = useAgency((s) => s.agents);
  const projects = useAgency((s) => s.projects);
  const selectedProject = useAgency((s) => s.selectedProjectId);
  const api = useAgency((s) => s.api);
  const mode = useAgency((s) => s.mode);
  const [agentId, setAgentId] = useState(params.agentId || Object.keys(agents)[0] || '');
  const [projectId, setProjectId] = useState(params.projectId || selectedProject || '');
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [startNow, setStartNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = projects[projectId];
  const submit = async () => {
    if (!api) return;
    setBusy(true);
    setError(null);
    try {
      const m = await api.createMission({
        title: title.trim() || objective.trim().slice(0, 60),
        objective: objective.trim(),
        agentId,
        projectId,
        start: startNow,
      });
      router.replace({ pathname: '/mission/[id]', params: { id: m.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {mode === 'demo' ? <DemoBanner /> : null}
      <Txt size={13}>Responsável</Txt>
      <View style={s.wrap}>
        {Object.values(agents)
          .filter((a) => a.enabled)
          .map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAgentId(a.id)}
              style={[s.option, agentId === a.id && s.optionOn]}
            >
              <AgentAvatar palette={a.palette} size={28} framed={false} />
              <View>
                <Txt size={12}>{a.name}</Txt>
                <Txt size={9} muted>
                  {DEPARTMENTS.find((d) => d.id === a.department)?.name}
                </Txt>
              </View>
            </Pressable>
          ))}
      </View>
      <Txt size={13}>Projeto</Txt>
      <View style={s.wrap}>
        {Object.values(projects)
          .filter((p) => !p.archived)
          .map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setProjectId(p.id)}
              style={[s.option, projectId === p.id && s.optionOn]}
            >
              <ProjectLogo projectId={p.id} size={22} />
              <Txt size={12}>{p.name}</Txt>
              {!p.authorized ? (
                <Chip label="não autorizado" color={colors.red} textColor="#fff" />
              ) : null}
            </Pressable>
          ))}
      </View>
      {project && !project.authorized ? (
        <Txt size={11} color={colors.amber}>
          Este projeto ainda não está autorizado para execução. Autorize-o (e conecte o repositório)
          na tela do projeto.
        </Txt>
      ) : null}
      <Txt size={13}>Título</Txt>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Auditoria das integrações de pagamento"
        placeholderTextColor={colors.textDim}
        style={s.input}
      />
      <Txt size={13}>Objetivo (instruções para o agente)</Txt>
      <TextInput
        value={objective}
        onChangeText={setObjective}
        placeholder="Franklin, faça uma auditoria nas integrações de pagamento do FlyDelivery e gere um relatório dos problemas identificados."
        placeholderTextColor={colors.textDim}
        multiline
        style={[s.input, s.multiline]}
      />
      <View style={s.switchRow}>
        <Switch
          value={startNow}
          onValueChange={setStartNow}
          trackColor={{ true: colors.orange, false: colors.border }}
        />
        <Txt size={12}>{startNow ? 'Iniciar agora (vai para a fila)' : 'Guardar no backlog'}</Txt>
      </View>
      {error ? (
        <Txt size={12} color={colors.red}>
          {error}
        </Txt>
      ) : null}
      <PixelButton
        label="Delegar missão"
        icon="rocket-outline"
        variant="primary"
        onPress={submit}
        busy={busy}
        disabled={!agentId || !projectId || objective.trim().length < 3}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 12, gap: 10, maxWidth: 800, width: '100%', alignSelf: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  optionOn: { borderColor: colors.orange, backgroundColor: colors.panelHi },
  input: {
    backgroundColor: colors.bgDeep,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.pixel,
    fontSize: 14,
    padding: 10,
  },
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
