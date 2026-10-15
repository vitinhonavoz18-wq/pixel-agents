import { ScrollView, StyleSheet } from 'react-native';

import { ApprovalCard } from '../src/components/ApprovalCard';
import { DemoBanner, EmptyState, SectionTitle } from '../src/components/ui';
import { useShallow } from 'zustand/react/shallow';

import { useAgency } from '../src/state/store';
import { colors } from '../src/theme/theme';

export default function ApprovalsScreen() {
  const approvals = useAgency(
    useShallow((s) =>
      Object.values(s.approvals).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
  );
  const mode = useAgency((s) => s.mode);
  const pending = approvals.filter((a) => a.status === 'pending');
  const past = approvals.filter((a) => a.status !== 'pending').slice(0, 30);
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {mode === 'demo' ? <DemoBanner /> : null}
      <SectionTitle title={`Pendentes (${pending.length})`} icon="hand-left-outline" />
      {pending.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="Nada aguardando aprovação" />
      ) : (
        pending.map((a) => <ApprovalCard key={a.id} approval={a} />)
      )}
      {past.length > 0 ? <SectionTitle title="Recentes" icon="time-outline" /> : null}
      {past.map((a) => (
        <ApprovalCard key={a.id} approval={a} />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 40,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
});
