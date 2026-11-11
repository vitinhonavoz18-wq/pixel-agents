import {continueRender, delayRender, staticFile} from 'remotion';

// Fontes locais (SIL OFL): Sora = tipografia da marca; Inter = interfaces de chat.
const faces: [string, string, string][] = [
  ['Sora', 'fonts/sora-latin-wght-normal.woff2', 'U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2122, U+2212'],
  ['Sora', 'fonts/sora-latin-ext-wght-normal.woff2', 'U+0100-024F, U+1E00-1EFF'],
  ['Inter', 'fonts/inter-latin-wght-normal.woff2', 'U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2122, U+2212'],
  ['Inter', 'fonts/inter-latin-ext-wght-normal.woff2', 'U+0100-024F, U+1E00-1EFF'],
];

let loaded = false;
export const loadFonts = () => {
  if (loaded || typeof document === 'undefined') return;
  loaded = true;
  const handle = delayRender('fonts');
  Promise.all(
    faces.map(([family, file, range]) => {
      const ff = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
        weight: '100 900',
        unicodeRange: range,
      });
      (document.fonts as unknown as {add: (f: FontFace) => void}).add(ff);
      return ff.load();
    }),
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
};
