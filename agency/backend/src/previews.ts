import * as fs from 'node:fs';
import * as path from 'node:path';

import type { BrandAsset, Project, ProjectPreview } from '@pixel-agency/shared';

import { MIME_BY_EXT, type ProjectAssetCache } from './assets.js';
import type { AgencyStore } from './store.js';
import { newId, nowIso } from './util/ids.js';

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const UPLOAD_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class PreviewError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

/**
 * ProjectPreviewEngine — real images of a project's interfaces, in the
 * documented priority order:
 *   1. screenshots that already exist in the repository;
 *   2./3. Playwright captures of the project's own configured URL
 *      (dev/staging/production), only when enabled and authorized;
 *   4. images uploaded by the user.
 * It never generates or fabricates a dashboard image.
 */
export class ProjectPreviewEngine {
  constructor(
    private readonly store: AgencyStore,
    private readonly assets: ProjectAssetCache,
    private readonly captureEnabled: boolean,
  ) {}

  list(projectId: string): ProjectPreview[] {
    return this.store.previews
      .filter((p) => p.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Register screenshots found by the brand extractor (deduped by content). */
  syncFromRepo(
    project: Project,
    mirrorPath: string,
    commitSha: string,
    candidates: BrandAsset[],
  ): ProjectPreview[] {
    const existing = new Set(this.list(project.id).map((p) => p.assetId));
    const added: ProjectPreview[] = [];
    for (const c of candidates
      .filter((x) => x.kind === 'screenshot' || x.kind === 'banner')
      .slice(0, 12)) {
      let assetId: string;
      try {
        assetId =
          c.assetId ?? this.assets.put(fs.readFileSync(path.join(mirrorPath, c.path)), c.mime);
      } catch {
        continue;
      }
      if (existing.has(assetId)) continue;
      existing.add(assetId);
      const preview: ProjectPreview = {
        id: newId('pv'),
        projectId: project.id,
        title: humanTitle(c.path),
        source: 'repo',
        origin: c.path,
        assetId,
        mime: c.mime,
        bytes: c.bytes,
        createdAt: nowIso(),
        commitSha,
      };
      this.store.previews.put(preview);
      added.push(preview);
    }
    return added;
  }

  upload(
    project: Project,
    input: {
      title: string;
      mime: string;
      dataBase64: string;
      agentId?: string;
      missionId?: string;
      filename?: string;
    },
  ): ProjectPreview {
    if (!UPLOAD_MIMES.has(input.mime)) throw new PreviewError('Envie PNG, JPEG ou WebP');
    const buf = Buffer.from(input.dataBase64, 'base64');
    if (buf.length === 0) throw new PreviewError('Arquivo vazio');
    if (buf.length > MAX_UPLOAD_BYTES) throw new PreviewError('Imagem acima de 6 MB', 413);
    let assetId: string;
    try {
      assetId = this.assets.put(buf, input.mime);
    } catch (err) {
      throw new PreviewError((err as Error).message);
    }
    const preview: ProjectPreview = {
      id: newId('pv'),
      projectId: project.id,
      title: input.title.slice(0, 120) || 'Imagem enviada',
      source: 'upload',
      origin: (input.filename ?? 'upload').slice(0, 200),
      assetId,
      mime: input.mime,
      bytes: buf.length,
      agentId: input.agentId,
      missionId: input.missionId,
      createdAt: nowIso(),
    };
    this.store.previews.put(preview);
    return preview;
  }

  /**
   * Capture a page of the project's own app. SSRF guard: the URL must share
   * the origin of `project.appUrl`, which only an admin can configure.
   */
  async capture(project: Project, input: { url?: string; title: string }): Promise<ProjectPreview> {
    if (!this.captureEnabled) {
      throw new PreviewError(
        'Captura desativada no servidor (defina AGENCY_ENABLE_CAPTURE=1 e instale o Chromium).',
        501,
      );
    }
    if (!project.appUrl)
      throw new PreviewError('Configure a URL da aplicação do projeto antes de capturar.');
    const base = new URL(project.appUrl);
    const target = new URL(input.url ?? project.appUrl, base);
    if (target.origin !== base.origin || !/^https?:$/.test(target.protocol)) {
      throw new PreviewError('A captura só é permitida na origem configurada para o projeto.', 403);
    }
    let chromium: { launch(opts: Record<string, unknown>): Promise<unknown> };
    try {
      ({ chromium } = (await import('playwright-core')) as unknown as {
        chromium: typeof chromium;
      });
    } catch {
      throw new PreviewError('playwright-core não está instalado neste servidor.', 501);
    }
    const browser = (await chromium.launch({
      executablePath: process.env.AGENCY_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox'],
    })) as {
      newPage(o: Record<string, unknown>): Promise<{
        goto(u: string, o: Record<string, unknown>): Promise<unknown>;
        screenshot(o: Record<string, unknown>): Promise<Buffer>;
      }>;
      close(): Promise<void>;
    };
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(target.toString(), { waitUntil: 'networkidle', timeout: 30_000 });
      const buf = await page.screenshot({ type: 'png' });
      const assetId = this.assets.put(Buffer.from(buf), 'image/png');
      const preview: ProjectPreview = {
        id: newId('pv'),
        projectId: project.id,
        title: input.title.slice(0, 120) || target.pathname,
        source: 'capture',
        origin: target.toString(),
        assetId,
        mime: 'image/png',
        bytes: buf.length,
        createdAt: nowIso(),
      };
      this.store.previews.put(preview);
      return preview;
    } finally {
      await browser.close();
    }
  }

  remove(previewId: string): boolean {
    return this.store.previews.delete(previewId);
  }
}

function humanTitle(rel: string): string {
  const base = path.posix.basename(rel).replace(/\.[a-z]+$/i, '');
  const t = base.replace(/[-_.]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export { MIME_BY_EXT };
