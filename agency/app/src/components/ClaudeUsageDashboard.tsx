import Ionicons from '@expo/vector-icons/Ionicons';
import {
  formatCountdown,
  formatTokens,
  formatUsd,
  LIMITS_UNAVAILABLE_TEXT,
  totalTokens,
} from '@pixel-agency/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAgency } from '../state/store';
import { useUsageSummary } from '../state/useUsage';
import { colors } from '../theme/theme';
import { Panel, ProgressBar, Txt } from './ui';

function hhmm(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * ClaudeUsageDashboard (compact, in the game HUD). Shows ONLY what an
 * official source provides: subscription limits via the Desktop Bridge
 * statusline, and the agents' token/cost estimates from the Agent SDK. When
 * a source is missing it says so — it never fills the bars with guesses.
 */
export function ClaudeUsageDashboard({
  collapsible = true,
  defaultOpen = true,
}: {
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const { summary, error, updatedAt } = useUsageSummary();
  const demo = useAgency((s) => s.mode === 'demo');
  const [open, setOpen] = useState(defaultOpen);
  const limits = summary?.limits;

  return (
    <Panel accent={colors.orange} style={s.panel} padded={false}>
      <Pressable
        style={s.header}
        onPress={() => collapsible && setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="Uso Claude"
      >
        <Ionicons name="infinite" size={16} color={colors.orange} />
        <Txt size={13} style={s.flex}>
          Uso Claude{demo ? ' (DEMO)' : ''}
        </Txt>
        <Pressable
          onPress={() => router.push('/usage')}
          hitSlop={8}
          accessibilityLabel="Abrir relatório de uso"
        >
          <Ionicons name="bar-chart-outline" size={16} color={colors.textMuted} />
        </Pressable>
        {collapsible ? (
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        ) : null}
      </Pressable>
      {open ? (
        <View style={s.body}>
          {error ? (
            <Txt size={11} color={colors.red}>
              {error}
            </Txt>
          ) : null}
          {limits?.available ? (
            <>
              {limits.session ? (
                <View style={s.block}>
                  <View style={s.row}>
                    <Txt size={11} style={s.flex}>
                      Limite de sessão
                    </Txt>
                    <Txt size={11} muted>
                      {Math.round(limits.session.usedPercent)}% usado
                    </Txt>
                  </View>
                  <ProgressBar
                    value={limits.session.usedPercent}
                    color={limits.session.usedPercent > 85 ? colors.red : colors.blue}
                  />
                  <Txt size={10} muted>
                    Reinicia em {formatCountdown(limits.session.resetsAt)}
                  </Txt>
                </View>
              ) : null}
              {limits.weekly ? (
                <View style={s.block}>
                  <View style={s.row}>
                    <Txt size={11} style={s.flex}>
                      Semanal
                    </Txt>
                    <Txt size={11} muted>
                      {Math.round(limits.weekly.usedPercent)}% usado
                    </Txt>
                  </View>
                  <ProgressBar
                    value={limits.weekly.usedPercent}
                    color={limits.weekly.usedPercent > 85 ? colors.red : colors.blue}
                  />
                  <Txt size={10} muted>
                    Reinicia em {formatCountdown(limits.weekly.resetsAt)}
                  </Txt>
                </View>
              ) : null}
              <Txt size={9} color={colors.textDim}>
                Fonte: statusline do Claude Code (Desktop Bridge)
              </Txt>
            </>
          ) : (
            <Txt size={11} muted>
              {LIMITS_UNAVAILABLE_TEXT}
            </Txt>
          )}
          {summary ? (
            <View style={s.agentsUsage}>
              <Txt size={11} style={s.flex}>
                Agentes: {formatTokens(totalTokens(summary.totals))} tokens
              </Txt>
              <Txt size={11} muted>
                {formatUsd(summary.totals.costUsd)}*
              </Txt>
            </View>
          ) : null}
          <Txt size={9} color={colors.textDim}>
            *estimativa do Claude Agent SDK · atualizado {hhmm(updatedAt)}
          </Txt>
        </View>
      ) : null}
    </Panel>
  );
}

const s = StyleSheet.create({
  panel: { backgroundColor: 'rgba(14, 22, 44, 0.94)', minWidth: 220 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  body: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  block: { gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  agentsUsage: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
});
