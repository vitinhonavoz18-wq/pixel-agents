import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FONT_BRAND, FONT_UI} from '../styles/theme';
import {ease} from '../timeline/time';
import {Bokeh} from './PostFX';

/** Fundo das cenas digitais: o mesmo escritório, totalmente desfocado + grade de luz. */
export const DigitalBackdrop: React.FC<{t: number; tint?: number}> = ({t, tint = 0}) => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse 120% 70% at 50% 35%, #0e1650 0%, ${C.night} 55%, ${C.ink} 100%)`}}>
    <Bokeh t={t} count={22} seed={3} opacity={0.9} />
    {/* grade em perspectiva, muito sutil */}
    <AbsoluteFill style={{perspective: 900, overflow: 'hidden', opacity: 0.35}}>
      <div
        style={{
          position: 'absolute',
          left: -1000,
          right: -1000,
          top: 1250,
          height: 1400,
          transform: 'rotateX(72deg)',
          transformOrigin: 'top center',
          backgroundImage:
            'linear-gradient(rgba(50,230,255,0.25) 2px, transparent 2px), linear-gradient(90deg, rgba(50,230,255,0.25) 2px, transparent 2px)',
          backgroundSize: '120px 120px',
          backgroundPosition: `0 ${(t * 60) % 120}px`,
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,1), rgba(0,0,0,0) 70%)',
        }}
      />
    </AbsoluteFill>
    <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 25% at 50% 62%, rgba(124,72,255,${0.18 + tint * 0.1}), rgba(0,0,0,0) 70%)`}} />
  </AbsoluteFill>
);

/** Cartão de vidro fosco (interfaces). */
export const Glass: React.FC<{style?: React.CSSProperties; children?: React.ReactNode; glow?: number}> = ({style, children, glow = 0}) => (
  <div
    style={{
      position: 'absolute',
      borderRadius: 44,
      background: 'linear-gradient(160deg, rgba(28,39,112,0.78) 0%, rgba(11,16,64,0.86) 45%, rgba(5,7,26,0.92) 100%)',
      border: '1.5px solid rgba(111,216,255,0.22)',
      boxShadow: `0 50px 120px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 ${60 * glow}px rgba(50,230,255,${0.35 * glow})`,
      overflow: 'hidden',
      ...style,
    }}
  >
    {/* reflexo especular */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(115deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 32%)',
        pointerEvents: 'none',
      }}
    />
    {children}
  </div>
);

export const AiAvatar: React.FC<{size?: number}> = ({size = 84}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `conic-gradient(from 200deg, ${C.g0}, ${C.g1}, ${C.g2}, ${C.g0})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 0 30px rgba(91,123,255,0.55)',
      flexShrink: 0,
    }}
  >
    <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24">
      <path d="M12 2 L13.8 9.2 L21 11 L13.8 12.8 L12 20 L10.2 12.8 L3 11 L10.2 9.2 Z" fill="#fff" />
      <circle cx="19" cy="4.5" r="1.6" fill="#fff" opacity="0.85" />
    </svg>
  </div>
);

export const PersonAvatar: React.FC<{initials: string; hue: string; size?: number}> = ({initials, hue, size = 84}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(140deg, ${hue}, #1c2770)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT_UI,
      fontWeight: 700,
      fontSize: size * 0.36,
      color: '#fff',
      flexShrink: 0,
    }}
  >
    {initials}
  </div>
);

/** Balão de mensagem com entrada suave (slide + blur progressivo). */
export const Bubble: React.FC<{
  t: number;
  at: number;
  side: 'left' | 'right';
  children: React.ReactNode;
  maxWidth?: number;
}> = ({t, at, side, children, maxWidth = 640}) => {
  const p = ease(t, at, at + 0.45);
  if (p <= 0) return null;
  const right = side === 'right';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: right ? 'flex-end' : 'flex-start',
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})`,
        transformOrigin: right ? 'right bottom' : 'left bottom',
        filter: `blur(${(1 - p) * 8}px)`,
      }}
    >
      <div
        style={{
          maxWidth,
          padding: '22px 30px',
          borderRadius: 34,
          borderBottomLeftRadius: right ? 34 : 10,
          borderBottomRightRadius: right ? 10 : 34,
          fontFamily: FONT_UI,
          fontSize: 37,
          lineHeight: 1.3,
          fontWeight: 450,
          color: '#fff',
          background: right
            ? `linear-gradient(135deg, ${C.blue} 0%, #5b5cff 60%, ${C.violet} 100%)`
            : 'rgba(255,255,255,0.10)',
          border: right ? 'none' : '1px solid rgba(255,255,255,0.10)',
          boxShadow: right ? '0 16px 40px rgba(40,123,255,0.35)' : '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Indicador "digitando…" */
export const Typing: React.FC<{t: number; from: number; to: number}> = ({t, from, to}) => {
  const p = ease(t, from, from + 0.2) * (1 - ease(t, to - 0.12, to));
  if (p <= 0.01) return null;
  return (
    <div style={{display: 'flex', justifyContent: 'flex-end', opacity: p, height: 0, overflow: 'visible'}}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '22px 28px',
          borderRadius: 30,
          borderBottomRightRadius: 10,
          background: 'rgba(91,123,255,0.35)',
          transform: 'translateY(-4px)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              opacity: 0.4 + 0.6 * Math.max(0, Math.sin((t - from) * 9 - i * 0.9)),
            }}
          />
        ))}
      </div>
    </div>
  );
};

/** Trecho destacado dentro do balão (sublinhado de luz). */
export const Mark: React.FC<{t: number; at: number; children: React.ReactNode}> = ({t, at, children}) => {
  const p = ease(t, at, at + 0.5);
  return (
    <span style={{position: 'relative', display: 'inline', color: p > 0.5 ? '#bff6ff' : '#fff'}}>
      <span
        style={{
          position: 'absolute',
          left: -4,
          right: -4,
          bottom: -2,
          height: '42%',
          borderRadius: 8,
          background: 'linear-gradient(90deg, rgba(50,230,255,0.45), rgba(40,123,255,0.25))',
          transformOrigin: 'left center',
          transform: `scaleX(${p})`,
          zIndex: -1,
        }}
      />
      <span style={{position: 'relative'}}>{children}</span>
    </span>
  );
};

/** Etiqueta de intenção identificada. */
export const IntentChip: React.FC<{t: number; at: number; label: string; color: string}> = ({t, at, label, color}) => {
  const p = ease(t, at, at + 0.4);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 22px',
        borderRadius: 999,
        background: `${color}22`,
        border: `1.5px solid ${color}88`,
        color,
        fontFamily: FONT_BRAND,
        fontWeight: 600,
        fontSize: 26,
        letterSpacing: 0.5,
        opacity: p,
        transform: `translateX(${(1 - p) * -30}px)`,
        boxShadow: `0 0 ${24 * p}px ${color}44`,
      }}
    >
      <span style={{width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: `0 0 12px ${color}`}} />
      {label}
    </div>
  );
};

export const DramaTag: React.FC<{opacity: number}> = ({opacity}) => (
  <div
    style={{
      position: 'absolute',
      top: 150,
      width: '100%',
      textAlign: 'center',
      fontFamily: FONT_BRAND,
      fontSize: 20,
      letterSpacing: 5,
      color: 'rgba(223,230,255,0.5)',
      opacity,
    }}
  >
    DRAMATIZAÇÃO · INTERFACE E DADOS ILUSTRATIVOS
  </div>
);
