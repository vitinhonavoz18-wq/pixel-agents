import { type ProjectPreview } from '@pixel-agency/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import type { GithubRepo } from '../../src/api/types';
import { AgentAvatar } from '../../src/components/AgentAvatar';
import { KanbanBoard } from '../../src/components/KanbanBoard';
import { ProjectLogo } from '../../src/components/ProjectLogo';
import { ProjectMediaViewer } from '../../src/components/ProjectMediaViewer';
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
import { useAgency } from '../../src/state/store';
import { useThemeForProject } from '../../src/theme/ProjectThemeProvider';
import { colors, fonts } from '../../src/theme/theme';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id === 'new') return <NewProject />;
  return <ProjectDetail id={id} />;
}

function NewProject() {
  const api = useAgency((s) => s.api);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    if (!api) return;
    setBusy(true);
    try {
      const p = await api.createProject({ name: name.trim() });
      router.replace({ pathname: '/project/[id]', params: { id: p.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Novo projeto' }} />
      <Txt size={13}>Nome do projeto</Txt>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="FlyDelivery"
        placeholderTextColor={colors.textDim}
        style={s.input}
      />
      <Txt size={11} muted>
        Depois de criar, conecte um repositório GitHub autorizado e autorize a execução.
      </Txt>
      {error ? (
        <Txt size={12} color={colors.red}>
          {error}
        </Txt>
      ) : null}
      <PixelButton
        label="Criar projeto"
        icon="add"
        variant="primary"
        onPress={create}
        busy={busy}
        disabled={name.trim().length < 2}
      />
    </ScrollView>
  );
}

function ProjectDetail({ id }: { id: string }) {
  const project = useAgency((s) => s.projects[id]);
  const branding = useAgency((s) => s.branding[id]);
  const previews = useAgency((s) => s.previews[id]);
  const missions = useAgency((s) => s.missions);
  const agents = useAgency((s) => s.agents);
  const api = useAgency((s) => s.api);
  const capabilities = useAgency((s) => s.capabilities);
  const loadPreviews = useAgency((s) => s.loadPreviews);
  const mode = useAgency((s) => s.mode);
  const theme = useThemeForProject(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [appUrl, setAppUrl] = useState(project?.appUrl ?? '');
  const [viewer, setViewer] = useState<ProjectPreview | null>(null);

  useEffect(() => {
    void loadPreviews(id).catch(() => undefined);
  }, [id, loadPreviews]);
  useEffect(() => setAppUrl(project?.appUrl ?? ''), [project?.appUrl]);

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

  if (!project) return <EmptyState title="Projeto não encontrado" />;
  const projectMissions = Object.values(missions).filter((m) => m.projectId === id);
  const logos =
    branding?.logoCandidates.filter((c) => c.kind !== 'screenshot' && c.kind !== 'image') ?? [];

  const pickImage = async () => {
    if (!api) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.9,
    });
    const asset = res.assets?.[0];
    if (res.canceled || !asset?.base64) return;
    const mime = asset.mimeType ?? 'image/png';
    await run(
      'upload',
      () =>
        api.uploadPreview(id, {
          title: asset.fileName ?? 'Tela enviada',
          mime,
          dataBase64: asset.base64!,
          filename: asset.fileName ?? undefined,
        }),
      'Imagem enviada.',
    );
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: project.name }} />
      {mode === 'demo' ? <DemoBanner /> : null}

      <Panel accent={theme.accent} style={s.gap}>
        <View style={s.row}>
          <ProjectLogo projectId={id} size={64} />
          <View style={s.flex}>
            <Txt size={20}>{project.name}</Txt>
            <Txt size={11} muted>
              {project.repo
                ? `github.com/${project.repo.owner}/${project.repo.name} (${project.repo.defaultBranch})`
                : 'Sem repositório conectado'}
            </Txt>
            <View style={s.rowWrap}>
              {project.team.map((a) =>
                agents[a] ? <Chip key={a} label={agents[a].name} icon="person" /> : null,
              )}
            </View>
          </View>
        </View>
        <View style={s.switchRow}>
          <Switch
            value={project.authorized}
            onValueChange={(v) =>
              void (
                api &&
                run(
                  'auth',
                  () => api.updateProject(id, { authorized: v }),
                  v ? 'Projeto autorizado para execução.' : 'Execução bloqueada.',
                )
              )
            }
            trackColor={{ true: colors.green, false: colors.border }}
          />
          <Txt size={12} style={s.flex}>
            {project.authorized
              ? 'Agentes podem executar missões neste projeto'
              : 'Execução bloqueada (autorize para permitir missões)'}
          </Txt>
        </View>
        {msg ? (
          <Txt size={12} color={msg.ok ? colors.green : colors.red}>
            {msg.text}
          </Txt>
        ) : null}
      </Panel>

      <Panel style={s.gap}>
        <SectionTitle title="Repositório GitHub" icon="logo-github" />
        <Txt size={11} muted>
          Somente repositórios que o token GitHub do backend já pode acessar são listados. Cada
          missão trabalha num clone isolado, numa branch própria.
        </Txt>
        <PixelButton
          label={repos ? 'Atualizar lista' : 'Escolher repositório autorizado'}
          icon="git-branch-outline"
          busy={busy === 'repos'}
          disabled={!capabilities?.github.configured}
          onPress={() =>
            api &&
            run('repos', async () => setRepos(await api.githubRepos()), 'Repositórios carregados.')
          }
        />
        {!capabilities?.github.configured ? (
          <Txt size={10} color={colors.amber}>
            O backend ainda não tem AGENCY_GITHUB_TOKEN configurado.
          </Txt>
        ) : null}
        {repos?.map((r) => (
          <Pressable
            key={r.fullName}
            style={[
              s.repo,
              project.repo?.owner === r.owner && project.repo?.name === r.name && s.repoOn,
            ]}
            onPress={() =>
              api &&
              run(
                'repo',
                () =>
                  api.updateProject(id, {
                    repo: {
                      provider: 'github',
                      owner: r.owner,
                      name: r.name,
                      defaultBranch: r.defaultBranch,
                    },
                  }),
                `Conectado a ${r.fullName}.`,
              )
            }
          >
            <Txt size={12} style={s.flex}>
              {r.fullName}
            </Txt>
            {r.private ? <Chip label="privado" /> : null}
          </Pressable>
        ))}
      </Panel>

      <Panel style={s.gap}>
        <SectionTitle
          title="Identidade visual (do repositório)"
          icon="color-palette-outline"
          right={
            <PixelButton
              label="Extrair"
              icon="sparkles-outline"
              small
              busy={busy === 'brand'}
              disabled={!project.repo}
              onPress={() =>
                api &&
                run('brand', () => api.refreshBranding(id), 'Identidade extraída do repositório.')
              }
            />
          }
        />
        {!branding ? (
          <Txt size={11} muted>
            Conecte o repositório e toque em “Extrair”: o ProjectBrandingEngine procura logos,
            ícones, favicons, cores (CSS, Tailwind, manifestos) e fontes do próprio projeto.
          </Txt>
        ) : (
          <>
            <Txt size={10} color={colors.textDim}>
              Extraído em {new Date(branding.extractedAt).toLocaleString('pt-BR')}{' '}
              {branding.commitSha ? `· commit ${branding.commitSha.slice(0, 7)}` : ''} ·{' '}
              {branding.status}
            </Txt>
            <Txt size={12}>Logo principal {logos.length > 1 ? '(toque para escolher)' : ''}</Txt>
            <ScrollView horizontal contentContainerStyle={s.logos}>
              {logos.map((c) => (
                <Pressable
                  key={c.path}
                  style={[s.logo, branding.selectedLogoPath === c.path && s.logoOn]}
                  onPress={() =>
                    api && run('logo', () => api.selectLogo(id, c.path), 'Logo selecionada.')
                  }
                >
                  {c.url ? (
                    <Image
                      source={{ uri: api?.assetUrl(c.url) }}
                      style={s.logoImg}
                      contentFit="contain"
                    />
                  ) : (
                    <Txt size={10}>sem prévia</Txt>
                  )}
                  <Txt size={9} muted numberOfLines={2}>
                    {c.path}
                  </Txt>
                  <Txt size={9} color={colors.textDim}>
                    {c.kind} · {Math.round(c.score * 100)}%
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
            <Txt size={12}>Cores</Txt>
            <View style={s.rowWrap}>
              {branding.colors.map((c) => (
                <View key={c.hex} style={s.color}>
                  <View style={[s.swatch, { backgroundColor: c.hex }]} />
                  <Txt size={9}>{c.hex}</Txt>
                  <Txt size={8} muted>
                    {c.role}
                  </Txt>
                </View>
              ))}
            </View>
            {branding.fonts.length > 0 ? (
              <KeyValue label="Fontes" value={branding.fonts.map((f) => f.family).join(', ')} />
            ) : null}
            {branding.sourceFiles.length > 0 ? (
              <KeyValue
                label="Fontes de dados"
                value={branding.sourceFiles.slice(0, 8).join(', ')}
              />
            ) : null}
          </>
        )}
      </Panel>

      <Panel style={s.gap}>
        <SectionTitle title="Telas reais do projeto" icon="desktop-outline" />
        <Txt size={11} muted>
          Ordem: screenshots do repositório → captura da URL do projeto → imagens enviadas por você.
          Nenhuma tela é gerada artificialmente.
        </Txt>
        <Txt size={12}>URL da aplicação (homologação/produção)</Txt>
        <View style={s.row}>
          <TextInput
            value={appUrl}
            onChangeText={setAppUrl}
            placeholder="https://painel.flydelivery.com"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            style={[s.input, s.flex]}
          />
          <PixelButton
            label="Salvar"
            small
            onPress={() =>
              api &&
              run(
                'url',
                () => api.updateProject(id, { appUrl: appUrl.trim() || undefined }),
                'URL salva.',
              )
            }
            busy={busy === 'url'}
          />
        </View>
        <View style={s.rowWrap}>
          <PixelButton
            label="Capturar tela"
            icon="camera-outline"
            small
            disabled={!project.appUrl || !capabilities?.previews.capture}
            busy={busy === 'capture'}
            onPress={() =>
              api &&
              run(
                'capture',
                () => api.capturePreview(id, { title: 'Tela capturada' }),
                'Tela capturada.',
              )
            }
          />
          <PixelButton
            label="Enviar imagem oficial"
            icon="cloud-upload-outline"
            small
            busy={busy === 'upload'}
            onPress={pickImage}
          />
        </View>
        {!capabilities?.previews.capture ? (
          <Txt size={10} color={colors.textDim}>
            Captura automática desativada no backend (AGENCY_ENABLE_CAPTURE).
          </Txt>
        ) : null}
        {previews && previews.length > 0 ? (
          <View style={s.grid}>
            {previews.map((p) => (
              <Pressable key={p.id} style={s.thumb} onPress={() => setViewer(p)}>
                <Image
                  source={{ uri: api?.assetUrl(p.url) }}
                  style={s.thumbImg}
                  contentFit="cover"
                />
                <Txt size={10} numberOfLines={1}>
                  {p.title}
                </Txt>
                <Txt size={9} muted>
                  {p.source === 'repo'
                    ? 'repositório'
                    : p.source === 'capture'
                      ? 'captura'
                      : 'enviada'}
                </Txt>
              </Pressable>
            ))}
          </View>
        ) : (
          <Txt size={11} color={colors.textDim}>
            Ainda não há telas reais deste projeto.
          </Txt>
        )}
      </Panel>

      <Panel style={s.gap}>
        <SectionTitle
          title="Equipe e missões"
          icon="people-outline"
          right={
            <PixelButton
              label="Nova missão"
              icon="add"
              small
              onPress={() => router.push({ pathname: '/mission/new', params: { projectId: id } })}
            />
          }
        />
        <View style={s.rowWrap}>
          {Object.values(agents).map((a) => {
            const inTeam = project.team.includes(a.id);
            return (
              <Pressable
                key={a.id}
                style={[s.member, inTeam && s.memberOn]}
                onPress={() =>
                  api &&
                  run(
                    'team',
                    () =>
                      api.updateProject(id, {
                        team: inTeam
                          ? project.team.filter((x) => x !== a.id)
                          : [...project.team, a.id],
                      }),
                    'Equipe atualizada.',
                  )
                }
              >
                <AgentAvatar palette={a.palette} size={24} framed={false} />
                <Txt size={11}>{a.name}</Txt>
              </Pressable>
            );
          })}
        </View>
        <KanbanBoard missions={projectMissions} compact columnWidth={180} maxPerColumn={4} />
      </Panel>
      <ProjectMediaViewer preview={viewer} onClose={() => setViewer(null)} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 12,
    gap: 12,
    paddingBottom: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  gap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: colors.bgDeep,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.pixel,
    fontSize: 13,
    padding: 8,
  },
  repo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  repoOn: { borderColor: colors.orange, backgroundColor: colors.panelHi },
  logos: { gap: 8 },
  logo: {
    width: 110,
    padding: 6,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 4,
    backgroundColor: colors.panelAlt,
  },
  logoOn: { borderColor: colors.orange },
  logoImg: { width: '100%', height: 60 },
  color: { alignItems: 'center', gap: 2 },
  swatch: { width: 36, height: 36, borderWidth: 1, borderColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 160, gap: 3 },
  thumbImg: { width: 160, height: 100, backgroundColor: colors.bgDeep },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberOn: { borderColor: colors.green, backgroundColor: colors.panelHi },
});
