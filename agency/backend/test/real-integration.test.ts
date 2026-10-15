import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ProjectAssetCache } from '../src/assets.js';
import { ProjectBrandingEngine } from '../src/branding.js';
import { ProjectPreviewEngine } from '../src/previews.js';
import { AgencyStore } from '../src/store.js';
import { WorkspaceManager } from '../src/workspaces.js';

/**
 * Opt-in integration test against a REAL GitHub repository (network) and a
 * real Chromium. Run with:
 *   AGENCY_REAL_TESTS=1 AGENCY_REAL_REPO=owner/name \
 *   AGENCY_CAPTURE_URL=http://localhost:8090/ AGENCY_CHROMIUM_PATH=/path/chrome npx vitest run test/real-integration.test.ts
 */
const [owner, name] = (process.env.AGENCY_REAL_REPO ?? 'vitinhonavoz18-wq/pixel-agents').split('/');
const captureUrl = process.env.AGENCY_CAPTURE_URL;
const project = {
  id: 'pixel-agents',
  name: 'Pixel Agents',
  description: '',
  team: [],
  authorized: true,
  archived: false,
  createdAt: '',
  updatedAt: '',
  appUrl: captureUrl,
  repo: { provider: 'github' as const, owner, name, defaultBranch: 'main' },
};

describe.runIf(process.env.AGENCY_REAL_TESTS === '1')('real repository + browser', () => {
  it('clones a real repo into an isolated branch, extracts its brand and captures a page', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-ws-'));
    const ws = new WorkspaceManager(root);
    const m = await ws.prepareMission(project, 'm_test1');
    expect(m.branch).toBe('pixel-agency/m_test1');
    expect(fs.existsSync(path.join(m.path, 'package.json'))).toBe(true);
    fs.writeFileSync(path.join(m.path, 'NOVO.md'), 'x');
    const diff = await ws.diff(m);
    expect(diff.stat).toContain('NOVO.md');
    const remote = fs.readFileSync(path.join(m.path, '.git', 'config'), 'utf8');
    expect(remote).not.toMatch(/extraHeader|Authorization/i);

    const mirror = await ws.prepareMirror(project);
    const assets = new ProjectAssetCache(root, 'k');
    const b = new ProjectBrandingEngine(assets).build(project, mirror.path, mirror.commitSha);
    console.log(
      'LOGO',
      b.selectedLogoPath,
      '| candidates',
      b.logoCandidates
        .slice(0, 6)
        .map((c) => `${c.path}(${c.kind},${c.score})`)
        .join(', '),
    );
    console.log(
      'COLORS',
      b.colors
        .slice(0, 6)
        .map((c) => `${c.hex}:${c.role}:${c.source}`)
        .join(' | '),
    );
    console.log('FONTS', b.fonts.map((f) => f.family).join(', '));
    expect(b.status).toBe('ok');

    const store = new AgencyStore(root);
    const previews = new ProjectPreviewEngine(store, assets, true);
    const repoShots = previews.syncFromRepo(
      project,
      mirror.path,
      mirror.commitSha,
      b.logoCandidates,
    );
    console.log('REPO PREVIEWS', repoShots.map((p) => p.origin).join(', '));
    if (captureUrl) {
      const cap = await previews.capture(project, { title: 'Home' });
      console.log('CAPTURE', cap.origin, cap.bytes, 'bytes');
      expect(cap.bytes).toBeGreaterThan(1000);
      await expect(
        previews.capture(project, { url: 'https://example.com/', title: 'x' }),
      ).rejects.toThrow(/origem/);
    }
  }, 180_000);
});
