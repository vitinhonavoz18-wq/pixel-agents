import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimatedCaptions } from '../components/AnimatedCaptions';
import { AnimatedTitle } from '../components/AnimatedTitle';
import { AnswerCard, CARD_H } from '../components/AnswerCard';
import { Confetti, CorrectBanner } from '../components/CorrectAnswerReveal';
import { CountdownTimer } from '../components/CountdownTimer';
import { BottleIcon, ClockIcon, EyesIcon, HatIcon, HeartIcon, ShadeIcon, SunIcon } from '../components/Icons';
import { BrandBadge, BrandSignature, LOGO } from '../components/PharmacyBranding';
import { SummerBackground } from '../components/SummerBackground';
import { COLORS, FONTS, ensureFonts } from '../config/theme';
import { COUNTDOWN_SECONDS, DURATION_IN_FRAMES, FRAMES_PER_COUNT, SCENES, SFX, VOICE } from '../config/timing';
import { CAPTIONS, QUIZ } from '../data/quiz';
import { Img } from 'remotion';

ensureFonts();

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const CAPTION_Y = 1440; // faixa das legendas: abaixo das opções e acima da interface do Reels

// ---------------- CENA 01 — GANCHO ----------------
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sunIn = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const sunScale = interpolate(sunIn, [0, 1], [0.55, 1]) * (1 + 0.05 * Math.sin(frame / 4));
  const flash = interpolate(frame, [0, 7], [0.55, 0], clamp);
  const shake = interpolate(frame, [0, 8], [16, 0], clamp) * Math.sin(frame * 3.1);
  const exit = interpolate(frame, [44, 51], [1, 0], clamp);
  const exitScale = interpolate(frame, [44, 51], [1, 1.15], clamp);

  return (
    <AbsoluteFill style={{ opacity: exit, transform: `scale(${exitScale}) translateX(${shake}px)` }}>
      <div style={{ position: 'absolute', left: 540 - 220, top: 215, width: 440, height: 440 }}>
        <div
          style={{
            position: 'absolute',
            inset: -80,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,210,31,0.45) 0%, rgba(255,138,31,0) 65%)',
            transform: `scale(${sunScale * 1.1})`,
          }}
        />
        <SunIcon size={440} rotate={frame * 1.5} style={{ transform: `scale(${sunScale})` }} />
      </div>
      <div style={{ position: 'absolute', top: 700, left: 0, right: 0 }}>
        <AnimatedTitle lines={QUIZ.hookLines} sizes={[150, 158, 140, 176]} highlight={[3]} stagger={4} />
      </div>
      <AbsoluteFill style={{ backgroundColor: COLORS.yellow, opacity: flash }} />
    </AbsoluteFill>
  );
};

// ---------------- CENAS 02–04 — QUIZ (pergunta, contagem e revelação) ----------------
const Q = {
  start: SCENES.question.from,
  countdown: SCENES.countdown.from - SCENES.question.from, // 66
  reveal: SCENES.reveal.from - SCENES.question.from, // 216
  end: SCENES.reveal.to - SCENES.question.from, // 324
};
const CARDS_TOP = 900;
const CARD_GAP = 26;

