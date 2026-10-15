import type { Approval } from '@pixel-agency/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { clock } from '../lib/labels';
import { useAgency } from '../state/store';
import { colors } from '../theme/theme';
import { AgentAvatar } from './AgentAvatar';
import { Chip, PixelButton, Txt } from './ui';

const RISK_COLOR = { low: colors.blueSoft, medium: colors.amber, high: colors.red } as const;
const RISK_LABEL = { low: 'risco baixo', medium: 'risco médio', high: 'risco alto' } as const;

export function ApprovalCard({ approval }: { approval: Approval }) {
  const api = useAgency((s) => s.api);
  const agent = useAgency((s) => s.agents[approval.agentId]);
  const mission = useAgency((s) => s.missions[approval.missionId]);
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decide = async (d: 'approve' | 'deny') => {
    if (!api) return;
    setBusy(d);
    setError(null);
    try {
      await api.resolveApproval(approval.id, d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const input =
    typeof approval.input === 'string' ? approval.input : JSON.stringify(approval.input, null, 1);
  return (
    <View style={[s.card, { borderColor: RISK_COLOR[approval.risk] }]}>
      <View style={s.row}>
        {agent ? <AgentAvatar palette={agent.palette} size={30} /> : null}
        <View style={s.flex}>
          <Txt size={13}>{agent?.name ?? approval.agentId} pede aprovação</Txt>
          <Txt size={10} muted numberOfLines={1}>
            {mission?.title ?? approval.missionId} · {clock(approval.createdAt)}
          </Txt>
        </View>
        <Chip
          label={RISK_LABEL[approval.risk]}
          color={RISK_COLOR[approval.risk]}
          textColor={colors.bgDeep}
        />
      </View>
      <Txt size={12}>{approval.summary}</Txt>
      <Txt size={11} muted>
        {approval.reason}
      </Txt>
      <View style={s.code}>
        <Txt size={10} color={colors.blueSoft} numberOfLines={6}>
          {input}
        </Txt>
      </View>
      {error ? (
        <Txt size={11} color={colors.red}>
          {error}
        </Txt>
      ) : null}
      {approval.status === 'pending' ? (
        <View style={s.actions}>
          <PixelButton
            label="Negar"
            icon="close"
            variant="danger"
            small
            onPress={() => decide('deny')}
            busy={busy === 'deny'}
            style={s.flex}
          />
          <PixelButton
            label="Aprovar"
            icon="checkmark"
            variant="success"
            small
            onPress={() => decide('approve')}
            busy={busy === 'approve'}
            style={s.flex}
          />
        </View>
      ) : (
        <Txt size={11} muted>
          {approval.status === 'approved'
            ? 'Aprovado'
            : approval.status === 'denied'
              ? 'Negado'
              : 'Expirado'}{' '}
          {approval.resolvedAt ? `às ${clock(approval.resolvedAt)}` : ''}
        </Txt>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.panelAlt, borderWidth: 2, padding: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  code: { backgroundColor: colors.bgDeep, padding: 6 },
  actions: { flexDirection: 'row', gap: 8 },
});
