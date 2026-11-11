import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Glass} from '../components/Chat';
import {OfficeSet} from '../components/OfficeSet';
import {Haze} from '../components/PostFX';
import {C, FONT_BRAND, FONT_UI} from '../styles/theme';
import {TL, ease, easeIO, lin, mix} from '../timeline/time';

/** CENA 5 — 0:21–0:26 · O RESULTADO. Amanhecer; o empresário chega e abre o painel. */
const TILES = [
  {n: 12, label: 'Solicitações\norganizadas', color: C.cyan},
  {n: 18, label: 'Atendimentos\nregistrados', color: '#6f9bff'},
  {n: 3, label: 'Pendências\nencaminhadas', color: '#ffb877'},
];

export const DashboardReveal: React.FC<{t: number}> = ({t}) => {
  const zoom = mix(1.14, 1.0, easeIO(t, 20.9, 25.8));
  const person = easeIO(t, 21.15, 22.1);
  const panel = ease(t, 21.85, 22.6);
  const dawn = mix(0.75, 1, lin(t, 21, 23));
  const toDark = easeIO(t, 25.45, 26.05);

  return (
    <AbsoluteFill>
      <OfficeSet t={t} dawn={dawn} zoom={zoom} focus={[540, 1100]} person={person} steam={ease(t, 21.6, 22.6)} clock="07:58" />
      <Haze opacity={0.14} color="255,170,110" y={45} />
      <AbsoluteFill style={{perspective: 2000}}>
        <Glass
          style={{
            left: 70,
            top: 1010,
            width: 940,
            height: 345,
            opacity: panel,
            background: 'linear-gradient(160deg, rgba(28,39,112,0.93) 0%, rgba(11,16,64,0.96) 45%, rgba(5,7,26,0.97) 100%)',
            transform: `translateY(${(1 - panel) * 90}px) rotateX(${mix(18, 6, panel)}deg) scale(${mix(0.92, 1, panel)})`,
            filter: `blur(${(1 - panel) * 8}px)`,
          }}
        >
          <div style={{padding: '26px 40px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div>
              <div style={{fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 36, color: '#fff'}}>Bom dia! Resumo da madrugada</div>
              <div style={{fontFamily: FONT_UI, fontSize: 23, color: C.muted, marginTop: 4}}>00:00 – 07:58 · atendimento automático</div>
            </div>
            <div style={{fontFamily: FONT_UI, fontSize: 19, letterSpacing: 2, color: 'rgba(223,230,255,0.6)', border: '1px solid rgba(223,230,255,0.3)', borderRadius: 999, padding: '6px 14px'}}>
              EXEMPLO ILUSTRATIVO
            </div>
          </div>
          <div style={{display: 'flex', gap: 20, padding: '24px 40px'}}>
            {TILES.map((tile, i) => {
              const at = TL.messages.dash[i];
              const p = ease(t, at, at + 0.7);
              const num = Math.round(tile.n * p);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    padding: '20px 24px',
                    borderRadius: 26,
                    background: '#141c50',
                    border: `1.5px solid ${tile.color}55`,
                    opacity: Math.min(1, ease(t, at - 0.2, at + 0.2) * 1.2),
                    transform: `translateY(${(1 - ease(t, at - 0.2, at + 0.3)) * 30}px)`,
                  }}
                >
                  <div style={{fontFamily: FONT_BRAND, fontWeight: 700, fontSize: 64, color: tile.color, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 24px ${tile.color}66`}}>{num}</div>
                  <div style={{fontFamily: FONT_UI, fontSize: 25, color: C.mist, lineHeight: 1.25, whiteSpace: 'pre-line'}}>{tile.label}</div>
                </div>
              );
            })}
          </div>
        </Glass>
      </AbsoluteFill>
      {/* a tela escurece suavemente para a revelação */}
      <AbsoluteFill style={{background: C.ink, opacity: toDark}} />
    </AbsoluteFill>
  );
};
