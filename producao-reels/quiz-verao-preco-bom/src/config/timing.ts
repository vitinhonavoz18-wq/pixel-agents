// Linha do tempo do Reels. Tudo em FRAMES (30 por segundo).
// Mudar um número aqui reposiciona cena, áudio e legenda juntos.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 540; // 18,0 s

export const sec = (s: number) => Math.round(s * FPS);

export const SCENES = {
  hook: { from: 0, to: 51 }, //          0,0 → 1,7 s
  question: { from: 51, to: 117 }, //    1,7 → 3,9 s
  countdown: { from: 117, to: 267 }, //  3,9 → 8,9 s (exatamente 150 frames = 5 s)
  reveal: { from: 267, to: 375 }, //     8,9 → 12,5 s
  tip: { from: 375, to: 474 }, //       12,5 → 15,8 s
  cta: { from: 474, to: 540 }, //       15,8 → 18,0 s
} as const;

export const COUNTDOWN_SECONDS = 5;
export const FRAMES_PER_COUNT = FPS; // cada número dura 1 s

// Início de cada fala (frames). Durações reais medidas com ffprobe:
// 01 = 1,47 s | 02 = 2,14 s | 04 = 3,54 s | 05 = 3,41 s | 06 = 1,88 s
export const VOICE = {
  hook: { from: 1, file: 'audio/voice/01-gancho.wav', seconds: 1.47 },
  question: { from: 53, file: 'audio/voice/02-pergunta.wav', seconds: 2.14 },
  reveal: { from: 268, file: 'audio/voice/04-revelacao.wav', seconds: 3.54 },
  tip: { from: 375, file: 'audio/voice/05-dica.wav', seconds: 3.41 },
  cta: { from: 480, file: 'audio/voice/06-cta.wav', seconds: 1.88 },
} as const;

export type SfxCue = { at: number; file: string; volume: number };

const tick = (i: number): SfxCue => ({
  at: SCENES.countdown.from + i * FRAMES_PER_COUNT,
  file: i >= 3 ? 'sfx/tick-high.wav' : 'sfx/tick.wav',
  volume: i >= 3 ? 0.55 : 0.45,
});

export const SFX: SfxCue[] = [
  { at: 0, file: 'sfx/impact.wav', volume: 0.7 },
  { at: 48, file: 'sfx/whoosh.wav', volume: 0.35 },
  { at: 59, file: 'sfx/pop.wav', volume: 0.35 },
  { at: 65, file: 'sfx/pop.wav', volume: 0.35 },
  { at: 71, file: 'sfx/pop.wav', volume: 0.35 },
  ...[0, 1, 2, 3, 4].map(tick),
  { at: 254, file: 'sfx/suspense.wav', volume: 0.4 },
  { at: 267, file: 'sfx/correct.wav', volume: 0.5 },
  { at: 372, file: 'sfx/whoosh.wav', volume: 0.3 },
  { at: 380, file: 'sfx/pop.wav', volume: 0.25 },
  { at: 386, file: 'sfx/pop.wav', volume: 0.25 },
  { at: 392, file: 'sfx/pop.wav', volume: 0.25 },
  { at: 474, file: 'sfx/pop.wav', volume: 0.35 },
  { at: 494, file: 'sfx/pop.wav', volume: 0.28 },
  { at: 504, file: 'sfx/heart.wav', volume: 0.4 },
];
