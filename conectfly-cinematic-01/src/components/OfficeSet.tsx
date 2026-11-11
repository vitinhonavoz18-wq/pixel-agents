import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FONT_BRAND, FONT_UI} from '../styles/theme';
import {hash} from '../timeline/time';

/**
 * Cenário do escritório (madrugada / amanhecer), em camadas com parallax.
 * Câmera: `zoom` (1 = plano geral) e `focus` (ponto de dolly-in).
 */
type Props = {
  t: number;
  dawn: number; // 0 = 02:47 noite, 1 = amanhecer
  zoom: number;
  focus?: [number, number];
  phoneLit?: number; // 0..1 tela acesa
  phoneShake?: number; // px
  person?: number; // 0..1 empresário sentado (amanhecer)
  steam?: number; // 0..1 vapor do café
  clock: string;
  notifText?: string;
};

const SKY_TOP = 1100; // linha do peitoril da janela

// Prédios determinísticos
const buildings = (seed: number, n: number, minH: number, maxH: number) => {
  const out: {x: number; w: number; h: number}[] = [];
  let x = -40;
  for (let i = 0; x < 1120 && i < n; i++) {
    const w = 60 + hash(seed + i) * 120;
    const h = minH + hash(seed + i * 3.1) * (maxH - minH);
    out.push({x, w, h});
    x += w + 4 + hash(seed + i * 7.7) * 18;
  }
  return out;
};
const FAR = buildings(11, 30, 140, 420);
const NEAR = buildings(53, 20, 260, 640);

const Skyline: React.FC<{t: number; dawn: number}> = ({t, dawn}) => {
  const night = 1 - dawn;
  return (
    <svg width={1080} height={SKY_TOP} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <linearGradient id="skyN" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#010209" />
          <stop offset="0.55" stopColor="#060b2a" />
          <stop offset="1" stopColor="#16205c" />
        </linearGradient>
        <linearGradient id="skyD" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2466" />
          <stop offset="0.45" stopColor="#5a4fb0" />
          <stop offset="0.75" stopColor="#e98a7a" />
          <stop offset="1" stopColor="#ffd39a" />
        </linearGradient>
        <radialGradient id="moon" cx="0.78" cy="0.16" r="0.25">
          <stop offset="0" stopColor="rgba(160,190,255,0.35)" />
          <stop offset="1" stopColor="rgba(160,190,255,0)" />
        </radialGradient>
        <radialGradient id="sun" cx="0.62" cy="0.95" r="0.6">
          <stop offset="0" stopColor="rgba(255,226,170,0.95)" />
          <stop offset="0.35" stopColor="rgba(255,170,110,0.45)" />
          <stop offset="1" stopColor="rgba(255,150,100,0)" />
        </radialGradient>
        <filter id="farBlur"><feGaussianBlur stdDeviation="3.2" /></filter>
        <filter id="nearBlur"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <rect width={1080} height={SKY_TOP} fill="url(#skyN)" />
      <rect width={1080} height={SKY_TOP} fill="url(#skyD)" opacity={dawn} />
      <rect width={1080} height={SKY_TOP} fill="url(#moon)" opacity={night} />
      <rect width={1080} height={SKY_TOP} fill="url(#sun)" opacity={dawn} />
      <g filter="url(#farBlur)">
        {FAR.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={SKY_TOP - 180 - b.h} width={b.w} height={b.h + 180} fill={dawn > 0.5 ? '#3a3470' : '#0b1238'} opacity={0.9} />
            {Array.from({length: 18}).map((_, k) => {
              const on = hash(i * 31 + k) > 0.62;
              if (!on) return null;
              const wx = b.x + 8 + (k % 3) * (b.w / 3.2);
              const wy = SKY_TOP - 160 - b.h + 20 + Math.floor(k / 3) * 34;
              return <rect key={k} x={wx} y={wy} width={6} height={9} fill={hash(k + i) > 0.5 ? '#7fb2ff' : '#ffcf8a'} opacity={0.5 * night} />;
            })}
          </g>
        ))}
      </g>
      <g filter="url(#nearBlur)">
        {NEAR.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={SKY_TOP - 60 - b.h} width={b.w} height={b.h + 60} fill={dawn > 0.5 ? '#231d48' : '#050820'} />
            {Array.from({length: 40}).map((_, k) => {
              const col = k % 4;
              const row = Math.floor(k / 4);
              if (hash(i * 17 + k * 1.3) < 0.7) return null;
              const flick = hash(i + k + Math.floor(t * 0.7)) > 0.97 ? 0.3 : 1;
              return (
                <rect
                  key={k}
                  x={b.x + 10 + col * ((b.w - 20) / 4)}
                  y={SKY_TOP - 40 - b.h + 26 + row * 48}
                  width={(b.w - 40) / 4}
                  height={18}
                  fill={hash(i * 3 + k) > 0.55 ? '#9cc4ff' : '#ffd08c'}
                  opacity={(0.55 * night + 0.12 * dawn) * flick}
                />
              );
            })}
          </g>
        ))}
        {/* luz de aviação piscando */}
        <circle cx={812} cy={SKY_TOP - 60 - NEAR[Math.min(NEAR.length - 1, 13)].h - 8} r={5} fill="#ff3b4a" opacity={night * (Math.sin(t * 5) > 0.4 ? 0.9 : 0.1)} />
      </g>
      {/* reflexos no vidro */}
      <polygon points="80,0 260,0 -60,1100 -240,1100" fill="rgba(180,210,255,0.035)" />
      <polygon points="520,0 590,0 300,1100 230,1100" fill="rgba(180,210,255,0.025)" />
    </svg>
  );
};

