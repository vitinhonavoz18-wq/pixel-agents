import React from 'react';
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../config/theme';
import { CheckIcon } from './Icons';

/** Selo "RESPOSTA CORRETA: B!" — frame 0 = instante da revelação. */
export const CorrectBanner: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 200, mass: 0.6 } });
  const check = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  const scale = interpolate(s, [0, 1], [0.3, 1]);
  const rot = interpolate(s, [0, 1], [-8, -2]);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        padding: '26px 46px 26px 30px',
        borderRadius: 999,
        background: `linear-gradient(180deg, ${COLORS.green} 0%, ${COLORS.greenDeep} 100%)`,
        border: '5px solid #BBF7D0',
        boxShadow: '0 0 70px rgba(34,197,94,0.6), 0 14px 0 rgba(0,0,0,0.25)',
        transform: `scale(${scale}) rotate(${rot}deg)`,
        opacity: interpolate(frame, [0, 3], [0, 1], { extrapolateRight: 'clamp' }),
      }}
    >
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: COLORS.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CheckIcon size={92} color={COLORS.greenDeep} progress={check} />
      </div>
      <div style={{ fontFamily: FONTS.display, fontSize: 82, color: COLORS.white, whiteSpace: 'nowrap', textShadow: '0 5px 0 rgba(0,0,0,0.25)' }}>
        {text}
      </div>
    </div>
  );
};

const PIECES = Array.from({ length: 50 }).map((_, i) => {
  const angle = -Math.PI / 2 + (random(`ca${i}`) - 0.5) * Math.PI * 1.5;
  const speed = 18 + random(`cs${i}`) * 26;
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    spin: (random(`cr${i}`) - 0.5) * 30,
    w: 12 + random(`cw${i}`) * 12,
    h: 18 + random(`ch${i}`) * 14,
    color: [COLORS.yellow, COLORS.green, COLORS.white, COLORS.orange, '#60A5FA'][i % 5],
    delay: Math.floor(random(`cd${i}`) * 4),
  };
});

/** Confetes discretos — física simples calculada a partir do frame. */
export const Confetti: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {PIECES.map((p, i) => {
        const t = frame - p.delay;
        if (t < 0) return null;
        const drag = Math.pow(0.93, t);
        const dist = (1 - drag) / (1 - 0.93);
        const px = x + p.vx * dist;
        const py = y + p.vy * dist + 0.55 * t * t;
        const opacity = interpolate(t, [0, 30, 55], [1, 1, 0], { extrapolateRight: 'clamp' });
        if (opacity <= 0) return null;
        return (
          <rect
            key={i}
            x={px - p.w / 2}
            y={py - p.h / 2}
            width={p.w}
            height={p.h * Math.abs(Math.cos((t * p.spin) / 40))}
            rx={3}
            fill={p.color}
            opacity={opacity}
            transform={`rotate(${t * p.spin} ${px} ${py})`}
          />
        );
      })}
    </svg>
  );
};
