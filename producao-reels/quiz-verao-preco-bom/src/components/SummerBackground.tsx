import React from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { COLORS } from '../config/theme';

type Props = {
  /** 0 = azul frio, 1 = calor máximo (glow laranja) */
  heat?: number;
  /** pulso vermelho de urgência (0–1) */
  urgency?: number;
};

const PARTICLES = Array.from({ length: 34 }).map((_, i) => ({
  x: random(`px${i}`) * 1080,
  y: random(`py${i}`) * 1920,
  r: 2 + random(`pr${i}`) * 5,
  speed: 0.4 + random(`ps${i}`) * 1.2,
  phase: random(`ph${i}`) * Math.PI * 2,
  alpha: 0.15 + random(`pa${i}`) * 0.45,
}));

export const SummerBackground: React.FC<Props> = ({ heat = 0.35, urgency = 0 }) => {
  const frame = useCurrentFrame();

  const waves = [0, 1, 2].map((k) => {
    const y0 = 1600 + k * 70;
    const amp = 18 + k * 6;
    const phase = frame * (0.08 + k * 0.03) + k;
    let d = `M -20 ${y0}`;
    for (let x = -20; x <= 1100; x += 30) {
      d += ` L ${x} ${y0 + Math.sin(x / 90 + phase) * amp}`;
    }
    return { d, alpha: 0.1 + 0.05 * (2 - k) };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.navy950, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 80% at 50% 18%, ${COLORS.navy700} 0%, ${COLORS.navy800} 38%, ${COLORS.navy900} 70%, ${COLORS.navy950} 100%)`,
        }}
      />
      {/* glow de calor no topo */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 35% at 50% 8%, rgba(255,170,40,${0.18 + heat * 0.3}) 0%, rgba(255,120,30,0) 70%)`,
        }}
      />
      {/* brilho inferior laranja */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(90% 30% at 50% 108%, rgba(255,138,31,${0.12 + heat * 0.25}) 0%, rgba(255,138,31,0) 70%)`,
        }}
      />
      {urgency > 0 ? (
        <AbsoluteFill
          style={{
            boxShadow: `inset 0 0 ${220 + urgency * 120}px rgba(255,60,40,${0.45 * urgency})`,
          }}
        />
      ) : null}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {PARTICLES.map((p, i) => {
          const y = (p.y - frame * p.speed * 3 + 1920 * 4) % 1920;
          const x = p.x + Math.sin(frame / 25 + p.phase) * 14;
          const tw = 0.6 + 0.4 * Math.sin(frame / 9 + p.phase);
          return <circle key={i} cx={x} cy={y} r={p.r} fill={i % 3 === 0 ? COLORS.yellow : COLORS.white} opacity={p.alpha * tw} />;
        })}
        {waves.map((w, i) => (
          <path key={i} d={w.d} fill="none" stroke={COLORS.yellow} strokeWidth={5} strokeLinecap="round" opacity={w.alpha * interpolate(heat, [0, 1], [0.6, 1.4])} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