const WindowFrame: React.FC<{dawn: number}> = ({dawn}) => {
  const rim = dawn > 0.5 ? 'rgba(255,190,140,0.35)' : 'rgba(111,216,255,0.22)';
  const bars = [0, 352, 712, 1060];
  return (
    <svg width={1080} height={SKY_TOP + 40} style={{position: 'absolute', left: 0, top: 0}}>
      {bars.map((x) => (
        <g key={x}>
          <rect x={x - 12} y={0} width={30} height={SKY_TOP + 40} fill="#020309" />
          <rect x={x + 16} y={0} width={2} height={SKY_TOP} fill={rim} />
        </g>
      ))}
      <rect x={0} y={118} width={1080} height={22} fill="#020309" />
      <rect x={0} y={138} width={1080} height={2} fill={rim} />
      <rect x={0} y={SKY_TOP - 6} width={1080} height={46} fill="#03040b" />
      <rect x={0} y={SKY_TOP - 6} width={1080} height={2} fill={rim} />
    </svg>
  );
};

const Chair: React.FC<{dawn: number}> = ({dawn}) => {
  const rim = dawn > 0.5 ? '#ffc79a' : C.cyanSoft;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <linearGradient id="leather" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b0c14" />
          <stop offset="0.5" stopColor="#05060b" />
          <stop offset="1" stopColor="#0b0c14" />
        </linearGradient>
        <filter id="rimBlur"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      {/* braços */}
      <rect x={318} y={1045} width={70} height={150} rx={26} fill="#05060b" />
      <rect x={692} y={1045} width={70} height={150} rx={26} fill="#05060b" />
      {/* encosto */}
      <path d="M392 1200 L384 760 Q384 640 540 628 Q696 640 696 760 L688 1200 Z" fill="url(#leather)" />
      <path d="M392 1200 L384 760 Q384 640 540 628 Q696 640 696 760 L688 1200" fill="none" stroke={rim} strokeWidth={3} opacity={0.22} filter="url(#rimBlur)" />
      {/* costuras / painéis */}
      <path d="M450 700 L446 1190 M630 700 L634 1190" stroke="#10131f" strokeWidth={6} />
      <path d="M420 860 Q540 880 660 860" stroke="#10131f" strokeWidth={5} fill="none" />
      <path d="M408 700 Q540 650 672 700" stroke={rim} strokeWidth={2} fill="none" opacity={0.22} />
    </svg>
  );
};

