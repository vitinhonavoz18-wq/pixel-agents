import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FONT_BRAND} from '../styles/theme';
import {WORDS, ease, lin} from '../timeline/time';

/**
 * Legendas queimadas, palavra por palavra, sincronizadas com os tempos reais
 * da locução (src/timeline/words.json, gerado por scripts/align_words.py).
 * Blocos curtos; palavras de impacto em azul da marca.
 */
// Quantidade de palavras por bloco, por fala. `0` marca bloco "hero" (vira título grande, sem legenda).
const CHUNKS: number[][] = [
  [2, 3, 2, 0],
  [3, 3, 4, 3],
  [2, 2, 3, 3],
  [3, 3, 5],
  [3, 2, 3],
  [2, 3, 3],
];
const HERO_SIZES: Record<string, number> = {'0-3': 3};
const KEYWORDS = /^(funcionário|humano|automação|inteligência|conectfly|24|horas)$/i;

type Chunk = {words: typeof WORDS; start: number; end: number; hero: boolean};

const buildChunks = (): Chunk[] => {
  const out: Chunk[] = [];
  CHUNKS.forEach((sizes, li) => {
    const lw = WORDS.filter((w) => w.line === li + 1);
    let i = 0;
    sizes.forEach((n, ci) => {
      const hero = n === 0;
      const count = hero ? HERO_SIZES[`${li}-${ci}`] : n;
      const ws = lw.slice(i, i + count);
      i += count;
      out.push({words: ws, start: ws[0].start - 0.06, end: ws[ws.length - 1].end, hero});
    });
  });
  // cada bloco fica até o próximo começar (se a pausa for curta)
  for (let k = 0; k < out.length; k++) {
    const next = out[k + 1];
    const hold = out[k].end + 0.45;
    out[k].end = next && next.start - out[k].end < 0.6 ? next.start - 0.02 : hold;
  }
  return out;
};
const ALL = buildChunks();

export const isHeroWord = (t: number) => ALL.some((c) => c.hero && t >= c.start && t < c.end + 0.6);

export const SubtitleRenderer: React.FC<{t: number; y?: number}> = ({t, y = 1430}) => {
  const c = ALL.find((ch) => t >= ch.start && t < ch.end);
  if (!c || c.hero) return null;
  const out = 1 - lin(t, c.end - 0.12, c.end);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 130,
          width: 820,
          top: y - 60,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '0 18px',
          opacity: out,
        }}
      >
        {c.words.map((w, i) => {
          const p = ease(t, w.start - 0.04, w.start + 0.22);
          const key = KEYWORDS.test(w.word.replace(/[.,!?]/g, ''));
          const speaking = t >= w.start && t < w.end + 0.1;
          return (
            <span
              key={i}
              style={{
                fontFamily: FONT_BRAND,
                fontWeight: 600,
                fontSize: 60,
                letterSpacing: -0.5,
                lineHeight: 1.15,
                color: key ? C.cyan : C.white,
                opacity: p * (speaking || key ? 1 : 0.93),
                transform: `translateY(${(1 - p) * 16}px) scale(${0.96 + 0.04 * p})`,
                filter: `blur(${(1 - p) * 6}px)`,
                textShadow: key
                  ? '0 0 22px rgba(50,230,255,0.55), 0 4px 18px rgba(0,0,0,0.75)'
                  : '0 4px 18px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)',
                display: 'inline-block',
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
