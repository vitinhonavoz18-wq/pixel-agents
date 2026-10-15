import type { Mission } from '@pixel-agency/shared';
import { ScrollView, StyleSheet, View } from 'react-native';

import { KANBAN_COLUMNS } from '../lib/labels';
import { colors } from '../theme/theme';
import { MissionCard } from './MissionCard';
import { Txt } from './ui';

/**
 * Agency missions as a kanban. Progress bars reflect the mission STATE
 * (queued → running → approval → tests), never an invented percentage.
 */
export function KanbanBoard({
  missions,
  compact,
  columnWidth = 220,
  maxPerColumn,
}: {
  missions: Mission[];
  compact?: boolean;
  columnWidth?: number;
  maxPerColumn?: number;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.row}>
      {KANBAN_COLUMNS.map((col) => {
        const items = missions
          .filter((m) => col.statuses.includes(m.status) && m.kind === 'task')
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const shown = maxPerColumn ? items.slice(0, maxPerColumn) : items;
        return (
          <View key={col.key} style={[s.col, { width: columnWidth, borderTopColor: col.color }]}>
            <Txt size={12} color={col.color}>
              {col.title} ({items.length})
            </Txt>
            <ScrollView style={s.list} contentContainerStyle={s.listInner} nestedScrollEnabled>
              {shown.map((m) => (
                <MissionCard key={m.id} mission={m} compact={compact} />
              ))}
              {items.length === 0 ? (
                <Txt size={10} color={colors.textDim}>
                  —
                </Txt>
              ) : null}
              {maxPerColumn && items.length > maxPerColumn ? (
                <Txt size={10} muted>
                  +{items.length - maxPerColumn}
                </Txt>
              ) : null}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { gap: 8, paddingBottom: 4 },
  col: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    padding: 8,
    gap: 6,
  },
  list: { flexGrow: 0 },
  listInner: { gap: 6 },
});