const QuizBoard: React.FC = () => {
  const frame = useCurrentFrame(); // 0 = início da cena 2
  const { fps } = useVideoConfig();

  const chipIn = spring({ frame, fps, config: { damping: 14 } });
  const qIn = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 160 } });

  // slot central: "?" (cena 2) → cronômetro (cena 3) → selo verde (cena 4)
  const qmarkOut = interpolate(frame, [Q.countdown - 6, Q.countdown], [1, 0], clamp);
  const qmarkPulse = 1 + 0.06 * Math.sin(frame / 3);
  const qmarkIn = spring({ frame: frame - 8, fps, config: { damping: 10 } });
  const timerIn = spring({ frame: frame - Q.countdown, fps, config: { damping: 12, stiffness: 180 } });
  const timerOut = interpolate(frame, [Q.reveal, Q.reveal + 6], [1, 0], clamp);

  const inCountdown = frame >= Q.countdown && frame < Q.reveal;
  const cdLocal = frame - Q.countdown;
  const urgentLevel = inCountdown && cdLocal >= (COUNTDOWN_SECONDS - 2) * FRAMES_PER_COUNT ? 0.6 + 0.4 * Math.abs(Math.sin(cdLocal / 4.8)) : 0;

  const bannerIn = spring({ frame: frame - Q.countdown - 4, fps, config: { damping: 11, stiffness: 200 } });
  const bannerBeat = 1 + 0.05 * Math.max(0, 1 - ((cdLocal % FRAMES_PER_COUNT) / 8)) * (urgentLevel > 0 ? 2 : 1);

  const flash = frame < Q.reveal ? 0 : interpolate(frame, [Q.reveal, Q.reveal + 6], [0.6, 0], clamp);
  const exit = interpolate(frame, [Q.end - 5, Q.end], [1, 0], clamp);

  const cardY = (i: number) => CARDS_TOP + i * (CARD_H + CARD_GAP);
  const correctIndex = QUIZ.options.findIndex((o) => o.letter === QUIZ.correct);

  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <SummerBackground heat={inCountdown ? interpolate(cdLocal, [0, 150], [0.4, 1]) : 0.4} urgency={urgentLevel} />

      <div style={{ position: 'absolute', top: 215, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <BrandBadge opacity={interpolate(frame, [4, 14], [0, 0.95], clamp)} />
      </div>

      {/* pergunta */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 60,
          right: 60,
          textAlign: 'center',
          transform: `translateY(${interpolate(qIn, [0, 1], [-60, 0])}px) scale(${interpolate(qIn, [0, 1], [0.85, 1])})`,
          opacity: interpolate(frame, [0, 4], [0.3, 1], clamp),
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 26px',
            borderRadius: 999,
            background: COLORS.yellow,
            color: COLORS.navy950,
            fontFamily: FONTS.display,
            fontSize: 38,
            letterSpacing: 2,
            marginBottom: 22,
            transform: `scale(${chipIn})`,
          }}
        >
          <SunIcon size={40} color={COLORS.navy950} rotate={frame * 2} />
          {QUIZ.chip}
        </div>
        {QUIZ.questionLines.map((l, i) => (
          <div
            key={l}
            style={{
              fontFamily: FONTS.display,
              fontSize: i === 0 ? 84 : 104,
              lineHeight: 1.04,
              color: i === 1 ? COLORS.yellow : COLORS.white,
              textShadow: `0 6px 0 ${COLORS.navy950}`,
              whiteSpace: 'nowrap',
            }}
          >
            {l}
          </div>
        ))}
      </div>

      {/* slot central */}
      <div style={{ position: 'absolute', top: 600, left: 0, right: 0, height: 280, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {frame < Q.countdown ? (
          <div
            style={{
              width: 230,
              height: 230,
              borderRadius: '50%',
              border: `8px dashed ${COLORS.yellow}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONTS.display,
              fontSize: 170,
              color: COLORS.yellow,
              opacity: qmarkOut,
              transform: `scale(${qmarkIn * qmarkPulse}) rotate(${Math.sin(frame / 6) * 6}deg)`,
              textShadow: `0 6px 0 ${COLORS.navy950}`,
            }}
          >
            ?
          </div>
        ) : null}
        {frame >= Q.countdown && frame < Q.reveal + 6 ? (
          <div style={{ transform: `scale(${timerIn})`, opacity: timerOut }}>
            <Sequence from={Q.countdown} layout="none">
              <CountdownTimer size={270} />
            </Sequence>
          </div>
        ) : null}
        {frame >= Q.reveal ? (
          <div style={{ position: 'absolute' }}>
            <Sequence from={Q.reveal} layout="none">
              <CorrectBanner text={QUIZ.revealText} />
            </Sequence>
          </div>
        ) : null}
      </div>

      {/* opções A, B, C */}
      {QUIZ.options.map((o, i) => (
        <div key={o.letter} style={{ position: 'absolute', top: cardY(i), left: 90 }}>
          <AnswerCard letter={o.letter} text={o.text} enterAt={8 + i * 6} revealAt={Q.reveal} isCorrect={o.letter === QUIZ.correct} />
        </div>
      ))}

      {/* faixa "VOCÊ TEM 5 SEGUNDOS!" */}
      {inCountdown ? (
        <div style={{ position: 'absolute', top: CAPTION_Y + 6, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '16px 36px',
              borderRadius: 999,
              background: urgentLevel > 0 ? COLORS.hot : 'rgba(4,12,34,0.75)',
              border: `4px solid ${COLORS.yellow}`,
              fontFamily: FONTS.display,
              fontSize: 62,
              color: COLORS.yellow,
              transform: `scale(${bannerIn * bannerBeat})`,
              boxShadow: '0 10px 0 rgba(0,0,0,0.3)',
            }}
          >
            <ClockIcon size={60} rotate={cdLocal * 12} color={COLORS.yellow} />
            <span style={{ color: urgentLevel > 0 ? COLORS.white : COLORS.yellow }}>{QUIZ.countdownBanner}</span>
          </div>
        </div>
      ) : null}

      {frame >= Q.reveal ? (
        <Sequence from={Q.reveal} layout="none">
          <Confetti x={540} y={cardY(correctIndex) + CARD_H / 2} />
        </Sequence>
      ) : null}
      <AbsoluteFill style={{ backgroundColor: COLORS.white, opacity: flash, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

// ---------------- CENA 05 — DICA EDUCATIVA ----------------
const TipScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const icons = [
    { C: ShadeIcon, label: QUIZ.tipIcons[0] },
    { C: HatIcon, label: QUIZ.tipIcons[1] },
    { C: BottleIcon, label: QUIZ.tipIcons[2] },
  ];
  const title = spring({ frame: frame - 2, fps, config: { damping: 10, stiffness: 190 } });
  const fpsValue = Math.round(interpolate(frame, [4, 18], [0, 30], clamp));
  const subIn = interpolate(frame, [20, 30], [0, 1], clamp);
  const enter = interpolate(frame, [0, 6], [0, 1], clamp);
  const exit = interpolate(frame, [93, 99], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: enter * exit }}>
      <SummerBackground heat={0.9} />
      <div style={{ position: 'absolute', top: 240, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 44 }}>
        {icons.map(({ C, label }, i) => {
          const s = spring({ frame: frame - 5 - i * 6, fps, config: { damping: 10, stiffness: 200 } });
          return (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, transform: `scale(${s}) translateY(${Math.sin((frame + i * 10) / 8) * 6}px)` }}>
              <div
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 48,
                  background: COLORS.cardBg,
                  border: `3px solid ${COLORS.cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
                }}
              >
                <C size={160} />
              </div>
              <div style={{ fontFamily: FONTS.body, fontWeight: 800, fontSize: 36, color: COLORS.white }}>{label}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', top: 640, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, transform: `scale(${interpolate(title, [0, 1], [0.4, 1])})` }}>
          <SunIcon size={170} rotate={frame * 2} />
          <div style={{ fontFamily: FONTS.display, fontSize: 250, color: COLORS.yellow, lineHeight: 1, textShadow: `0 10px 0 ${COLORS.navy950}, 0 0 60px rgba(255,210,31,0.45)` }}>
            FPS {fpsValue}
          </div>
        </div>
        <div style={{ fontFamily: FONTS.display, fontSize: 130, color: COLORS.white, lineHeight: 1.05, opacity: interpolate(frame, [10, 16], [0, 1], clamp), textShadow: `0 8px 0 ${COLORS.navy950}` }}>
          {QUIZ.tipTitle[1]}
        </div>
        <div
          style={{
            marginTop: 34,
            maxWidth: 820,
            textAlign: 'center',
            fontFamily: FONTS.body,
            fontWeight: 700,
            fontSize: 46,
            lineHeight: 1.25,
            color: COLORS.textDim,
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * 20}px)`,
            padding: '20px 34px',
            borderRadius: 28,
            background: 'rgba(4,12,34,0.55)',
            border: `2px solid ${COLORS.cardBorder}`,
          }}
        >
          {QUIZ.tipSub}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------- CENA 06 — CTA E ASSINATURA ----------------
const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = spring({ frame, fps, config: { damping: 9, stiffness: 220, mass: 0.6 } });
  const sub = spring({ frame: frame - 6, fps, config: { damping: 11, stiffness: 200 } });
  const comment = spring({ frame: frame - 20, fps, config: { damping: 13, stiffness: 170 } });
  const heartLocal = frame - 30;
  const heart = heartLocal < 0 ? 0 : spring({ frame: heartLocal, fps, config: { damping: 7, stiffness: 260 } }) * (1 + 0.08 * Math.sin(heartLocal / 3.5));
  const look = Math.sin(frame / 7);

  return (
    <AbsoluteFill>
      <SummerBackground heat={0.5} />
      <div style={{ position: 'absolute', top: 250, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, transform: `scale(${interpolate(title, [0, 1], [1.8, 1])})`, opacity: interpolate(frame, [0, 3], [0, 1], clamp) }}>
          <div style={{ fontFamily: FONTS.display, fontSize: 190, color: COLORS.white, lineHeight: 1, textShadow: `0 10px 0 ${COLORS.navy950}` }}>{QUIZ.ctaTitle}</div>
          <EyesIcon size={170} look={look} />
        </div>
        <div
          style={{
            marginTop: 26,
            padding: '18px 44px',
            borderRadius: 999,
            background: COLORS.yellow,
            color: COLORS.navy950,
            fontFamily: FONTS.display,
            fontSize: 84,
            transform: `scale(${sub}) rotate(-2deg)`,
            boxShadow: '0 10px 0 rgba(0,0,0,0.3)',
          }}
        >
          {QUIZ.ctaSub}
        </div>
      </div>

      {/* comentário ilustrativo */}
      <div style={{ position: 'absolute', top: 760, left: 110, right: 110, transform: `translateY(${interpolate(comment, [0, 1], [80, 0])}px)`, opacity: comment }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '26px 30px', borderRadius: 34, background: COLORS.white, boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }}>
          <div style={{ width: 92, height: 92, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.yellow}, ${COLORS.orange})`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SunIcon size={64} color={COLORS.white} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONTS.body, fontWeight: 800, fontSize: 30, color: COLORS.navy800 }}>{QUIZ.commentUser}</div>
            <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 34, color: COLORS.navy950, lineHeight: 1.2 }}>{QUIZ.commentText}</div>
          </div>
          <HeartIcon size={70} style={{ transform: `scale(${heart})`, flexShrink: 0 }} />
        </div>
      </div>

      <div style={{ position: 'absolute', top: 1060, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <Sequence from={16} layout="none">
          <BrandSignature />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};

// ---------------- ÁUDIO ----------------
const voiceActive = (f: number) =>
  Object.values(VOICE).some((v) => f >= v.from - 3 && f <= v.from + Math.ceil(v.seconds * 30) + 3);

const musicVolume = (f: number) => {
  const base = f >= SCENES.countdown.from && f < SCENES.reveal.from ? interpolate(f, [SCENES.countdown.from, SCENES.reveal.from], [0.3, 0.38]) : 0.28;
  const ducked = voiceActive(f) ? base * 0.45 : base;
  // a própria trilha já termina em fade no frame 540
  return ducked * interpolate(f, [0, 2], [0.4, 1], clamp);
};

const Soundtrack: React.FC = () => (
  <>
    <Audio src={staticFile('audio/music.wav')} volume={musicVolume} />
    {Object.entries(VOICE).map(([k, v]) => (
      <Sequence key={k} from={v.from} layout="none">
        <Audio src={staticFile(v.file)} volume={0.82} />
      </Sequence>
    ))}
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.at} layout="none">
        <Audio src={staticFile(s.file)} volume={s.volume} />
      </Sequence>
    ))}
  </>
);

