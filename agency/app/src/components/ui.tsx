import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, pixelShadow } from '../theme/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** FS Pixel Sans reads small; scale it up a notch and never below 11px. */
const pixelSize = (size: number) => Math.max(11, Math.round(size * 1.15));

export function Txt({
  style,
  size = 14,
  color = colors.text,
  muted,
  bold,
  ...rest
}: TextProps & { size?: number; color?: string; muted?: boolean; bold?: boolean }) {
  return (
    <Text
      {...rest}
      style={[
        // The pixel font turns to mush below ~10px on 1x screens.
        {
          fontFamily: fonts.pixel,
          fontSize: pixelSize(size),
          color: muted ? colors.textMuted : color,
          lineHeight: Math.round(pixelSize(size) * 1.3),
        },
        bold && styles.bold,
        style as StyleProp<TextStyle>,
      ]}
    />
  );
}

export function Panel({
  children,
  style,
  accent,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Border color — defaults to the discreet panel border. */
  accent?: string;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        styles.panel,
        padded && styles.padded,
        accent ? { borderColor: accent } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PixelButton({
  label,
  icon,
  onPress,
  variant = 'default',
  disabled,
  busy,
  style,
  small,
  a11yLabel,
}: {
  label?: string;
  /** Accessible name for icon-only buttons. */
  a11yLabel?: string;
  icon?: IconName;
  onPress?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const bg =
    variant === 'primary'
      ? colors.orange
      : variant === 'danger'
        ? colors.red
        : variant === 'success'
          ? colors.green
          : variant === 'ghost'
            ? 'transparent'
            : colors.panelAlt;
  const fg = variant === 'primary' ? colors.bgDeep : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? a11yLabel}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      onPress={disabled || busy ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        {
          backgroundColor: bg,
          borderColor:
            variant === 'ghost' ? colors.border : bg === colors.panelAlt ? colors.borderHi : bg,
        },
        variant !== 'ghost' && pixelShadow,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 14 : 18} color={fg} />
      ) : null}
      {label ? (
        <Txt size={small ? 12 : 14} color={fg} numberOfLines={1}>
          {label}
        </Txt>
      ) : null}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  badge,
  label,
  color = colors.text,
}: {
  icon: IconName;
  onPress?: () => void;
  badge?: number;
  label: string;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.iconButton}
      hitSlop={8}
    >
      <Ionicons name={icon} size={22} color={color} />
      {badge ? (
        <View style={styles.badge}>
          <Txt size={10} color="#fff">
            {badge > 99 ? '99+' : badge}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ProgressBar({
  value,
  color = colors.blue,
  height = 10,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      style={[styles.track, { height }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

export function Chip({
  label,
  color = colors.panelHi,
  textColor = colors.text,
  icon,
}: {
  label: string;
  color?: string;
  textColor?: string;
  icon?: IconName;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      {icon ? <Ionicons name={icon} size={11} color={textColor} /> : null}
      <Txt size={11} color={textColor} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

export function SectionTitle({
  title,
  right,
  icon,
}: {
  title: string;
  right?: ReactNode;
  icon?: IconName;
}) {
  return (
    <View style={styles.sectionTitle}>
      {icon ? <Ionicons name={icon} size={16} color={colors.orange} /> : null}
      <Txt size={15} style={styles.flex1}>
        {title}
      </Txt>
      {right}
    </View>
  );
}

export function EmptyState({
  icon = 'albums-outline',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.textDim} />
      <Txt size={15} style={styles.center}>
        {title}
      </Txt>
      {body ? (
        <Txt size={12} muted style={styles.center}>
          {body}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

/** Always-visible label whenever data is simulated. */
export function DemoBanner() {
  return (
    <View style={styles.demo} accessibilityRole="alert">
      <Ionicons name="flask-outline" size={14} color="#fff" />
      <Txt size={11} color="#fff">
        MODO DEMO — dados e atividades SIMULADOS, nenhum agente real está executando
      </Txt>
    </View>
  );
}

export function StatusDot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size / 2 }} />
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.kv}>
      <Txt size={12} muted style={styles.kvLabel}>
        {label}
      </Txt>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Txt size={13} style={styles.flex1}>
          {value}
        </Txt>
      ) : (
        <View style={styles.flex1}>{value}</View>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  flex1: { flex: 1 },
  center: { textAlign: 'center' },
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.border,
    ...pixelShadow,
  },
  padded: { padding: 12 },
  button: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSmall: { minHeight: 30, paddingHorizontal: 10, gap: 6 },
  disabled: { opacity: 0.45 },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
  iconButton: { padding: 6 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.demo,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  kv: { flexDirection: 'row', gap: 8, paddingVertical: 4, alignItems: 'flex-start' },
  kvLabel: { width: 110 },
});
