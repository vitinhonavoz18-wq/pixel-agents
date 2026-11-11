import React from 'react';
import {AbsoluteFill} from 'remotion';
import {DigitalBackdrop, Glass, IntentChip, PersonAvatar} from '../components/Chat';
import {C, FONT_BRAND, FONT_UI} from '../styles/theme';
import {TL, ease, easeIO, lin, mix} from '../timeline/time';

/** CENA 2 — 0:04–0:09 · AS MENSAGENS. Chegam uma a uma; a IA identifica a intenção de cada. */
const ROWS = [
  {at: TL.messages.m1, name: 'Ana Paula', ini: 'AP', hue: '#2bb8d9', time: '02:47', text: 'Oi, vocês atendem agora?', intent: 'Novo atendimento', color: C.cyan},
  {at: TL.messages.m2, name: 'Carla M.', ini: 'CM', hue: '#5b7bff', time: '02:48', text: 'Queria um orçamento.', intent: 'Orçamento', color: '#6f9bff'},
  {at: TL.messages.m3, name: 'Rafael S.', ini: 'RS', hue: '#9b5cff', time: '02:51', text: 'Tenho uma dúvida sobre os serviços.', intent: 'Dúvida frequente', color: C.violetSoft},
];

export const IntentRecognition: React.FC<{t: number}> = ({t}) => {
  // match cut: a interface "sai" da tela do celular
  const inP = ease(t, 3.95, 4.65);
  const cardScale = mix(1.7, 1, inP);
  const cardBlur = (1 - inP) * 14;
  const rotY = mix(-9, -3, easeIO(t, 4, 9));
  // saída: mergulha na conversa da Carla (orçamento)
  const outP = easeIO(t, 8.55, 9.2);
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);

  return (
    <AbsoluteFill>
      <DigitalBackdrop t={t} />
      <AbsoluteFill style={{perspective: 2200}}>
        <Glass
          style={{
            left: 90,
            top: 270,
            width: 900,
            height: 860,
            transform: `translateY(${outP * -60}px) scale(${cardScale * mix(1, 1.12, outP)}) rotateY(${rotY}deg) rotateX(5deg)`,
            filter: `blur(${cardBlur}px)`,
            opacity: Math.min(1, inP * 1.6) * (1 - lin(t, 8.95, 9.2)),
          }}
        >
          {/* cabeçalho */}
          <div style={{padding: '44px 52px 26px', borderBottom: '1px solid rgba(255,255,255,0.08)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 50, color: '#fff'}}>Mensagens</span>
              <span style={{fontFamily: FONT_UI, fontSize: 30, color: C.muted, fontVariantNumeric: 'tabular-nums'}}>02:51</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, fontFamily: FONT_UI, fontSize: 27, color: C.cyanSoft}}>
              <span style={{width: 14, height: 14, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 ${10 + 14 * pulse}px ${C.cyan}`}} />
              Atendimento automático ativo · identificando intenções
            </div>
          </div>
          {/* linhas */}
          <div style={{padding: '8px 0'}}>
            {ROWS.map((r, i) => {
              const p = ease(t, r.at, r.at + 0.5);
              const scan = lin(t, r.at + 0.12, r.at + 0.6);
              const chipAt = TL.sfx.tick[i];
              const sel = i === 1 ? ease(t, 8.3, 8.7) : 0;
              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    padding: '28px 52px',
                    display: 'flex',
                    gap: 28,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 60}px)`,
                    filter: `blur(${(1 - p) * 8}px)`,
                    background: sel ? `rgba(40,123,255,${0.18 * sel})` : undefined,
                    borderTop: i ? '1px solid rgba(255,255,255,0.06)' : undefined,
                    boxShadow: sel ? `inset 0 0 0 2px rgba(50,230,255,${0.6 * sel})` : undefined,
                  }}
                >
                  {/* linha de varredura da IA */}
                  {scan > 0 && scan < 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${scan * 100}%`,
                        width: 160,
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(90deg, rgba(50,230,255,0), rgba(50,230,255,0.28), rgba(50,230,255,0))',
                      }}
                    />
                  )}
                  <PersonAvatar initials={r.ini} hue={r.hue} />
                  <div style={{flex: 1}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 32, color: '#fff'}}>{r.name}</span>
                      <span style={{fontFamily: FONT_UI, fontSize: 26, color: C.muted}}>{r.time}</span>
                    </div>
                    <div style={{fontFamily: FONT_UI, fontSize: 37, color: C.mist, marginTop: 8, lineHeight: 1.25}}>{r.text}</div>
                    <div style={{marginTop: 18, height: 52}}>
                      <IntentChip t={t} at={chipAt} label={r.intent} color={r.color} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
