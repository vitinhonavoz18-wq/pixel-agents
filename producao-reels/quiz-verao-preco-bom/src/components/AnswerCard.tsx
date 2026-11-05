import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../config/theme';
import { CheckIcon } from './Icons';

type Props = {
  letter: string;
  text: string;
  /** frame (relativo à sequência) em que o card entra */
  enterAt: number;
  /** frame (relativo) da revelação; antes disso NENHUM card tem destaque */
  revealAt: number;
  isCorrect: boolean;
};

export const CARD_W = 900;
export const CARD_H = 150;

export const AnswerCard: React.FC<Props> = ({ letter, text, enterAt, revealAt, isCorrect }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - enterAt, fps, config: { damping: 14, stiffness: 170 } });
  const x = interpolate(enter, [0, 1], [700, 0]);
  const opacity = interpolate(frame - enterAt, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // brilho que passa pela letra logo após a entrada
  const shine = interpolate(frame - enterAt, [6, 22], [-60, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const revealed = frame >= revealAt;
  const r = revealed ? spring({ frame: frame - revealAt, fps, config: { damping: 10, stiffness: 160 } }) : 0;

  let scale = 1;
  let cardOpacity = 1;
  let bg = COLORS.cardBg;
  let border = COLORS.cardBorder;
  let glow = '0 18px 40px rgba(0,0,0,0.35)';
  let badgeBg = COLORS.yellow;
  let badgeColor = COLORS.navy950;

  if (revealed && isCorrect) {
    scale = interpolate(r, [0, 1], [1, 1.07]);
    bg = `linear-gradient(90deg, ${COLORS.green} 0%, ${COLORS.greenDeep} 100%)`;
    border = '#86EFAC';
    const pulse = 0.5 + 0.5 * Math.sin((frame - revealAt) / 5);
    glow = `0 0 ${40 + pulse * 30}px rgba(34,197,94,${0.55 + pulse * 0.2}), 0 18px 40px rgba(0,0,0,0.35)`;
    badgeBg = COLORS.white;
    badgeColor = COLORS.greenDeep;
  } else if (revealed) {
    scale = interpolate(r, [0, 1], [1, 0.95]);
    cardOpacity = interpolate(r, [0, 1], [1, 0.35]);
  }

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 40,
        background: bg,
        border: `3px solid ${border}`,
        boxShadow: glow,
        display: 'flex',
        alignItems: 'center',
        padding: '0 30px',
        gap: 30,
        transform: `translateX(${x}px) scale(${scale})`,
        opacity: opacity * cardOpacity,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 30,
          background: badgeBg,
          color: badgeColor,
          fontFamily: FONTS.display,
          fontSize: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          boxShadow: '0 6px 0 rgba(0,0,0,0.25)',
        }}
      >
        {revealed && isCorrect ? <CheckIcon size={78} color={COLORS.greenDeep} progress={Math.min(1, r * 1.3)} /> : letter}
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: shine,
            width: 34,
            height: 160,
            background: 'rgba(255,255,255,0.65)',
            transform: 'rotate(25deg)',
          }}
        />
      </div>
      <div
        style={{
          fontFamily: FONTS.body,
          fontWeight: 800,
          fontSize: 48,
          color: COLORS.white,
          letterSpacing: -0.5,
          lineHeight: 1.1,
        }}
      >
        {text}
      </div>
    </div>
  );
};
