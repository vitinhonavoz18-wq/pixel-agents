import {
  type AgentInput,
  type Autonomy,
  DEPARTMENT_STARTERS,
  DEPARTMENTS,
  type DepartmentId,
  departmentName,
} from '@pixel-agency/shared';
import * as DocumentPicker from 'expo-document-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AgentAvatar } from '../../src/components/AgentAvatar';
import { MissionCard } from '../../src/components/MissionCard';
import { ProjectLogo } from '../../src/components/ProjectLogo';
import { Chip, DemoBanner, Panel, PixelButton, SectionTitle, Txt } from '../../src/components/ui';
import { useAgency } from '../../src/state/store';
import { colors, fonts } from '../../src/theme/theme';

const AUTONOMY: Array<{ key: Autonomy; label: string; help: string }> = [
  {
    key: 'supervised',
    label: 'Supervisionado',
    help: 'Somente leitura; qualquer edição ou comando pede aprovação.',
  },
  {
    key: 'standard',
    label: 'Padrão',
    help: 'Edita no workspace e roda comandos de desenvolvimento; o resto pede aprovação.',
  },
  {
    key: 'autonomous',
    label: 'Autônomo',
    help: 'Executa o permitido pela política; operações sensíveis sempre pedem aprovação.',
  },
];

export default function AgentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useAgency((s) => (isNew ? undefined : s.agents[id]));
  const projects = useAgency((s) => s.projects);
  const missions = useAgency((s) => s.missions);
  const api = useAgency((s) => s.api);
  const mode = useAgency((s) => s.mode);
  const [form, setForm] = useState<AgentInput>(() => ({
    name: '',
    role: '',
    department: 'desenvolvimento',
    description: '',
    responsibilities: [],
    instructions: DEPARTMENT_STARTERS.desenvolvimento.instructions,
    tools: [],
    autonomy: 'standard',
    enabled: true,
    palette: Math.floor(Math.random() * 6),
    hueShift: 0,
    source: 'custom',
  }));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing;
      setForm(rest);
    }
  }, [existing]);

  const set = <K extends keyof AgentInput>(k: K, v: AgentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    api &&
    run(
      'save',
      async () => {
        const payload = {
          ...form,
          responsibilities: (form.responsibilities ?? []).filter(Boolean),
        };
        if (isNew) {
          const a = await api.createAgent(payload);
          router.replace({ pathname: '/agent/[id]', params: { id: a.id } });
        } else {
          await api.updateAgent(id, payload);
        }
      },
      'Agente salvo.',
    );

  const importFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/markdown', 'text/plain', 'application/json', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const text = await fetch(res.assets[0].uri).then((r) => r.text());
    setImportText(text);
  };

  const history = Object.values(missions)
    .filter((m) => m.agentId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: isNew ? 'Novo agente' : form.name || 'Agente' }} />
      {mode === 'demo' ? <DemoBanner /> : null}

      {existing?.source === 'template' ? (
        <Panel accent={colors.amber}>
          <Txt size={12} color={colors.amber}>
            Modelo inicial
          </Txt>
          <Txt size={11} muted>
            {existing.sourceNote}
          </Txt>
        </Panel>
      ) : null}

      <Panel style={s.gap}>
        <View style={s.row}>
          <AgentAvatar palette={form.palette ?? 0} size={72} />
          <View style={s.flex}>
            <Txt size={12}>Aparência</Txt>
            <View style={s.rowWrap}>
              {[0, 1, 2, 3, 4, 5].map((p) => (
                <Pressable
                  key={p}
                  onPress={() => set('palette', p)}
                  style={[s.skin, form.palette === p && s.skinOn]}
                >
                  <AgentAvatar palette={p} size={34} framed={false} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <Field
          label="Nome"
          value={form.name}
          onChange={(v) => set('name', v)}
          placeholder="Franklin"
        />
        <Field
          label="Cargo"
          value={form.role ?? ''}
          onChange={(v) => set('role', v)}
          placeholder="Especialista em Automações"
        />
        <Txt size={12}>Departamento</Txt>
        <View style={s.rowWrap}>
          {DEPARTMENTS.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => {
                set('department', d.id as DepartmentId);
                if (isNew && !form.role) set('role', DEPARTMENT_STARTERS[d.id].role);
              }}
              style={[
                s.opt,
                form.department === d.id && {
                  borderColor: d.color,
                  backgroundColor: colors.panelHi,
                },
              ]}
            >
              <Txt size={11} color={d.color}>
                {d.icon} {d.name}
              </Txt>
            </Pressable>
          ))}
        </View>
        <Txt size={12}>Projeto padrão</Txt>
        <View style={s.rowWrap}>
          {Object.values(projects).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => set('projectId', p.id)}
              style={[s.opt, form.projectId === p.id && s.optOn]}
            >
              <ProjectLogo projectId={p.id} size={14} />
              <Txt size={11}>{p.name}</Txt>
            </Pressable>
          ))}
        </View>
        <Field
          label="Descrição"
          value={form.description ?? ''}
          onChange={(v) => set('description', v)}
          multiline
        />
        <Field
          label="Responsabilidades (uma por linha)"
          value={(form.responsibilities ?? []).join('\n')}
          onChange={(v) => set('responsibilities', v.split('\n'))}
          multiline
        />
        <Field
          label="Instruções (prompt do agente)"
          value={form.instructions ?? ''}
          onChange={(v) => set('instructions', v)}
          multiline
          tall
        />
        <Field
          label="Ferramentas permitidas (vazio = padrão do Claude Code)"
          value={(form.tools ?? []).join(', ')}
          onChange={(v) => set('tools', v.split(/[,\s]+/).filter(Boolean))}
          placeholder="Read, Grep, Glob, Edit, Bash"
        />
        <Field
          label="Modelo (opcional)"
          value={form.model ?? ''}
          onChange={(v) => set('model', v.trim() || undefined)}
          placeholder="claude-opus-5-5"
        />
        <Txt size={12}>Autonomia</Txt>
        {AUTONOMY.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => set('autonomy', a.key)}
            style={[s.autonomy, form.autonomy === a.key && s.optOn]}
          >
            <Txt size={12}>{a.label}</Txt>
            <Txt size={10} muted>
              {a.help}
            </Txt>
          </Pressable>
        ))}
        <View style={s.row}>
          <Switch
            value={form.enabled ?? true}
            onValueChange={(v) => set('enabled', v)}
            trackColor={{ true: colors.green, false: colors.border }}
          />
          <Txt size={12}>{form.enabled ? 'Ativo no escritório' : 'Desativado'}</Txt>
        </View>
        {msg ? (
          <Txt size={12} color={msg.ok ? colors.green : colors.red}>
            {msg.text}
          </Txt>
        ) : null}
        <View style={s.row}>
          <PixelButton
            label="Salvar"
            icon="save-outline"
            variant="primary"
            onPress={save}
            busy={busy === 'save'}
            disabled={!form.name.trim()}
            style={s.flex}
          />
          {!isNew ? (
            <PixelButton
              label="Excluir"
              icon="trash-outline"
              variant="danger"
              onPress={() =>
                api &&
                run(
                  'delete',
                  async () => {
                    await api.deleteAgent(id);
                    router.back();
                  },
                  'Excluído.',
                )
              }
              busy={busy === 'delete'}
            />
          ) : null}
        </View>
      </Panel>

      <Panel style={s.gap}>
        <SectionTitle title="Importar definição original" icon="download-outline" />
        <Txt size={11} muted>
          Cole ou selecione o arquivo do seu agente (ex.: ~/.claude/agents/franklin.md com
          frontmatter name/description/tools/model, ou um JSON exportado). Um agente com o mesmo
          nome substitui o modelo inicial.
        </Txt>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          multiline
          placeholder={
            '---\nname: franklin\ndescription: …\ntools: Read, Grep, Bash\n---\nInstruções…'
          }
          placeholderTextColor={colors.textDim}
          style={[s.input, s.tall]}
        />
        <View style={s.row}>
          <PixelButton
            label="Escolher arquivo"
            icon="document-outline"
            onPress={importFile}
            style={s.flex}
          />
          <PixelButton
            label="Importar"
            icon="checkmark"
            variant="primary"
            disabled={!importText.trim()}
            busy={busy === 'import'}
            onPress={() =>
              api &&
              run(
                'import',
                async () => {
                  const a = await api.importAgent(importText, form.department as DepartmentId);
                  router.replace({ pathname: '/agent/[id]', params: { id: a.id } });
                },
                'Agente importado.',
              )
            }
            style={s.flex}
          />
        </View>
      </Panel>

      {!isNew ? (
        <Panel style={s.gap}>
          <SectionTitle
            title={`Histórico de ${form.name}`}
            icon="time-outline"
            right={<Chip label={departmentName(form.department)} />}
          />
          {history.length === 0 ? (
            <Txt size={11} muted>
              Nenhuma missão ainda.
            </Txt>
          ) : (
            history.map((m) => <MissionCard key={m.id} mission={m} />)
          )}
          <PixelButton
            label="Conversar"
            icon="chatbubbles-outline"
            onPress={() => router.push({ pathname: '/chat/[agentId]', params: { agentId: id } })}
          />
        </Panel>
      ) : null}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  tall,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  tall?: boolean;
}) {
  return (
    <View style={s.field}>
      <Txt size={12}>{label}</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        multiline={multiline}
        style={[s.input, multiline && s.multi, tall && s.tall]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 12,
    gap: 12,
    paddingBottom: 40,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  gap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flex: { flex: 1 },
  field: { gap: 4 },
  input: {
    backgroundColor: colors.bgDeep,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.pixel,
    fontSize: 13,
    padding: 8,
  },
  multi: { minHeight: 70, textAlignVertical: 'top' },
  tall: { minHeight: 160, textAlignVertical: 'top' },
  skin: { borderWidth: 2, borderColor: 'transparent' },
  skinOn: { borderColor: colors.orange },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optOn: { borderColor: colors.orange, backgroundColor: colors.panelHi },
  autonomy: { padding: 8, borderWidth: 2, borderColor: colors.border, gap: 2 },
});
