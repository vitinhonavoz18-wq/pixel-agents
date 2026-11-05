import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../config/theme';
import { QUIZ } from '../data/quiz';

// Logo oficial enviada pelo cliente (150 × 150 px).
export const LOGO = staticFile('images/logo-farmacia-preco-bom.png');

/** Selo pequeno no topo, discreto, durante o quiz. */
export const BrandBadge: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity }}>
    <Img src={LOGO} style={{ width: 64, height: 64, borderRadius: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }} />
    <div style={{ fontFamily: FONTS.body, fontWeight: 800, fontSize: 28, color: COLORS.white, letterSpacing: 0.5 }}>{QUIZ.brandName}</div>
  </div>
);

/** Assinatura final — frame 0 = início da entrada. */
export const BrandSignature: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '22px 40px 22px 22px',
        borderRadius: 36,
        background: 'rgba(255,255,255,0.08)',
        border: `3px solid ${COLORS.cardBorder}`,
        transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`,
        opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }),
      }}
    >
      <Img src={LOGO} style={{ width: 150, height: 150, borderRadius: 28, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: FONTS.display, fontSize: 60, color: COLORS.white, lineHeight: 1 }}>{QUIZ.brandName.toUpperCase()}</div>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 32, color: COLORS.yellow }}>{QUIZ.brandCity}</div>
      </div>
    </div>
  );
};