const Person: React.FC<{p: number; t: number}> = ({p, t}) => {
  if (p <= 0) return null;
  const breathe = Math.sin(t * 1.6) * 3;
  return (
    <svg
      width={1080}
      height={1920}
      style={{position: 'absolute', left: 0, top: 0, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 70 + breathe - 175}px)`}}
    >
      <defs>
        <filter id="pRim"><feGaussianBlur stdDeviation="3" /></filter>
        <linearGradient id="pBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d0a10" />
          <stop offset="1" stopColor="#060509" />
        </linearGradient>
      </defs>
      {/* ombros e tronco (silhueta contra a janela) */}
      <path
        d="M330 1400 Q336 1000 410 950 Q470 915 505 905 L505 860 Q540 872 575 860 L575 905 Q610 915 670 950 Q744 1000 750 1400 Z"
        fill="url(#pBody)"
      />
      {/* cabeça */}
      <ellipse cx={540} cy={790} rx={74} ry={92} fill="#0b090e" />
      <path d="M470 770 Q472 690 540 688 Q612 690 614 770" fill="#09070b" />
      {/* rim light quente do amanhecer */}
      <path d="M612 760 Q614 860 575 880" stroke="#ffc48f" strokeWidth={5} fill="none" opacity={0.8} filter="url(#pRim)" />
      <path d="M670 950 Q744 1000 750 1300" stroke="#ffb877" strokeWidth={5} fill="none" opacity={0.55} filter="url(#pRim)" />
      <path d="M470 770 Q472 690 540 688" stroke="#ffcf9e" strokeWidth={4} fill="none" opacity={0.45} filter="url(#pRim)" />
      {/* colarinho */}
      <path d="M505 905 L540 960 L575 905" stroke="#1b1720" strokeWidth={5} fill="none" />
    </svg>
  );
};

const Desk: React.FC<{dawn: number; lit: number}> = ({dawn, lit}) => {
  const far = 1188;
  const near = 1585;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dawn > 0.5 ? '#3a2416' : '#140d0a'} />
          <stop offset="1" stopColor={dawn > 0.5 ? '#26170e' : '#0c0806'} />
        </linearGradient>
        <linearGradient id="deskRefl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dawn > 0.5 ? 'rgba(255,200,150,0.42)' : 'rgba(90,140,255,0.22)'} />
          <stop offset="0.6" stopColor="rgba(90,140,255,0)" />
        </linearGradient>
        <linearGradient id="front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d0907" />
          <stop offset="1" stopColor="#030203" />
        </linearGradient>
        <filter id="reflBlur"><feGaussianBlur stdDeviation="10" /></filter>
      </defs>
      <polygon points={`30,${far} 1050,${far} 1300,${near} -220,${near}`} fill="url(#wood)" />
      {/* veios da madeira em perspectiva */}
      {Array.from({length: 46}).map((_, i) => {
        const xf = 30 + i * 22.6 + hash(i) * 8;
        const xn = 540 + (xf - 540) * 1.5;
        return <line key={i} x1={xf} y1={far} x2={xn} y2={near} stroke={hash(i + 3) > 0.5 ? '#000' : '#5a3a24'} strokeWidth={1 + hash(i + 9) * 2} opacity={0.12} />;
      })}
      {/* reflexo da janela no tampo (mullions espelhados, desfocados) */}
      <g filter="url(#reflBlur)">
        <polygon points={`30,${far} 1050,${far} 1300,${near} -220,${near}`} fill="url(#deskRefl)" />
        {[352, 712].map((x) => (
          <polygon key={x} points={`${x - 10},${far} ${x + 14},${far} ${540 + (x + 14 - 540) * 1.5},${far + 150} ${540 + (x - 10 - 540) * 1.5},${far + 150}`} fill="rgba(0,0,0,0.5)" />
        ))}
      </g>
      {/* poça de luz do celular */}
      <ellipse cx={540} cy={1440} rx={420} ry={150} fill="rgba(80,170,255,1)" opacity={0.28 * lit} filter="url(#reflBlur)" style={{mixBlendMode: 'screen'}} />
      <ellipse cx={540} cy={1440} rx={200} ry={70} fill="rgba(160,215,255,1)" opacity={0.3 * lit} filter="url(#reflBlur)" style={{mixBlendMode: 'screen'}} />
      {/* borda frontal */}
      <rect x={-20} y={near} width={1120} height={14} fill={dawn > 0.5 ? '#5a3a25' : '#2a1c14'} />
      <rect x={-20} y={near} width={1120} height={2} fill={dawn > 0.5 ? 'rgba(255,210,170,0.6)' : 'rgba(140,190,255,0.35)'} />
      <rect x={-20} y={near + 14} width={1120} height={400} fill="url(#front)" />
    </svg>
  );
};

const Monitor: React.FC<{dawn: number}> = ({dawn}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
    <defs>
      <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#0a0d1d" />
        <stop offset="0.5" stopColor="#04050b" />
        <stop offset="1" stopColor="#080a16" />
      </linearGradient>
    </defs>
    <rect x={60} y={872} width={300} height={196} rx={8} fill="#020205" />
    <rect x={68} y={880} width={284} height={180} rx={4} fill="url(#scr)" />
    <polygon points="68,880 180,880 100,1060 68,1060" fill={dawn > 0.5 ? 'rgba(255,200,160,0.10)' : 'rgba(120,170,255,0.07)'} />
    <rect x={196} y={1068} width={28} height={110} fill="#05060a" />
    <ellipse cx={210} cy={1190} rx={80} ry={12} fill="#07080e" />
  </svg>
);

const Cup: React.FC<{dawn: number; lit: number; steam: number; t: number}> = ({dawn, lit, steam, t}) => {
  const cx = 835;
  const top = 1330;
  const body = dawn > 0.5 ? '#efe4d8' : '#4a536e';
  const shade = dawn > 0.5 ? '#b9a594' : '#1b2033';
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        <linearGradient id="cupG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade} />
          <stop offset={0.35} stopColor={body} />
          <stop offset="1" stopColor={shade} />
        </linearGradient>
        <filter id="cupSh"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id="steamB"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <ellipse cx={cx + 10} cy={top + 150} rx={120} ry={26} fill="#000" opacity={0.6} filter="url(#cupSh)" />
      <ellipse cx={cx} cy={top + 140} rx={112} ry={26} fill={shade} />
      <ellipse cx={cx} cy={top + 136} rx={104} ry={22} fill={body} opacity={0.6} />
      <path d={`M${cx + 64} ${top + 30} q58 6 54 46 q-4 38 -58 40`} stroke={shade} strokeWidth={14} fill="none" />
      <path d={`M${cx - 72} ${top} L${cx - 62} ${top + 118} Q${cx} ${top + 140} ${cx + 62} ${top + 118} L${cx + 72} ${top} Z`} fill="url(#cupG)" />
      <ellipse cx={cx} cy={top} rx={72} ry={18} fill={body} />
      <ellipse cx={cx} cy={top + 3} rx={63} ry={14} fill={dawn > 0.5 ? '#3b2215' : '#140c08'} />
      {/* brilho do celular na lateral da xícara */}
      <path d={`M${cx - 70} ${top + 8} L${cx - 61} ${top + 112}`} stroke={C.cyanSoft} strokeWidth={5} opacity={0.6 * lit} filter="url(#steamB)" />
      {steam > 0 &&
        [0, 1, 2].map((i) => {
          const sx = cx - 24 + i * 24;
          const ph = t * 1.3 + i * 2.1;
          const d = `M${sx} ${top - 10} C ${sx - 20 + Math.sin(ph) * 14} ${top - 70}, ${sx + 24 + Math.cos(ph) * 14} ${top - 120}, ${sx + Math.sin(ph * 0.8) * 18} ${top - 200}`;
          return <path key={i} d={d} stroke="rgba(255,240,225,0.5)" strokeWidth={10} fill="none" filter="url(#steamB)" opacity={steam * (0.5 + 0.3 * Math.sin(ph))} strokeLinecap="round" />;
        })}
    </svg>
  );
};

const DeskClock: React.FC<{text: string; dawn: number}> = ({text, dawn}) => (
  <div
    style={{
      position: 'absolute',
      left: 120,
      top: 1232,
      width: 270,
      height: 104,
      borderRadius: 14,
      background: 'linear-gradient(180deg,#0b0d18,#040509)',
      border: '2px solid #151827',
      boxShadow: '0 30px 40px rgba(0,0,0,0.6)',
      transform: 'perspective(900px) rotateX(8deg) rotateY(14deg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <span
      style={{
        fontFamily: FONT_BRAND,
        fontWeight: 500,
        fontSize: 64,
        letterSpacing: 4,
        color: dawn > 0.5 ? '#ffe2c4' : C.cyan,
        textShadow: dawn > 0.5 ? '0 0 14px rgba(255,190,130,0.7)' : `0 0 16px rgba(50,230,255,0.85), 0 0 40px rgba(40,123,255,0.5)`,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {text}
    </span>
  </div>
);

const Phone: React.FC<{lit: number; shake: number; text?: string; clock: string}> = ({lit, shake, text, clock}) => (
  <div
    style={{
      position: 'absolute',
      left: 540 - 105 + shake,
      top: 1230,
      width: 210,
      height: 420,
      transform: 'perspective(1100px) rotateX(64deg) rotateZ(-8deg)',
      transformOrigin: '50% 100%',
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 34,
        background: 'linear-gradient(160deg,#1b1e2b,#07080d)',
        boxShadow: `0 40px 60px rgba(0,0,0,0.75), 0 0 ${80 * lit}px rgba(90,170,255,${0.65 * lit})`,
        border: '2px solid #262a3a',
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 9,
        borderRadius: 27,
        overflow: 'hidden',
        background: `linear-gradient(170deg, rgba(30,60,160,${lit}) 0%, rgba(12,18,70,${lit}) 60%, rgba(60,30,140,${lit}) 100%), #030409`,
      }}
    >
      <div style={{opacity: lit, color: '#fff', fontFamily: FONT_UI, textAlign: 'center'}}>
        <div style={{fontSize: 60, fontWeight: 300, marginTop: 40, letterSpacing: -1}}>{clock}</div>
        {text && (
          <div
            style={{
              margin: '36px 12px 0',
              padding: '14px 14px',
              borderRadius: 18,
              background: 'rgba(255,255,255,0.16)',
              fontSize: 20,
              textAlign: 'left',
              lineHeight: 1.25,
            }}
          >
            <div style={{fontWeight: 700, fontSize: 17, opacity: 0.8}}>NOVA MENSAGEM · agora</div>
            {text}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const OfficeSet: React.FC<Props> = ({t, dawn, zoom, focus = [540, 1420], phoneLit = 0, phoneShake = 0, person = 0, steam = 0, clock, notifText}) => {
  const layer = (k: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    transformOrigin: `${focus[0]}px ${focus[1]}px`,
    transform: `scale(${1 + (zoom - 1) * k})`,
  });
  return (
    <AbsoluteFill style={{background: '#020309', overflow: 'hidden'}}>
      <div style={layer(0.45)}>
        <Skyline t={t} dawn={dawn} />
        <WindowFrame dawn={dawn} />
        {/* parede/piso abaixo da janela */}
        <div style={{position: 'absolute', left: 0, top: SKY_TOP + 40, width: 1080, height: 900, background: 'linear-gradient(180deg,#05060f,#020308)'}} />
      </div>
      {/* raios de sol (amanhecer) */}
      {dawn > 0 && (
        <AbsoluteFill style={{opacity: dawn * 0.75, mixBlendMode: 'screen', ...layer(0.6)}}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 360 + i * 210,
                top: 300,
                width: 120 + i * 40,
                height: 1500,
                transform: `rotate(${28 - i * 3}deg)`,
                transformOrigin: 'top center',
                background: 'linear-gradient(180deg, rgba(255,205,150,0.0), rgba(255,200,140,0.22) 40%, rgba(255,190,130,0))',
                filter: 'blur(18px)',
              }}
            />
          ))}
        </AbsoluteFill>
      )}
      <div style={layer(0.75)}>
        <Monitor dawn={dawn} />
        <Chair dawn={dawn} />
        <Person p={person} t={t} />
      </div>
      <div style={layer(1)}>
        <Desk dawn={dawn} lit={phoneLit} />
        <DeskClock text={clock} dawn={dawn} />
        <Cup dawn={dawn} lit={phoneLit} steam={steam} t={t} />
        <Phone lit={phoneLit} shake={phoneShake} text={notifText} clock={clock} />
      </div>
      {/* luz ambiente geral (azul à noite, quente de manhã) */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background:
            dawn > 0
              ? `linear-gradient(180deg, rgba(255,170,110,${0.08 * dawn}) 0%, rgba(0,0,0,0) 60%)`
              : `radial-gradient(ellipse 70% 30% at 50% 74%, rgba(60,140,255,${0.12 * phoneLit}) 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
