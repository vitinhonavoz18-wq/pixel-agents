import {Easing, interpolate, useCurrentFrame} from 'remotion';
import timeline from './timeline.json';
import words from './words.json';
import {FPS} from '../styles/theme';

export const TL = timeline;
export const WORDS = words.words as {line: number; word: string; start: number; end: number}[];

/** Tempo global em segundos (todas as cenas usam o relógio absoluto da timeline). */
export const useTime = () => useCurrentFrame() / FPS;

const OUT = Easing.bezier(0.16, 1, 0.3, 1); // expo-out suave
const INOUT = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 entre a e b (s), com easing "expo out". */
export const ease = (t: number, a: number, b: number, e = OUT) =>
  interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});
export const easeIO = (t: number, a: number, b: number) => ease(t, a, b, INOUT);
export const lin = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Janela com fade de entrada e saída (para crossfades sem frames pretos). */
export const windowFade = (t: number, a: number, b: number, fin = 0.35, fout = 0.35) =>
  Math.min(lin(t, a, a + fin), 1 - lin(t, b - fout, b));

/** Ruído determinístico (sem Math.random -> render reproduzível). */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
