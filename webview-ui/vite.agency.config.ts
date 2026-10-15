/**
 * PIXEL AGENCY office build: the unmodified Pixel Agents office, driven by
 * the app through HostBridgeTransport, emitted as ONE self-contained HTML file
 * (JS, CSS, fonts and pre-decoded sprites inlined) so the Android WebView can
 * load it offline and the web build can mount it via iframe `srcdoc`.
 *
 *   cd agency && npm run office:build
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import * as fs from 'fs';
import * as path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

import { buildFurnitureCatalog } from '../core/src/assets/build.ts';
import {
  decodeAllCarpets,
  decodeAllCharacters,
  decodeAllFloors,
  decodeAllFurniture,
  decodeAllWalls,
} from '../core/src/assets/loader.ts';
import { loadPetSprites } from '../server/src/assetLoader.ts';

const VIRTUAL_ID = 'virtual:pixel-agency-office-assets';
const RESOLVED_ID = '\0' + VIRTUAL_ID;
const assetsRoot = path.resolve(__dirname, 'public');
const assetsDir = path.join(assetsRoot, 'assets');
const layoutPath = path.resolve(__dirname, '../agency/office-layout/agency-layout.json');
const outDir = path.resolve(__dirname, '../agency/dist-office');

function agencyAssetsPlugin(): Plugin {
  return {
    name: 'pixel-agency-office-assets',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      if (!fs.existsSync(layoutPath)) {
        throw new Error(`Missing ${layoutPath} — run "npm run office:layout" in agency/ first.`);
      }
      const catalog = buildFurnitureCatalog(assetsDir);
      const pets = await loadPetSprites(assetsRoot);
      const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
      const payload = {
        characters: decodeAllCharacters(assetsDir),
        floors: decodeAllFloors(assetsDir),
        walls: decodeAllWalls(assetsDir),
        carpets: decodeAllCarpets(assetsDir),
        catalog,
        furniture: decodeAllFurniture(assetsDir, catalog),
        pets: pets?.pets ?? [],
        petNames: pets?.manifests.map((m) => m.name) ?? [],
        layout: JSON.parse(fs.readFileSync(layoutPath, 'utf8')),
        version: String(pkg.version),
      };
      return `export default ${JSON.stringify(payload)};`;
    },
  };
}

/** Inline the emitted JS + CSS chunks into the HTML: one file, no fetches. */
function singleFilePlugin(): Plugin {
  return {
    name: 'pixel-agency-single-file',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const html = Object.values(bundle).find(
        (f) => f.type === 'asset' && f.fileName.endsWith('.html'),
      );
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          const re = new RegExp(`<script[^>]*src="[^"]*${escapeRe(name)}"[^>]*></script>`);
          const code = chunk.code.replace(/<\/script/gi, '<\\/script');
          source = source.replace(re, () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (chunk.type === 'asset' && name.endsWith('.css')) {
          const re = new RegExp(`<link[^>]*href="[^"]*${escapeRe(name)}"[^>]*>`);
          const css = inlineFonts(String(chunk.source));
          source = source.replace(re, () => `<style>${css}</style>`);
          delete bundle[name];
        }
      }
      html.source = source;
    },
  };
}

/** index.css loads the pixel font from public/fonts; embed it as a data URI. */
function inlineFonts(css: string): string {
  return css.replace(/url\((['"]?)\/fonts\/([^'")]+)\1\)/g, (match, _q, file: string) => {
    const fontPath = path.join(assetsRoot, 'fonts', file);
    if (!fs.existsSync(fontPath)) return match;
    const mime = file.endsWith('.woff2')
      ? 'font/woff2'
      : file.endsWith('.woff')
        ? 'font/woff'
        : 'font/ttf';
    return `url(data:${mime};base64,${fs.readFileSync(fontPath).toString('base64')})`;
  });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default defineConfig({
  root: __dirname,
  plugins: [tailwindcss(), react(), agencyAssetsPlugin(), singleFilePlugin()],
  // The office's own public/ holds PNG sources only; everything is inlined.
  publicDir: false,
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'agency.html'),
      output: { codeSplitting: false },
    },
  },
});
