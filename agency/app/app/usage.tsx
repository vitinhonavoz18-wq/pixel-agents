import {
  formatCountdown,
  formatTokens,
  formatUsd,
  LIMITS_UNAVAILABLE_TEXT,
  totalTokens,
  type UsageGroup,
} from '@pixel-agency/shared';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DemoBanner, KeyValue, Panel, ProgressBar, SectionTitle, Txt } from '../src/components/ui';
import { clock } from '../src/lib/labels';
import { useAgency } from '../src/state/store';
import { useUsageSummary } from '../src/state/useUsage';
import { colors } from '../src/theme/theme';

/**
 * ClaudeUsageDashboard (expanded): every figure labeled with its source.
 * Four separate things, never mixed: subscription limits, agent tokens,
 * organization cost, prepaid credits.
 */
export default function UsageScreen() {
  const { summary, error, updatedAt } = useUsageSummary();
  const mode = useAgency((s) => s.mode);
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {mode === 'demo' ? <DemoBanner /> : null}
      {error ? <Txt color={colors.red}>{error}</Txt> : null}
      {!summary ? (
        <Txt muted>Carregando…</Txt>
      ) : (
        <>
          <Panel accent={colors.orange} style={s.gap}>
            <SectionTitle title="1. Limites da assinatura Claude" icon="speedometer-outline" />
            {summary.limits.available ? (
              <>
                {summary.limits.session ? (
                  <Limit
                    label="Limite de sessão (5 h)"
                    pct={summary.limits.session.usedPercent}
                    reset={summary.limits.session.resetsAt}
                  />
                ) : null}
                {summary.limits.weekly ? (
                  <Limit
                    label="Limite semanal"
                    pct={summary.limits.weekly.usedPercent}
                    reset={summary.limits.weekly.resetsAt}
                  />
                ) : null}
                <Txt size={10} color={colors.textDim}>
                  Fonte: statusline do Claude Code via Desktop Bridge · observado às{' '}
                  {clock(summary.limits.observedAt)}. Percentuais da assinatura não equivalem a uma
                  quantidade de tokens.
                </Txt>
              </>
            ) : (
              <>
                <Txt size={13}>{LIMITS_UNAVAILABLE_TEXT}</Txt>
                <Txt size={11} muted>
                  {summary.limits.reason}
                </Txt>
              </>
            )}
          </Panel>

          <Panel style={s.gap}>
            <SectionTitle title="2. Consumo dos agentes (tokens)" icon="hardware-chip-outline" />
            <View style={s.totals}>
              <Stat label="Entrada" value={formatTokens(summary.totals.inputTokens)} />
              <Stat label="Saída" value={formatTokens(summary.totals.outputTokens)} />
              <Stat label="Cache (leitura)" value={formatTokens(summary.totals.cacheReadTokens)} />
              <Stat
                label="Cache (escrita)"
                value={formatTokens(summary.totals.cacheCreationTokens)}
              />
              <Stat label="Custo estimado" value={formatUsd(summary.totals.costUsd)} />
            </View>
            <Txt size={10} color={colors.textDim}>
              Fonte: campos modelUsage/total_cost_usd do Claude Agent SDK em cada execução. O custo
              é uma estimativa local do SDK, não uma fatura.
            </Txt>
            <Groups title="Por agente" groups={summary.byAgent} />
            <Groups title="Por projeto" groups={summary.byProject} />
            <Groups title="Por modelo" groups={summary.byModel} />
            <Groups title="Por tarefa" groups={summary.byMission.slice(0, 12)} />
          </Panel>

          <Panel style={s.gap}>
            <SectionTitle title="3. Custo da organização (API)" icon="business-outline" />
            {summary.orgCost.available ? (
              <>
                <KeyValue label="Mês atual" value={formatUsd(summary.orgCost.totalUsd)} />
                <Txt size={10} color={colors.textDim}>
                  Fonte: Admin API /v1/organizations/cost_report · consultado às{' '}
                  {clock(summary.orgCost.fetchedAt)}
                </Txt>
              </>
            ) : (
              <Txt size={11} muted>
                {summary.orgCost.reason}
              </Txt>
            )}
          </Panel>

          <Panel style={s.gap}>
            <SectionTitle title="4. Créditos" icon="wallet-outline" />
            <Txt size={11} muted>
              {summary.credits.reason}
            </Txt>
          </Panel>

          <Txt size={10} color={colors.textDim}>
            Atualizado às {updatedAt ? clock(new Date(updatedAt).toISOString()) : '—'}
          </Txt>
        </>
      )}
    </ScrollView>
  );
}

function Limit({ label, pct, reset }: { label: string; pct: number; reset?: string }) {
  return (
    <View style={s.gapSm}>
      <View style={s.row}>
        <Txt size={13} style={s.flex}>
          {label}
        </Txt>
        <Txt size={13}>
          {Math.round(pct)}% usado · {Math.round(100 - pct)}% restante
        </Txt>
      </View>
      <ProgressBar value={pct} height={14} color={pct > 85 ? colors.red : colors.blue} />
      <Txt size={11} muted>
        Renova em {formatCountdown(reset)}
        {reset ? ` (${new Date(reset).toLocaleString('pt-BR')})` : ''}
      </Txt>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Txt size={10} muted>
        {label}
      </Txt>
      <Txt size={16}>{value}</Txt>
    </View>
  );
}

function Groups({ title, groups }: { title: string; groups: UsageGroup[] }) {
  if (groups.length === 0) return null;
  const max = Math.max(...groups.map((g) => totalTokens(g.totals)), 1);
  return (
    <View style={s.gapSm}>
      <Txt size={12}>{title}</Txt>
      {groups.map((g) => (
        <View key={g.key} style={s.gapXs}>
          <View style={s.row}>
            <Txt size={11} style={s.flex} numberOfLines={1}>
              {g.label}
            </Txt>
            <Txt size={11} muted>
              {formatTokens(totalTokens(g.totals))} · {formatUsd(g.totals.costUsd)} · {g.missions}{' '}
              exec.
            </Txt>
          </View>
          <ProgressBar
            value={(totalTokens(g.totals) / max) * 100}
            height={5}
            color={colors.blueSoft}
          />
        </View>
      ))}
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
  gap: { gap: 10 },
  gapSm: { gap: 5 },
  gapXs: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { backgroundColor: colors.panelAlt, padding: 8, minWidth: 110 },
});
