import React from 'react';
import {AbsoluteFill} from 'remotion';
import {InfinityMark} from '../components/ConectflyLogo';
import {Bokeh} from '../components/PostFX';
import {BRAND_GRADIENT, C, FONT_BRAND, FONT_UI} from '../styles/theme';
import {ease, easeIO, hash, lin, mix} from '../timeline/time';

/** CENA 6 — 0:26–0:30 · A REVELAÇÃO FINAL. Feixe azul, partículas formam o símbolo oficial. */

// Segmentos cúbicos ABSOLUTOS equivalentes ao path oficial (viewBox 48x24) — usados só p/ alvos das partículas.
type P = [number, number];
const SEGS: [P, P, P, P][] = [
  [[24, 12], [27, 7.6], [30.2, 3.5], [35, 3.5]],
  [[35, 3.5], [39.8, 3.5], [43.5, 7.3], [43.5, 12]],
  [[43.5, 12], [43.5, 16.7], [39.8, 20.5], [35, 20.5]],
  [[35, 20.5], [30.2, 20.5], [27, 16.4], [24, 12]],
  [[24, 12], [21, 7.6], [17.8, 3.5], [13, 3.5]],
  [[13, 3.5], [8.2, 3.5], [4.5, 7.3], [4.5, 12]],
  [[4.5, 12], [4.5, 16.7], [8.2, 20.5], [13, 20.5]],
  [[13, 20.5], [17.8, 20.5], [21, 16.4], [24, 12]],
];
const bez = (s: [P, P, P, P], u: number): P => {
  const v = 1 - u;
  const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0], a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1]];
};
const N = 140;
const TARGETS = Array.from({length: N}, (_, i) => {
  const x = (i / N) * SEGS.length;
  return bez(SEGS[Math.floor(x)], x - Math.floor(x));
});

const LOGO_W = 560;
const LOGO_X = 540 - LOGO_W / 2;
const LOGO_Y = 560;

