import React from 'react';
import { interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COUNTDOWN_SECONDS, FRAMES_PER_COUNT } from '../config/timing';
import { COLORS, FONTS } from '../config/theme';

/**
 * Cronômetro circular. Deve ser usado dentro de uma <Sequence> que começa
 * exatamente no início da contagem: frame 0 = "5", frame 149 = fim do "1".
 * Todo o cálculo vem do frame atual (sem timers do navegador).
 */
export const CountdownTimer: React.FC<{ size?: number }> = ({ size = 320 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = COUNTDOWN_SECONDS * FRAMES_PER_COUNT;

  const clamped = Math.min(Math.max(frame, 0), total - 1);
  const index = Math.floor(clamped / FRAMES_PER_COUNT); // 0..4
  const value = COUNTDOWN_SECONDS - index; // 5..1
  const inSecond = clamped - index * FRAMES_PER_COUNT;

  const progress = 1 - Math.min(frame, total) / total; // 1 → 0
  const urgent = value <= 2;

  const pop = spring({ frame: inSecond, fps, config: { damping: 9, stiffness: 260, mass: 0.5 } });
  const numScale = interpolate(pop, [0, 1], [urgent ? 1.6 : 1.4, 1]);
  const numOpacity = interpolate(inSecond, [0, 3], [0.2, 1], { extrapolateRight: 'clamp' });
  const shake = urgent ? Math.sin(frame * 2.2) * 5 : 0;

  const ringColor = interpolateColors(frame, [0, total * 0.55, total * 0.8, total], [COLORS.yellow, COLORS.orange, COLORS.hot, COLORS.hot]);
  const pulse = 1 + 0.06 * Math.max(0, 1 - inSecond / 8) * (urgent ? 1.6 : 1);

  const stroke = 24;
  const r = size / 2 - stroke;
  const circ = 2 * Math.PI * r;

  return (
    <div style={{ width: size, height: size, position: 'relative', transform: `scale(${pulse}) translateX(${shake}px)` }}>
      <div
        style={{
          position: 'absolute',
          inset: 18,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,210,31,${urgent ? 0.28 : 0.16}) 0%, rgba(4,12,34,0.8) 70%)`,
          boxShadow: `0 0 ${urgent ? 90 : 50}px ${urgent ? 'rgba(255,77,46,0.55)' : 'rgba(255,210,31,0.35)'}`,
        }}
      />
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.display,
          fontSize: size * 0.58,
          color: urgent ? COLORS.white : COLORS.yellow,
          transform: `scale(${numScale})`,
          opacity: numOpacity,
          textShadow: `0 8px 0 ${COLORS.navy950}, 0 0 40px ${urgent ? 'rgba(255,77,46,0.8)' : 'rgba(255,210,31,0.5)'}`,
          lineHeight: 1,
          paddingTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  );
};
