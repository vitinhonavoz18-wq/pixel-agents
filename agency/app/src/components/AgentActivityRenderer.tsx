import { Ionicons } from '@expo/vector-icons';
import { ACTIVITY_LABELS, type AgentActivityState, isWorking } from '@pixel-agency/shared';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme/theme';
import type { IconName } from './ui';
import { Txt } from './ui';

export const ACTIVITY_STYLE: Record<AgentActivityState, { color: string; icon: IconName }> = {
  offline: { color: colors.textDim, icon: 'moon-outline' },
  idle: { color: colors.textMuted, icon: 'cafe-outline' },
  planning: { color: colors.purple, icon: 'bulb-outline' },
  reading: { color: colors.blueSoft, icon: 'book-outline' },
  coding: { color: colors.blue, icon: 'code-slash-outline' },
  running_command: { color: colors.orange, icon: 'terminal-outline' },
  testing: { color: colors.amber, icon: 'flask-outline' },
  reviewing: { color: colors.blueSoft, icon: 'git-compare-outline' },
  awaiting_approval: { color: colors.amber, icon: 'hand-left-outline' },
  done: { color: colors.green, icon: 'checkmark-circle-outline' },
  failed: { color: colors.red, icon: 'alert-circle-outline' },
};

/**
 * AgentActivityRenderer — the HUD counterpart of the office animation: a
 * pulsing badge for the agent's REAL operational state (derived from backend
 * events). Pulses only while working.
 */
export function AgentActivityRenderer({
  activity,
  statusText,
  demo,
  compact,
}: {
  activity: AgentActivityState;
  statusText?: string;
  demo?: boolean;
  compact?: boolean;
}) {
  const style = ACTIVITY_STYLE[activity];
  const working = isWorking(activity);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (working) pulse.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
    else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }
  }, [working, pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View
      style={s.row}
      accessibilityLabel={`${ACTIVITY_LABELS[activity]}${statusText ? `: ${statusText}` : ''}`}
    >
      <Animated.View style={[s.dot, { backgroundColor: style.color }, dot]} />
      <Ionicons name={style.icon} size={compact ? 13 : 16} color={style.color} />
      <View style={s.flex}>
        <Txt size={compact ? 11 : 13} color={style.color} numberOfLines={1}>
          {ACTIVITY_LABELS[activity]}
          {demo ? ' (DEMO)' : ''}
        </Txt>
        {!compact && statusText ? (
          <Txt size={11} muted numberOfLines={2}>
            {statusText}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
});
