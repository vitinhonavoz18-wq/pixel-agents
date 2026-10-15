import type { UsageAlertRule } from '@pixel-agency/shared';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { probeBackend } from '../../src/api/httpApi';
import {
  Chip,
  DemoBanner,
  KeyValue,
  Panel,
  PixelButton,
  SectionTitle,
  Txt,
} from '../../src/components/ui';
import { useAgency } from '../../src/state/store';
import { colors, fonts } from '../../src/theme/theme';

const METRIC_LABEL: Record<UsageAlertRule['metric'], string> = {
  session_percent: 'Limite de sessão (%)',
  weekly_percent: 'Limite semanal (%)',
  cost_usd_day: 'Custo estimado no dia (US$)',
  cost_usd_month: 'Custo estimado no mês (US$)',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    mode,
    url: savedUrl,
    token: savedToken,
    configure,
    capabilities,
    connection,
    api,
  } = useAgency();
  const [url, setUrl] = useState(savedUrl);
  const [token, setToken] = useState(savedToken);
  const [probe, setProbe] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<UsageAlertRule[] | null>(null);
  const [rulesMsg, setRulesMsg] = useState<string | null>(null);

  useEffect(() => {
    setUrl(savedUrl);
    setToken(savedToken);
  }, [savedUrl, savedToken]);

  useEffect(() => {
    if (!api || connection !== 'online') return;
    api
      .alertRules()
      .then(setRules)
      .catch(() => setRules(null));
  }, [api, connection]);

  const test = async () => {
    setBusy(true);
    setProbe(await probeBackend(url, token));
    setBusy(false);
  };
  const save = async () => {
    setBusy(true);
    const result = await probeBackend(url, token);
    setProbe(result);
    if (result.ok) await configure({ mode: 'cloud', url, token });
    setBusy(false);
  };
  const saveRules = async () => {
    if (!api || !rules) return;
    try {
      setRules(await api.saveAlertRules(rules));
      setRulesMsg('Alertas salvos.');
    } catch (e) {
      setRulesMsg((e as Error).message);
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      {mode === 'demo' ? <DemoBanner /> : null}
      <Txt size={22}>Configurações</Txt>

      <Panel style={s.card}>
        <SectionTitle title="Backend PIXEL AGENCY (modo cloud)" icon="cloud-outline" />
        <Txt size={11} muted>
          O app não guarda chaves da Anthropic: elas ficam somente no servidor. Aqui você informa o
          endereço do seu backend e um token de acesso criado nele.
        </Txt>
        <Txt size={12}>URL do backend</Txt>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://agency.seudominio.com"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={s.input}
        />
        <Txt size={12}>Token de acesso</Txt>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="pa_…"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={s.input}
        />
        <Txt size={10} color={colors.textDim}>
          {Platform.OS === 'web'
            ? 'Na versão web o token fica no armazenamento deste navegador. Use um token restrito aos projetos necessários e revogue-o quando terminar.'
            : 'O token é guardado no Android Keystore (expo-secure-store).'}
        </Txt>
        {probe ? (
          <Txt size={12} color={probe.ok ? colors.green : colors.red}>
            {probe.message}
          </Txt>
        ) : null}
        <View style={s.row}>
          <PixelButton
            label="Testar"
            icon="pulse-outline"
            onPress={test}
            busy={busy}
            disabled={!url || !token}
            style={s.flex}
          />
          <PixelButton
            label="Salvar e conectar"
            icon="link-outline"
            variant="primary"
            onPress={save}
            busy={busy}
            disabled={!url || !token}
            style={s.flex}
          />
        </View>
      </Panel>

      <Panel style={s.card}>
        <SectionTitle title="Modo DEMO" icon="flask-outline" />
        <Txt size={11} muted>
          Simulação local para conhecer a interface sem servidor. Nada é executado e tudo aparece
          marcado como DEMO.
        </Txt>
        <View style={s.row}>
          <PixelButton
            label={mode === 'demo' ? 'DEMO ativo' : 'Usar modo DEMO'}
            icon="flask-outline"
            disabled={mode === 'demo'}
            onPress={() => void configure({ mode: 'demo' })}
            style={s.flex}
          />
          {mode !== 'unset' ? (
            <PixelButton
              label="Desconectar"
              icon="power-outline"
              variant="ghost"
              onPress={() => void configure({ mode: 'unset' })}
              style={s.flex}
            />
          ) : null}
        </View>
      </Panel>

      {capabilities ? (
        <Panel style={s.card}>
          <SectionTitle title="O que este backend faz agora" icon="hardware-chip-outline" />
          <KeyValue label="Versão" value={capabilities.version} />
          <KeyValue
            label="Executor"
            value={
              <View style={s.rowWrap}>
                <Chip
                  label={capabilities.executor.kind}
                  color={capabilities.executor.ready ? colors.green : colors.red}
                  textColor={colors.bgDeep}
                />
                {capabilities.executor.reason ? (
                  <Txt size={11} muted>
                    {capabilities.executor.reason}
                  </Txt>
                ) : null}
              </View>
            }
          />
          <KeyValue label="Modelo padrão" value={capabilities.executor.defaultModel} />
          <KeyValue
            label="GitHub"
            value={
              capabilities.github.configured
                ? 'configurado'
                : 'não configurado (AGENCY_GITHUB_TOKEN)'
            }
          />
          <KeyValue
            label="Tokens dos agentes"
            value={capabilities.usage.agentTokens ? 'sim (Claude Agent SDK)' : 'não'}
          />
          <KeyValue
            label="Limites da assinatura"
            value={
              capabilities.usage.subscriptionLimits
                ? 'sim (Desktop Bridge)'
                : 'indisponível nesta integração'
            }
          />
          <KeyValue
            label="Custo da organização"
            value={capabilities.usage.orgCost ? 'sim (Admin API)' : 'não configurado'}
          />
          <KeyValue label="Saldo de créditos" value="sem API oficial" />
          <KeyValue
            label="Captura de telas"
            value={capabilities.previews.capture ? 'ativa' : 'desativada'}
          />
          <KeyValue
            label="Desktop Bridge"
            value={capabilities.desktopBridge.connected ? 'conectado' : 'não conectado'}
          />
        </Panel>
      ) : null}

      {rules ? (
        <Panel style={s.card}>
          <SectionTitle title="Alertas de consumo" icon="alarm-outline" />
          {rules.map((r, i) => (
            <View key={r.id} style={s.ruleRow}>
              <Switch
                value={r.enabled}
                onValueChange={(v) =>
                  setRules(rules.map((x, j) => (j === i ? { ...x, enabled: v } : x)))
                }
                trackColor={{ true: colors.orange, false: colors.border }}
              />
              <Txt size={12} style={s.flex}>
                {METRIC_LABEL[r.metric]}
              </Txt>
              <TextInput
                value={String(r.threshold)}
                keyboardType="numeric"
                onChangeText={(t) =>
                  setRules(
                    rules.map((x, j) =>
                      j === i ? { ...x, threshold: Number(t.replace(',', '.')) || x.threshold } : x,
                    ),
                  )
                }
                style={[s.input, s.small]}
              />
            </View>
          ))}
          <Txt size={10} color={colors.textDim}>
            Alertas de limite só disparam quando o Desktop Bridge envia os dados oficiais do Claude
            Code.
          </Txt>
          {rulesMsg ? (
            <Txt size={11} muted>
              {rulesMsg}
            </Txt>
          ) : null}
          <PixelButton label="Salvar alertas" icon="save-outline" onPress={saveRules} />
        </Panel>
      ) : null}

      <Panel style={s.card}>
        <SectionTitle
          title="Desktop Bridge (quando o computador estiver disponível)"
          icon="desktop-outline"
        />
        <Txt size={11} muted>
          1. No backend, crie um token com escopo “bridge”.{'\n'}
          2. No computador: AGENCY_URL=… AGENCY_BRIDGE_TOKEN=… npx tsx
          agency/desktop-bridge/src/cli.ts{'\n'}
          3. (Opcional) configure a statusline do Claude Code com o script pixel-agency-statusline
          para exibir os limites de sessão/semana no painel Uso Claude.
        </Txt>
      </Panel>

      <Panel style={s.card}>
        <SectionTitle title="Sobre" icon="information-circle-outline" />
        <Txt size={11} muted>
          PIXEL AGENCY é construído sobre o Pixel Agents (MIT © Pablo De Lucca e contribuidores).
          Personagens, móveis e a fonte FS Pixel Sans vêm do projeto original. A integração com o
          Claude usa somente o Claude Agent SDK oficial, autenticado no servidor.
        </Txt>
      </Panel>
    </ScrollView>
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
  card: { gap: 8 },
  input: {
    backgroundColor: colors.bgDeep,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.pixel,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  small: { width: 80, paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 8 },
  rowWrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