export const BrandFinale: React.FC<{t: number}> = ({t}) => {
  const T0 = 26.0;
  const beam = lin(t, T0, T0 + 0.55);
  const gather = easeIO(t, T0 + 0.1, T0 + 1.0);
  const draw = easeIO(t, T0 + 0.45, T0 + 1.45);
  const glow = ease(t, T0 + 1.2, T0 + 1.8) * (0.55 + 0.1 * Math.sin(t * 3));
  const word = ease(t, T0 + 1.15, T0 + 1.9);
  const tag = ease(t, T0 + 1.6, T0 + 2.3);
  const cta = ease(t, T0 + 2.2, T0 + 2.8);
  const site = ease(t, T0 + 2.5, T0 + 3.1);
  const sc = LOGO_W / 48;
  const drift = mix(1.04, 1, easeIO(t, T0, 30));

  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 90% 60% at 50% 38%, #0b1446 0%, ${C.night} 50%, ${C.ink} 100%)`}}>
      <Bokeh t={t} count={10} seed={21} opacity={0.35 * ease(t, T0 + 0.8, T0 + 2)} />
      <AbsoluteFill style={{transform: `scale(${drift})`}}>
        {/* feixe azul horizontal percorrendo a tela */}
        {beam > 0 && beam < 1 && (
          <div
            style={{
              position: 'absolute',
              top: LOGO_Y + LOGO_W / 4 - 3,
              left: mix(-400, 1080, beam) - 300,
              width: 600,
              height: 6,
              background: 'linear-gradient(90deg, rgba(50,230,255,0), #bff6ff, rgba(40,123,255,0))',
              boxShadow: '0 0 40px 10px rgba(50,230,255,0.45)',
              borderRadius: 6,
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            top: LOGO_Y + LOGO_W / 4 - 1,
            left: 0,
            width: 1080,
            height: 2,
            background: 'linear-gradient(90deg, rgba(40,123,255,0), rgba(50,230,255,0.5), rgba(40,123,255,0))',
            opacity: Math.sin(Math.PI * lin(t, T0, T0 + 1.2)) * 0.8,
          }}
        />
        {/* partículas convergindo para a geometria do símbolo */}
        {gather < 1 &&
          TARGETS.map(([tx, ty], i) => {
            const sx = hash(i) * 1080;
            const sy = LOGO_Y + LOGO_W / 4 + (hash(i + 99) - 0.5) * 600;
            const g = easeIO(t, T0 + 0.05 + hash(i + 7) * 0.25, T0 + 0.75 + hash(i + 7) * 0.25);
            const x = mix(sx, LOGO_X + tx * sc, g);
            const y = mix(sy, LOGO_Y + ty * sc, g);
            const a = lin(t, T0, T0 + 0.2) * (1 - lin(draw, 0.4, 1));
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x - 3,
                  top: y - 3,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i % 3 === 0 ? C.g2 : i % 3 === 1 ? C.g1 : C.g0,
                  boxShadow: `0 0 10px ${C.cyan}`,
                  opacity: a,
                }}
              />
            );
          })}
        {/* símbolo oficial (proporção 2:1 preservada) */}
        <div style={{position: 'absolute', left: LOGO_X, top: LOGO_Y}}>
          <InfinityMark width={LOGO_W} draw={draw} glow={glow} id="finale" />
        </div>
        {/* wordmark */}
        <div style={{position: 'absolute', top: LOGO_Y + LOGO_W / 2 + 70, width: '100%', textAlign: 'center'}}>
          <div
            style={{
              fontFamily: FONT_BRAND,
              fontWeight: 600,
              fontSize: 132,
              letterSpacing: -1.3,
              color: '#fff',
              opacity: word,
              filter: `blur(${(1 - word) * 12}px)`,
              transform: `translateY(${(1 - word) * 20}px)`,
              textShadow: '0 0 40px rgba(91,123,255,0.35)',
            }}
          >
            ConectFly
          </div>
          <div style={{fontFamily: FONT_BRAND, fontWeight: 500, fontSize: 33, letterSpacing: 6, marginTop: 16, opacity: tag, transform: `translateY(${(1 - tag) * 14}px)`, color: C.mist}}>
            <span style={{color: C.cyan}}>INTELIGÊNCIA</span> PARA O SEU NEGÓCIO
          </div>
        </div>
        {/* CTA */}
        <div style={{position: 'absolute', top: 1300, width: '100%', display: 'flex', justifyContent: 'center', opacity: cta, transform: `scale(${0.92 + 0.08 * cta})`}}>
          <div style={{padding: 3, borderRadius: 999, background: BRAND_GRADIENT, boxShadow: `0 0 ${50 * cta}px rgba(91,123,255,0.55)`}}>
            <div style={{padding: '22px 56px', borderRadius: 999, background: C.night, fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 46, color: '#fff', display: 'flex', alignItems: 'center', gap: 18}}>
              <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12Z" />
              </svg>
              Comente <span style={{background: BRAND_GRADIENT, WebkitBackgroundClip: 'text', color: 'transparent'}}>IA</span>
            </div>
          </div>
        </div>
        <div style={{position: 'absolute', top: 1430, width: '100%', textAlign: 'center', fontFamily: FONT_UI, fontSize: 30, letterSpacing: 1, color: 'rgba(223,230,255,0.75)', opacity: site}}>
          site.conectfly.com.br · @conectfly.app
        </div>
      </AbsoluteFill>
      {/* clarão de impacto, controlado */}
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 36%, rgba(120,190,255,0.55), rgba(0,0,0,0) 55%)', opacity: Math.max(0, 1 - lin(t, T0, T0 + 0.6)) * ease(t, T0 - 0.05, T0 + 0.05), mixBlendMode: 'screen'}} />
    </AbsoluteFill>
  );
};
