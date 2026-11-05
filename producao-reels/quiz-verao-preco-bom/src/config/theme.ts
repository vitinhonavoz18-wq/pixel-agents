import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const COLORS = {
  navy950: '#040C22',
  navy900: '#071940',
  navy800: '#0B2659',
  navy700: '#12357A',
  yellow: '#FFD21F',
  yellowSoft: '#FFE680',
  orange: '#FF8A1F',
  hot: '#FF4D2E',
  green: '#22C55E',
  greenDeep: '#15803D',
  white: '#FFFFFF',
  brandRed: '#E3262E',
  brandBlue: '#1E5BFF',
  cardBg: 'rgba(255,255,255,0.08)',
  cardBorder: 'rgba(255,255,255,0.18)',
  textDim: 'rgba(255,255,255,0.78)',
};

export const FONTS = {
  display: 'Anton, Impact, sans-serif',
  body: 'Inter, Arial, sans-serif',
};

// Área segura do Reels: evita a barra superior e os botões/legenda do app.
export const SAFE = { top: 210, bottom: 1540, left: 80, right: 1000 };

let loaded = false;
export const ensureFonts = () => {
  if (loaded) return;
  loaded = true;
  loadFont({ family: 'Anton', url: staticFile('fonts/anton-latin-400-normal.woff2'), weight: '400' });
  for (const w of ['500', '700', '800', '900']) {
    loadFont({ family: 'Inter', url: staticFile(`fonts/inter-latin-${w}-normal.woff2`), weight: w });
  }
};
