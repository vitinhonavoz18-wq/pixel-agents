// Render reproduzível: node scripts/render.mjs [--preview] [--stills 1,5,10]
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => (args.indexOf(f) >= 0 ? args[args.indexOf(f) + 1] : undefined);
const browserExecutable = existsSync('/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell')
  ? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'
  : undefined;
const outDir = path.join(root, 'output');
mkdirSync(outDir, {recursive: true});

const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public')});
const common = {serveUrl, browserExecutable, chromiumOptions: {gl: 'swangle'}};

if (val('--stills')) {
  const comp = await selectComposition({...common, id: 'ConectflyEp01'});
  const dir = path.join(root, val('--dir') ?? 'out/stills');
  mkdirSync(dir, {recursive: true});
  for (const s of val('--stills').split(',')) {
    const frame = Math.min(899, Math.round(parseFloat(s) * 30));
    await renderStill({...common, composition: comp, frame, output: path.join(dir, `f_${String(frame).padStart(3, '0')}.png`), scale: parseFloat(val('--scale') ?? '0.5')});
    console.log('still', s);
  }
  process.exit(0);
}

if (has('--thumb')) {
  const comp = await selectComposition({...common, id: 'Thumbnail'});
  await renderStill({...common, composition: comp, output: path.join(outDir, 'thumbnail.png')});
  console.log('thumbnail ok');
  process.exit(0);
}

const comp = await selectComposition({...common, id: 'ConectflyEp01'});
const preview = has('--preview');
const range = val('--frames')?.split('-').map(Number);
const output = path.join(outDir, preview ? 'conectfly-ia-24h-preview.mp4' : 'conectfly-ia-24h-fullhd.mp4');
let last = -1;
await renderMedia({
  ...common,
  composition: comp,
  codec: 'h264',
  output: range ? path.join(root, 'out/test.mp4') : output,
  frameRange: range,
  crf: preview ? 26 : 17,
  pixelFormat: 'yuv420p',
  scale: preview ? 0.5 : 1,
  audioCodec: 'aac',
  audioBitrate: preview ? '128k' : '320k',
  x264Preset: preview ? 'veryfast' : 'slow',
  concurrency: parseInt(val('--concurrency') ?? '4', 10),
  imageFormat: 'jpeg',
  jpegQuality: 96,
  onProgress: ({progress}) => {
    const p = Math.floor(progress * 20);
    if (p !== last) {
      last = p;
      console.log(`render ${Math.round(progress * 100)}%`);
    }
  },
});
console.log('ok ->', output);
