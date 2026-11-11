import React from 'react';
import {AbsoluteFill} from 'remotion';
import {OfficeSet} from '../components/OfficeSet';
import {Haze} from '../components/PostFX';
import {C, FONT_BRAND} from '../styles/theme';
import {TL, WORDS, ease, easeIO, lin, mix} from '../timeline/time';

/** CENA 1 — 0:00–0:04 · O MISTÉRIO. Escritório vazio às 02:47, o celular vibra. */
const vibrationShake = (t: number) => {
  let s = 0;
  for (const v of TL.sfx.vibrate) {
    for (const d of [0, 0.22, 0.44]) {
      const a = v + d;
      if (t >= a && t < a + 0.15) s = Math.sin((t - a) * 2 * Math.PI * 28) * 5;
    }
  }
  return s;
};

export const CinematicOpening: React.FC<{t: number}> = ({t}) => {
  // dolly-in lento e, no fim, "mergulho" na tela do celular (match cut para a cena 2)
  const dolly = mix(1, 1.2, easeIO(t, 0, 3.7));
  const plunge = Math.pow(lin(t, 3.62, 4.2), 2.2);
  const zoom = dolly * mix(1, 4.2, plunge);
  const lit = ease(t, TL.sfx.vibrate[0], TL.sfx.vibrate[0] + 0.25);
  const fadeIn = 0.78 * (1 - ease(t, 0, 0.9));

  // título "NÃO É HUMANO." sincronizado com a fala
  const hero = WORDS.filter((w) => w.line === 1).slice(-3);
  const heroOut = 1 - lin(t, 3.85, 4.1);

  // tag de episódio (gancho dos primeiros segundos)
  const tagIn = ease(t, 0.25, 1.1);
  const tagOut = 1 - lin(t, 2.55, 2.95);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: `blur(${plunge * 7}px)`}}>
        <OfficeSet
          t={t}
          dawn={0}
          zoom={zoom}
          focus={[540, 1400]}
          phoneLit={lit}
          phoneShake={vibrationShake(t)}
          clock="02:47"
          notifText={lit > 0 ? 'Oi, vocês atendem agora?' : undefined}
        />
        <Haze opacity={0.1} y={62} />
      </AbsoluteFill>

      {/* Gancho: EP. 01 */}
      <AbsoluteFill style={{opacity: tagIn * tagOut}}>
        <div style={{position: 'absolute', top: 250, width: '100%', textAlign: 'center', transform: `translateY(${(1 - tagIn) * 18}px)`}}>
          <div style={{fontFamily: FONT_BRAND, fontWeight: 500, fontSize: 24, letterSpacing: 9, color: C.muted}}>
            CONECTFLY ORIGINALS · EP. 01
          </div>
          <div style={{fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 50, color: C.white, marginTop: 18, lineHeight: 1.18, textShadow: '0 6px 30px rgba(0,0,0,0.8)'}}>
            O funcionário que
            <br />
            trabalha{' '}
            <span style={{color: C.cyan, textShadow: '0 0 26px rgba(50,230,255,0.6)'}}>24 horas</span>
          </div>
        </div>
      </AbsoluteFill>

      {/* NÃO É HUMANO. */}
      <AbsoluteFill style={{opacity: heroOut}}>
        <div style={{position: 'absolute', top: 560, width: '100%', display: 'flex', justifyContent: 'center', gap: 28}}>
          {['NÃO', 'É', 'HUMANO.'].map((w, i) => {
            const p = ease(t, hero[i].start - 0.05, hero[i].start + 0.45);
            return (
              <span
                key={w}
                style={{
                  fontFamily: FONT_BRAND,
                  fontWeight: 700,
                  fontSize: 112,
                  letterSpacing: 4,
                  color: i === 2 ? C.cyan : C.white,
                  opacity: p,
                  filter: `blur(${(1 - p) * 14}px)`,
                  transform: `translateY(${(1 - p) * 24}px) scale(${1.08 - 0.08 * p})`,
                  textShadow: i === 2 ? '0 0 40px rgba(50,230,255,0.55)' : '0 0 30px rgba(120,160,255,0.35)',
                  display: 'inline-block',
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* abre do quase-preto (sem frame preto puro) */}
      <AbsoluteFill style={{background: '#000', opacity: fadeIn}} />
      {/* clarão da tela no mergulho (match cut) */}
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 70%, rgba(110,180,255,0.9), rgba(20,40,120,0) 60%)', opacity: plunge * 0.8, mixBlendMode: 'screen'}} />
    </AbsoluteFill>
  );
};