// ---------------- COMPOSIÇÃO ----------------
export const QuizVerao: React.FC = () => {
  const len = (s: { from: number; to: number }) => s.to - s.from;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.navy950 }}>
      <Sequence from={SCENES.hook.from} durationInFrames={len(SCENES.hook)}>
        <SummerBackground heat={0.7} />
        <HookScene />
      </Sequence>
      <Sequence from={SCENES.question.from} durationInFrames={SCENES.reveal.to - SCENES.question.from}>
        <QuizBoard />
      </Sequence>
      <Sequence from={SCENES.tip.from} durationInFrames={len(SCENES.tip)}>
        <TipScene />
      </Sequence>
      <Sequence from={SCENES.cta.from} durationInFrames={DURATION_IN_FRAMES - SCENES.cta.from}>
        <CtaScene />
      </Sequence>
      <AnimatedCaptions blocks={CAPTIONS} y={CAPTION_Y} />
      <Soundtrack />
    </AbsoluteFill>
  );
};

// ---------------- CAPA DO REELS ----------------
export const CapaReels: React.FC = () => (
  <AbsoluteFill>
    <SummerBackground heat={0.9} />
    <div style={{ position: 'absolute', top: 318, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 350, height: 350 }}>
        <div style={{ position: 'absolute', inset: -90, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,210,31,0.5) 0%, rgba(255,138,31,0) 65%)' }} />
        <SunIcon size={350} rotate={8} />
      </div>
    </div>
    <div style={{ position: 'absolute', top: 210, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{ padding: '12px 30px', borderRadius: 999, background: COLORS.yellow, color: COLORS.navy950, fontFamily: FONTS.display, fontSize: 44, letterSpacing: 2 }}>
        QUIZ DO VERÃO
      </div>
    </div>
    <div style={{ position: 'absolute', top: 690, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {QUIZ.hookLines.map((l, i) => (
        <div
          key={l}
          style={{
            fontFamily: FONTS.display,
            fontSize: [160, 166, 146, 186][i],
            lineHeight: 1.02,
            color: i === 3 ? COLORS.yellow : COLORS.white,
            textShadow: `0 9px 0 ${COLORS.navy950}, 0 14px 40px rgba(0,0,0,0.45)`,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          {l}
          {i === 3 ? <SunIcon size={150} /> : null}
        </div>
      ))}
    </div>
    <div style={{ position: 'absolute', top: 1420, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
      <Img src={LOGO} style={{ width: 96, height: 96, borderRadius: 22 }} />
      <div style={{ fontFamily: FONTS.display, fontSize: 52, color: COLORS.white }}>FARMÁCIA PREÇO BOM</div>
    </div>
  </AbsoluteFill>
);
