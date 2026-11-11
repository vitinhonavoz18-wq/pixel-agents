import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AiAvatar} from '../components/Chat';
import {Bokeh, Haze} from '../components/PostFX';
import {C, FONT_BRAND, FONT_UI} from '../styles/theme';
import {TL, ease, easeIO, lin, mix} from '../timeline/time';

/** CENA 4 — 0:16–0:21 · A TRANSFERÊNCIA HUMANA */

const PersonIcon: React.FC<{size: number; glow: number}> = ({size, glow}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(140deg,#ffb877,#c26a3a)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 0 ${10 + 40 * glow}px rgba(255,184,119,${0.3 + 0.5 * glow})`,
      flexShrink: 0,
    }}
  >
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4.2" fill="#fff" />
      <path d="M3.5 21c.8-4.4 4.2-7 8.5-7s7.7 2.6 8.5 7" fill="#fff" />
    </svg>
  </div>
);

/** Painel do handoff: IA -> especialista humano, com pulso de luz viajando. */
export const HandoffFlow: React.FC<{t: number}> = ({t}) => {
  const status = ease(t, TL.messages.hStatus, TL.messages.hStatus + 0.45);
  const travel = easeIO(t, TL.messages.hStatus + 0.1, TL.messages.hArrive);
  const arrived = ease(t, TL.messages.hArrive - 0.1, TL.messages.hArrive + 0.3);
  const x0 = 160;
  const x1 = 740;
  return (
    <div style={{position: 'absolute', inset: 0, padding: '28px 44px'}}>
      <div style={{display: 'flex', justifyContent: 'center'}}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 26px',
            borderRadius: 999,
            fontFamily: FONT_BRAND,
            fontWeight: 600,
            fontSize: 27,
            letterSpacing: 2.5,
            color: '#fff',
            background: 'linear-gradient(90deg, rgba(50,230,255,0.25), rgba(124,72,255,0.3))',
            border: '1.5px solid rgba(111,216,255,0.6)',
            opacity: 0.25 + 0.75 * status,
            transform: `scale(${0.9 + 0.1 * status})`,
            boxShadow: `0 0 ${30 * status}px rgba(50,230,255,0.4)`,
          }}
        >
          <span style={{width: 12, height: 12, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 12px ${C.cyan}`}} />
          {status > 0.05 ? 'ENCAMINHADO PARA ESPECIALISTA' : 'ANALISANDO PEDIDO…'}
        </div>
      </div>
      <div style={{position: 'relative', height: 190, marginTop: 14}}>
        <svg width={812} height={190} style={{position: 'absolute', left: 0, top: 0}}>
          <defs>
            <linearGradient id="hf" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={C.g0} />
              <stop offset="0.5" stopColor={C.g1} />
              <stop offset="1" stopColor="#ffb877" />
            </linearGradient>
          </defs>
          <line x1={x0} y1={70} x2={x1} y2={70} stroke="rgba(255,255,255,0.12)" strokeWidth={4} strokeDasharray="10 12" />
          <line x1={x0} y1={70} x2={mix(x0, x1, travel)} y2={70} stroke="url(#hf)" strokeWidth={5} strokeLinecap="round" />
          {travel > 0 && travel < 1 && <circle cx={mix(x0, x1, travel)} cy={70} r={12} fill="#fff" style={{filter: 'drop-shadow(0 0 12px #32e6ff)'}} />}
        </svg>
        <div style={{position: 'absolute', left: 0, top: 22, width: 320, display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          <div style={{marginLeft: 112}}><AiAvatar size={96} /></div>
          <div style={{fontFamily: FONT_UI, fontSize: 26, color: C.mist, marginTop: 12, width: 320, textAlign: 'center'}}>Atendimento digital</div>
        </div>
        <div style={{position: 'absolute', left: 580, top: 22, width: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-46px)'}}>
          <PersonIcon size={96} glow={arrived} />
          <div style={{fontFamily: FONT_UI, fontSize: 26, color: arrived > 0.5 ? '#ffd8b3' : C.mist, marginTop: 12}}>Especialista da equipe</div>
        </div>
      </div>
    </div>
  );
};

/** Plano da pessoa real recebendo a solicitação organizada (over-the-shoulder). */
export const SpecialistShot: React.FC<{t: number}> = ({t}) => {
  const a = TL.messages.hArrive;
  const push = mix(1.06, 1.16, easeIO(t, a - 0.2, a + 2.0));
  const card = ease(t, a + 0.1, a + 0.65);
  const lamp = 0.85 + 0.03 * Math.sin(t * 2);
  const rows = [
    ['Cliente', 'Carla M.'],
    ['Segmento', 'Clínica de estética'],
    ['Pedido', 'Orçamento de site'],
    ['Solicitou', 'Falar com especialista'],
  ];
  return (
    <AbsoluteFill style={{background: '#0a0708', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '600px 900px'}}>
        {/* parede quente + bokeh */}
        <AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 60% at 20% 20%, #3b2418 0%, #140c0b 50%, #070506 100%)'}} />
        <Bokeh t={t} count={14} seed={9} warm opacity={0.8} />
        {/* cone da luminária */}
        <div style={{position: 'absolute', left: -200, top: -200, width: 900, height: 1300, background: `radial-gradient(ellipse 50% 50% at 40% 30%, rgba(255,190,120,${0.38 * lamp}), rgba(255,160,90,0) 70%)`}} />
        {/* mesa */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 1300, bottom: 0, background: 'linear-gradient(180deg,#2a1a12,#0c0806)'}} />
        {/* monitor */}
        <div
          style={{
            position: 'absolute',
            left: 170,
            top: 470,
            width: 860,
            height: 600,
            borderRadius: 22,
            background: '#050508',
            padding: 16,
            boxShadow: '0 60px 100px rgba(0,0,0,0.7), 0 0 120px rgba(80,140,255,0.25)',
            transform: 'perspective(1800px) rotateY(-14deg)',
          }}
        >
          <div style={{width: '100%', height: '100%', borderRadius: 10, background: 'linear-gradient(160deg,#101a4d,#070a24)', overflow: 'hidden', position: 'relative'}}>
            <div style={{padding: '22px 30px', fontFamily: FONT_UI, fontSize: 24, color: C.muted, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between'}}>
              <span>Caixa da equipe</span>
              <span>Fila de atendimento</span>
            </div>
            <div
              style={{
                margin: 26,
                padding: '26px 30px',
                borderRadius: 22,
                background: 'linear-gradient(140deg, rgba(40,123,255,0.28), rgba(124,72,255,0.22))',
                border: '1.5px solid rgba(111,216,255,0.5)',
                opacity: card,
                transform: `translateY(${(1 - card) * 60}px)`,
                boxShadow: `0 0 ${40 * card}px rgba(50,230,255,0.35)`,
              }}
            >
              <div style={{fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 32, color: '#fff'}}>Nova conversa encaminhada</div>
              {rows.map(([k, v], i) => (
                <div key={k} style={{display: 'flex', fontFamily: FONT_UI, fontSize: 28, marginTop: 14, opacity: ease(t, a + 0.35 + i * 0.12, a + 0.7 + i * 0.12)}}>
                  <span style={{width: 190, color: C.muted}}>{k}</span>
                  <span style={{color: '#fff', fontWeight: 600}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* luz da tela no rosto/ombro + silhueta (pessoa real da equipe, de costas) */}
        <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
          <defs>
            <filter id="sRim"><feGaussianBlur stdDeviation="4" /></filter>
            <linearGradient id="sBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#120c0c" />
              <stop offset="1" stopColor="#050304" />
            </linearGradient>
          </defs>
          <path d="M-80 1920 Q-60 1500 120 1420 Q230 1380 300 1370 L300 1300 Q350 1320 420 1300 L430 1370 Q560 1390 640 1470 Q720 1560 720 1920 Z" fill="url(#sBody)" />
          <ellipse cx={360} cy={1150} rx={150} ry={185} fill="#0d0909" />
          <path d="M215 1120 Q220 960 360 955 Q500 960 506 1110 Q470 1010 360 1005 Q260 1010 215 1120Z" fill="#070505" />
          {/* rim light: quente da luminária + azul da tela */}
          <path d="M240 1040 Q280 960 360 955" stroke="#ffc48f" strokeWidth={6} fill="none" opacity={0.7} filter="url(#sRim)" />
          <path d="M506 1110 Q512 1220 470 1300" stroke="#7fb2ff" strokeWidth={7} fill="none" opacity={0.6 + 0.3 * card} filter="url(#sRim)" />
          <path d="M640 1470 Q720 1560 720 1920" stroke="#7fb2ff" strokeWidth={6} fill="none" opacity={0.35} filter="url(#sRim)" />
        </svg>
      </AbsoluteFill>
      <Haze opacity={0.08} color="255,170,110" y={30} />
      <div style={{position: 'absolute', top: 230, width: '100%', textAlign: 'center', fontFamily: FONT_BRAND, fontSize: 26, letterSpacing: 5, color: '#ffd8b3', opacity: ease(t, a + 0.2, a + 0.7) * (1 - lin(t, 20.8, 21.1))}}>
        EQUIPE HUMANA · RECEBE TUDO ORGANIZADO
      </div>
    </AbsoluteFill>
  );
};
