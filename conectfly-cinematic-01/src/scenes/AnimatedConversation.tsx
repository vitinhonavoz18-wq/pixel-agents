import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AiAvatar, Bubble, DigitalBackdrop, Glass, Mark, Typing} from '../components/Chat';
import {C, FONT_BRAND, FONT_UI} from '../styles/theme';
import {TL, ease, easeIO, lin, mix} from '../timeline/time';
import {HandoffFlow} from './HumanHandoff';

/**
 * CENA 3 — 0:09–0:16 · A INTELIGÊNCIA EM AÇÃO  (+ início da CENA 4, 0:16–0:19, mesma conversa)
 * Conversa revelada passo a passo; painel lateral organiza a solicitação.
 */
const M = TL.messages;

type Item = {kind: 'msg' | 'typing'; at: number; to?: number; side?: 'left' | 'right'; node?: (t: number) => React.ReactNode; h: number};
const ITEMS: Item[] = [
  {kind: 'msg', at: M.c1, side: 'left', h: 150, node: (t) => <>Oi, quero um <Mark t={t} at={M.c1 + 0.5}>orçamento de um site</Mark>.</>},
  {kind: 'typing', at: M.c1 + 0.55, to: M.a1, h: 0},
  {kind: 'msg', at: M.a1, side: 'right', h: 150, node: () => <>Claro! Qual é o segmento da sua empresa?</>},
  {kind: 'msg', at: M.c2, side: 'left', h: 105, node: (t) => <Mark t={t} at={M.c2 + 0.35}>Clínica de estética.</Mark>},
  {kind: 'typing', at: M.c2 + 0.45, to: M.a2, h: 0},
  {kind: 'msg', at: M.a2, side: 'right', h: 150, node: () => <>Perfeito. Vou organizar sua solicitação para nossa equipe.</>},
  {kind: 'msg', at: M.h1, side: 'left', h: 150, node: (t) => <><Mark t={t} at={M.h1 + 0.45}>Posso falar com um especialista?</Mark></>},
  {kind: 'typing', at: M.h1 + 0.45, to: M.h2, h: 0},
  {kind: 'msg', at: M.h2, side: 'right', h: 150, node: () => <>Claro! Vou encaminhar sua conversa para nossa equipe.</>},
];

const PANEL = [
  {at: TL.messages.panel[0], k: 'Segmento identificado', v: 'Clínica de estética'},
  {at: TL.messages.panel[1], k: 'Solicitação registrada', v: 'Orçamento de site'},
  {at: TL.messages.panel[2], k: 'Atendimento organizado', v: 'Pronto para a equipe'},
];

const Check: React.FC<{p: number}> = ({p}) => (
  <svg width={46} height={46} viewBox="0 0 46 46" style={{flexShrink: 0}}>
    <defs>
      <linearGradient id="ck" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.g0} />
        <stop offset="1" stopColor={C.g2} />
      </linearGradient>
    </defs>
    <circle cx={23} cy={23} r={20} fill="none" stroke="url(#ck)" strokeWidth={3} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
    <path d="M14 23.5 L20.5 30 L32 17" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - lin(p, 0.4, 1)} />
  </svg>
);

export const AnimatedConversation: React.FC<{t: number}> = ({t}) => {
  // entrada: vindo da linha "Carla M." da cena 2
  const inP = ease(t, 8.95, 9.6);
  const outP = easeIO(t, 19.0, 19.5);
  const rotY = mix(4, -3, easeIO(t, 9, 19.3));
  const cardTf = `translateY(${(1 - inP) * 80}px) scale(${mix(1.12, 1, inP) * mix(1, 0.86, outP)}) rotateY(${rotY}deg) rotateX(4deg)`;
  const panelMode = easeIO(t, 15.75, 16.35); // 0 = checklist, 1 = handoff
  const panelIn = ease(t, 10.9, 11.5);
  const headerName = t < 9.2 ? '' : 'Carla M.';

  return (
    <AbsoluteFill>
      <DigitalBackdrop t={t} tint={panelMode} />
      <AbsoluteFill style={{perspective: 2200, opacity: inP * (1 - lin(t, 19.25, 19.5)), filter: `blur(${outP * 6}px)`}}>
        {/* cartão do chat */}
        <Glass style={{left: 90, top: 215, width: 900, height: 800, transform: cardTf}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 24, padding: '30px 44px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(5,7,26,0.35)'}}>
            <AiAvatar size={80} />
            <div style={{flex: 1}}>
              <div style={{fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 36, color: '#fff'}}>Atendimento digital</div>
              <div style={{fontFamily: FONT_UI, fontSize: 25, color: C.cyanSoft, marginTop: 4}}>● online agora · conversa com {headerName}</div>
            </div>
            <div style={{fontFamily: FONT_UI, fontSize: 26, color: C.muted}}>02:48</div>
          </div>
          {/* mensagens, ancoradas embaixo (as antigas sobem com suavidade) */}
          <div style={{position: 'absolute', left: 0, right: 0, top: 142, bottom: 0, padding: '0 40px 34px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden'}}>
            {ITEMS.map((it, i) => {
              if (it.kind === 'typing') {
                const show = ease(t, it.at, it.at + 0.2) * (1 - ease(t, (it.to ?? 0) - 0.05, it.to ?? 0));
                return (
                  <div key={i} style={{maxHeight: show * 84, marginTop: show * 18, overflow: 'visible'}}>
                    <div style={{height: 84, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end'}}>
                      <Typing t={t} from={it.at} to={it.to ?? 0} />
                    </div>
                  </div>
                );
              }
              const grow = ease(t, it.at, it.at + 0.4);
              const dim = it.at < M.h1 && t > M.h1 ? 0.55 : 1; // foco na nova parte
              return (
                <div key={i} style={{maxHeight: grow * it.h, marginTop: grow * 18, opacity: dim, flexShrink: 0}}>
                  <Bubble t={t} at={it.at} side={it.side ?? 'left'}>
                    {it.node?.(t)}
                  </Bubble>
                </div>
              );
            })}
          </div>
        </Glass>

        {/* painel: solicitação organizada -> encaminhamento */}
        <Glass
          glow={panelMode * ease(t, 18.4, 18.8)}
          style={{
            left: 90,
            top: 1040,
            width: 900,
            height: 315,
            opacity: panelIn,
            transform: `translateY(${(1 - panelIn) * 50 + mix(0, -10, easeIO(t, 11, 19))}px) rotateY(${rotY * 1.4}deg) rotateX(4deg) scale(${mix(1, 0.86, outP)})`,
          }}
        >
          <div style={{position: 'absolute', inset: 0, padding: '30px 44px', opacity: 1 - panelMode}}>
            <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: FONT_BRAND, fontSize: 25, letterSpacing: 3, color: C.cyanSoft}}>
              <span>SOLICITAÇÃO ORGANIZADA</span>
              <span style={{color: C.muted}}>#A-0247</span>
            </div>
            {PANEL.map((r, i) => {
              const p = ease(t, r.at, r.at + 0.6);
              return (
                <div key={i} style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 20, opacity: Math.min(1, p * 2), transform: `translateX(${(1 - p) * 30}px)`}}>
                  <Check p={p} />
                  <span style={{fontFamily: FONT_UI, fontSize: 28, color: C.muted, width: 330}}>{r.k}</span>
                  <span style={{fontFamily: FONT_UI, fontSize: 31, fontWeight: 600, color: '#fff'}}>{r.v}</span>
                </div>
              );
            })}
          </div>
          <div style={{position: 'absolute', inset: 0, opacity: panelMode}}>
            <HandoffFlow t={t} />
          </div>
        </Glass>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
