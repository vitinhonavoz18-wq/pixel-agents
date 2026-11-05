import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../config/theme';

type Props = {
  lines: string[];
  sizes: number[];
  highlight?: number[]; // índices das linhas em amarelo
  stagger?: number;
  startScale?: number;
  lineHeight?: number;
};

export const AnimatedTitle: React.FC<Props> = ({ lines, sizes, highlight = [], stagger = 4, startScale = 1.6, lineHeight = 1.02 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {lines.map((line, i) => {
        const local = frame - i * stagger;
        const s = spring({ frame: local, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
        const scale = interpolate(s, [0, 1], [startScale, 1]);
        // a primeira linha já aparece no frame 0 (sem tela vazia)
        const opacity = i === 0 ? 1 : interpolate(local, [0, 3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const yellow = highlight.includes(i);
        return (
          <div
            key={line}
            style={{
              fontFamily: FONTS.display,
              fontSize: sizes[i] ?? sizes[sizes.length - 1],
              lineHeight,
              color: yellow ? COLORS.yellow : COLORS.white,
              textTransform: 'uppercase',
              letterSpacing: 1,
              transform: `scale(${scale})`,
              opacity,
              textShadow: `0 8px 0 ${COLORS.navy950}, 0 14px 40px rgba(0,0,0,0.45)`,
              whiteSpace: 'nowrap',
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};
