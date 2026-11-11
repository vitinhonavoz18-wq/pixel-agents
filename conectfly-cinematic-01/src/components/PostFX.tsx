import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

/** Film grain discreto (muda a cada frame, determinístico). */
export const FilmGrain: React.FC<{opacity?: number}> = ({opacity = 0.075}) => {
  const f = useCurrentFrame();
  const seed = f % 12;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity}}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Vinheta cinematográfica + leve "lift" de pretos (grading filmic). */
export const Vignette: React.FC<{strength?: number}> = ({strength = 0.75}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 85% 70% at 50% 48%, rgba(0,0,0,0) 45%, rgba(1,2,10,${strength}) 100%)`,
    }}
  />
);

/** Névoa atmosférica extremamente sutil. */
export const Haze: React.FC<{opacity?: number; color?: string; y?: number}> = ({
  opacity = 0.12,
  color = '40,80,200',
  y = 55,
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 120% 40% at 50% ${y}%, rgba(${color},${opacity}) 0%, rgba(${color},0) 70%)`,
    }}
  />
);

/** Bokeh de luzes desfocadas (profundidade de campo). */
export const Bokeh: React.FC<{t: number; count?: number; seed?: number; warm?: boolean; opacity?: number}> = ({
  t,
  count = 18,
  seed = 1,
  warm = false,
  opacity = 1,
}) => {
  const h = (n: number) => {
    const x = Math.sin((n + seed * 97) * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      {Array.from({length: count}).map((_, i) => {
        const size = 40 + h(i) * 160;
        const x = h(i + 10) * 1080 + Math.sin(t * 0.3 + i) * 12;
        const y = h(i + 20) * 1920 - t * (4 + h(i + 5) * 6);
        const hue = warm ? (h(i + 30) > 0.5 ? '255,184,119' : '255,140,90') : h(i + 30) > 0.6 ? '124,72,255' : h(i + 30) > 0.3 ? '40,123,255' : '50,230,255';
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${hue},${0.22 + h(i + 40) * 0.2}) 0%, rgba(${hue},0.08) 55%, rgba(${hue},0) 70%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Feixe de luz que atravessa a tela (transições motivadas por luz). */
export const LightSweep: React.FC<{p: number; color?: string; angle?: number; width?: number}> = ({
  p,
  color = '50,230,255',
  angle = -18,
  width = 260,
}) => {
  if (p <= 0 || p >= 1) return null;
  const x = -600 + p * 2300;
  const a = Math.sin(p * Math.PI);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: -400,
          width,
          height: 2800,
          transform: `rotate(${angle}deg)`,
          background: `linear-gradient(90deg, rgba(${color},0) 0%, rgba(${color},${0.35 * a}) 45%, rgba(255,255,255,${0.55 * a}) 50%, rgba(${color},${0.35 * a}) 55%, rgba(${color},0) 100%)`,
          filter: 'blur(6px)',
        }}
      />
    </AbsoluteFill>
  );
};
