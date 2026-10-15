import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ProjectAssetCache } from '../src/assets.js';
import { extractBrand, ProjectBrandingEngine } from '../src/branding.js';

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function fixtureRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-brand-'));
  const w = (rel: string, data: string | Buffer) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), data);
  };
  w(
    'public/logo-flydelivery.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="4"/></svg>',
  );
  w('public/favicon.ico', Buffer.from([0, 0, 1, 0, 1, 0]));
  w('docs/screenshots/dashboard.png', PNG);
  w('node_modules/lib/logo.png', PNG); // must be ignored
  w('test/fixtures/logo.png', PNG); // penalized
  w(
    'src/index.css',
    ':root { --primary: #FF6A00; --background: #0b1020; --text-main: #fff; }\nbody { font-family: "Poppins", sans-serif; }',
  );
  w(
    'tailwind.config.js',
    "module.exports = { theme: { extend: { colors: { brand: '#ff6a00', accent: '#1e90ff' } } } }",
  );
  w(
    'public/manifest.json',
    JSON.stringify({ theme_color: '#ff6a00', icons: [{ src: 'favicon.ico' }] }),
  );
  w('README.md', '# FlyDelivery\n\n![Tela do painel](docs/screenshots/dashboard.png)\n');
  return root;
}

describe('BrandAssetExtractor', () => {
  it("finds the project's own logo, colors, fonts and screenshots", () => {
    const root = fixtureRepo();
    const b = extractBrand(root, 'FlyDelivery');
    expect(b.selectedLogoPath).toBe('public/logo-flydelivery.svg');
    expect(b.logoCandidates.some((c) => c.path.startsWith('node_modules'))).toBe(false);
    const fixture = b.logoCandidates.find((c) => c.path === 'test/fixtures/logo.png');
    expect(fixture === undefined || fixture.score < b.logoCandidates[0].score).toBe(true);
    expect(b.logoCandidates.find((c) => c.path === 'docs/screenshots/dashboard.png')?.kind).toBe(
      'screenshot',
    );
    expect(b.theme.primary).toBe('#ff6a00');
    expect(b.colors.find((c) => c.hex === '#ff6a00')?.role).toBe('primary');
    expect(b.colors.some((c) => c.hex === '#1e90ff' && c.role === 'accent')).toBe(true);
    expect(b.fonts.map((f) => f.family)).toContain('Poppins');
    expect(b.sourceFiles).toEqual(expect.arrayContaining(['src/index.css', 'tailwind.config.js']));
  });

  it('caches by commit and keeps an explicit user logo choice', () => {
    const root = fixtureRepo();
    const engine = new ProjectBrandingEngine(
      new ProjectAssetCache(fs.mkdtempSync(path.join(os.tmpdir(), 'a-')), 'k'),
    );
    const project = { id: 'flydelivery', name: 'FlyDelivery' } as never;
    const first = engine.build(project, root, 'sha1');
    expect(first.status).toBe('ok');
    expect(
      first.logoCandidates.find((c) => c.path === 'public/logo-flydelivery.svg')?.assetId,
    ).toMatch(/\.svg$/);
    expect(engine.build(project, root, 'sha1', first)).toBe(first);
    const chosen = { ...first, selectedLogoPath: 'public/favicon.ico', selectedByUser: true };
    const second = engine.build(project, root, 'sha2', chosen);
    expect(second.selectedLogoPath).toBe('public/favicon.ico');
    expect(second.selectedByUser).toBe(true);
  });
});

describe('ProjectAssetCache', () => {
  it('rejects content that does not match the declared type and signs URLs', () => {
    const cache = new ProjectAssetCache(fs.mkdtempSync(path.join(os.tmpdir(), 'a-')), 'secret');
    expect(() => cache.put(Buffer.from('<script>'), 'image/png')).toThrow();
    const id = cache.put(PNG, 'image/png');
    expect(cache.put(PNG, 'image/png')).toBe(id); // content-addressed
    const url = new URL(cache.signedPath(id, 60, 1_000_000), 'http://x');
    const exp = url.searchParams.get('exp')!;
    const sig = url.searchParams.get('sig')!;
    expect(cache.verify(id, exp, sig, 1_000_000)).toBe(true);
    expect(cache.verify(id, exp, sig, 1_000_000 + 61_000)).toBe(false);
    expect(cache.verify(id, exp, sig + 'x', 1_000_000)).toBe(false);
    expect(cache.read('../../etc/passwd')).toBeNull();
  });
});
