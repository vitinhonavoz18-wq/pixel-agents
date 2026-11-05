import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionBlock } from '../data/quiz';
import { COLORS, FONTS } from '../config/theme';

type Word = { text: string; hl: boolean };

const parse = (text: string): Word[] => {
  const words: Word[] = [];
  let hl = false;
  for (const raw of text.split(' ')) {
    const starts = raw.startsWith('*');
    if (starts) hl = true;
    const clean = raw.replace(/\*/g, '');
    words.push({ text: clean, hl });
    if (raw.replace(/[!?,.]+$/, '').endsWith('*') || (starts && raw.slice(1).includes('*'))) hl = false;
  }
  return words;
};

/** Legendas em blocos curtos, palavra a palavra. Usa frames absolutos. */
export const AnimatedCaptions: React.FC<{ blocks: CaptionBlock[]; y: number }> = ({ blocks, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const block = blocks.find((b) => frame >= b.from && frame < b.to);
  if (!block) return null;
  const words = parse(block.text);
  const local = frame - block.from;
  const out = interpolate(frame, [block.to - 3, block.to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        right: 90,
        top: y,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0 18px',
        opacity: out,
      }}
    >
      {words.map((w, i) => {
        const s = spring({ frame: local - i * 2, fps, config: { damping: 12, stiffness: 260, mass: 0.5 } });
        return (
          <span
            key={`${block.from}-${i}`}
            style={{
              fontFamily: FONTS.body,
              fontWeight: 900,
              fontSize: 62,
              lineHeight: 1.15,
              color: w.hl ? COLORS.yellow : COLORS.white,
              WebkitTextStroke: `12px ${COLORS.navy950}`,
              paintOrder: 'stroke fill',
              textShadow: '0 6px 16px rgba(0,0,0,0.55)',
              display: 'inline-block',
              transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px) scale(${interpolate(s, [0, 1], [0.7, 1])})`,
              opacity: interpolate(s, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
