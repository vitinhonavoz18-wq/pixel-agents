import * as fs from 'node:fs';
import * as path from 'node:path';

import type { BrandAsset, BrandColor, Project, ProjectBranding } from '@pixel-agency/shared';

import { MIME_BY_EXT, pngSize, type ProjectAssetCache } from './assets.js';
import { nowIso } from './util/ids.js';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.expo',
  '.turbo',
  'coverage',
  'vendor',
  'Pods',
  '.gradle',
  '__pycache__',
  '.venv',
  'venv',
  'target',
]);
const IMAGE_EXT = /\.(png|jpe?g|webp|svg|ico|gif)$/i;
const STYLE_EXT = /\.(css|scss|sass|less|styl)$/i;
const MAX_FILES = 20_000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_BYTES = 300 * 1024;

interface WalkedFile {
  rel: string;
  abs: string;
  size: number;
}

function walk(root: string): WalkedFile[] {
  const out: WalkedFile[] = [];
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (stack.length > 0 && out.length < MAX_FILES) {
    const { dir, depth } = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue; // never follow links out of the repo
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && depth < 8) stack.push({ dir: abs, depth: depth + 1 });
      } else if (e.isFile()) {
        let size = 0;
        try {
          size = fs.statSync(abs).size;
        } catch {
          continue;
        }
        out.push({ rel: path.relative(root, abs).split(path.sep).join('/'), abs, size });
      }
    }
  }
  return out;
}

function readText(abs: string): string {
  try {
    const st = fs.statSync(abs);
    if (st.size > MAX_TEXT_BYTES) return '';
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return '';
  }
}

function normHex(h: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const v = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${v.toLowerCase()}`;
}

function tokens(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/**
 * BrandAssetExtractor — finds a project's OWN identity inside its repository:
 * logo/icon/favicon/banner/screenshot candidates (scored), brand colors from
 * CSS variables, Tailwind config and web/app manifests, and font families.
 * It never fetches anything from the internet.
 */
export function extractBrand(
  root: string,
  projectName: string,
): Omit<ProjectBranding, 'projectId' | 'extractedAt' | 'status'> {
  const files = walk(root);
  const nameTokens = new Set(tokens(projectName));
  const sourceFiles = new Set<string>();

  // ── Images ──────────────────────────────────────────────────────────────
  const readme = files.find((f) => /^readme\.md$/i.test(f.rel));
  const readmeText = readme ? readText(readme.abs) : '';
  const readmeImages = new Map<string, string>(); // rel path → alt text
  for (const m of readmeText.matchAll(/!\[([^\]]*)\]\(([^)\s]+)/g)) {
    const target = m[2].replace(/^\.\//, '');
    if (!/^https?:/i.test(target)) readmeImages.set(target, m[1].toLowerCase());
  }
  for (const m of readmeText.matchAll(
    /<img[^>]+src=["']([^"']+)["'][^>]*?(?:alt=["']([^"']*)["'])?/gi,
  )) {
    const target = m[1].replace(/^\.\//, '');
    if (!/^https?:/i.test(target)) readmeImages.set(target, (m[2] ?? '').toLowerCase());
  }
  if (readme && readmeImages.size > 0) sourceFiles.add(readme.rel);

  // Icons declared by manifests / index.html get a strong boost.
  const declaredIcons = new Set<string>();
  const themeColors: Array<{ hex: string; source: string }> = [];
  for (const f of files) {
    const base = path.basename(f.rel).toLowerCase();
    if (
      base === 'app.json' ||
      base === 'manifest.json' ||
      base === 'site.webmanifest' ||
      base === 'manifest.webmanifest'
    ) {
      const text = readText(f.abs);
      if (!text) continue;
      try {
        const j = JSON.parse(text) as Record<string, unknown>;
        const expo = (j.expo ?? j) as Record<string, unknown>;
        const dir = path.posix.dirname(f.rel);
        const addIcon = (p: unknown) => {
          if (typeof p === 'string')
            declaredIcons.add(path.posix.normalize(path.posix.join(dir, p.replace(/^\//, ''))));
        };
        addIcon(expo.icon);
        if (Array.isArray(j.icons)) for (const i of j.icons) addIcon((i as { src?: unknown }).src);
        for (const key of ['theme_color', 'primaryColor', 'background_color']) {
          const hex = typeof expo[key] === 'string' ? normHex(expo[key] as string) : null;
          if (hex) themeColors.push({ hex, source: `${key} em ${f.rel}` });
        }
        sourceFiles.add(f.rel);
      } catch {
        // not JSON
      }
    } else if (base === 'index.html') {
      const text = readText(f.abs);
      const dir = path.posix.dirname(f.rel);
      for (const m of text.matchAll(
        /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/gi,
      )) {
        declaredIcons.add(path.posix.normalize(path.posix.join(dir, m[1].replace(/^\//, ''))));
        declaredIcons.add(
          path.posix.normalize(path.posix.join(dir, 'public', m[1].replace(/^\//, ''))),
        );
        sourceFiles.add(f.rel);
      }
      const tc = /<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)["']/i.exec(text);
      const hex = tc ? normHex(tc[1]) : null;
      if (hex) themeColors.push({ hex, source: `theme-color em ${f.rel}` });
    }
  }

  const candidates: BrandAsset[] = [];
  for (const f of files) {
    if (!IMAGE_EXT.test(f.rel) || f.size === 0 || f.size > MAX_IMAGE_BYTES) continue;
    const lower = f.rel.toLowerCase();
    const base = path.posix.basename(lower);
    const ext = base.split('.').pop()!.replace('jpeg', 'jpg');
    let kind: BrandAsset['kind'] = 'image';
    let score = 0;
    if (/logo|brand|marca/.test(base)) {
      kind = 'logo';
      score += 0.55;
    } else if (/favicon/.test(base)) {
      kind = 'favicon';
      score += 0.25;
    } else if (/(^|[-_.])(icon|app-icon|adaptive-icon|apple-touch-icon)([-_.]|$)/.test(base)) {
      kind = 'icon';
      score += 0.3;
    } else if (/banner|hero|og[-_]image|social|cover|splash/.test(base)) {
      kind = 'banner';
      score += 0.15;
    } else if (/screenshot|screen|captura|print|preview|dashboard|tela/.test(lower)) {
      kind = 'screenshot';
      score += 0.2;
    }
    if (declaredIcons.has(f.rel)) {
      score += 0.35;
      if (kind === 'image') kind = 'icon';
    }
    const alt = readmeImages.get(f.rel);
    if (alt !== undefined) {
      score += 0.1;
      if (/logo/.test(alt) && kind === 'image') {
        kind = 'logo';
        score += 0.35;
      } else if (kind === 'image') {
        kind = 'screenshot';
        score += 0.1;
      }
    }
    if (/(^|\/)(public|assets|static|images|img|branding|brand|resources|res)\//.test(lower))
      score += 0.1;
    if (tokens(base).some((t) => nameTokens.has(t))) score += 0.2;
    if (ext === 'svg' && kind === 'logo') score += 0.05;
    if (/(^|\/)(test|tests|__tests__|fixtures?|examples?|mocks?|e2e|docs\/legacy)\//.test(lower))
      score -= 0.4;
    if (/mipmap-(l|m)dpi|drawable-(l|m)dpi/.test(lower)) score -= 0.1;
    if (kind === 'image' && score < 0.2) continue;

    let width: number | undefined;
    let height: number | undefined;
    if (ext === 'png') {
      try {
        const fd = fs.openSync(f.abs, 'r');
        const head = Buffer.alloc(24);
        fs.readSync(fd, head, 0, 24, 0);
        fs.closeSync(fd);
        const size = pngSize(head);
        width = size?.width;
        height = size?.height;
      } catch {
        // unreadable header
      }
    }
    if (kind === 'screenshot' && width && height && Math.min(width, height) < 200) score -= 0.2;
    candidates.push({
      path: f.rel,
      kind,
      score: Math.max(0, Math.min(1, Math.round(score * 100) / 100)),
      bytes: f.size,
      mime: MIME_BY_EXT[ext] ?? 'application/octet-stream',
      width,
      height,
    });
  }
  candidates.sort((a, b) => b.score - a.score || b.bytes - a.bytes);

  // ── Colors ──────────────────────────────────────────────────────────────
  const colorMap = new Map<string, BrandColor>();
  const addColor = (hex: string | null, source: string, role: BrandColor['role']) => {
    if (!hex) return;
    const existing = colorMap.get(hex);
    if (existing) {
      existing.occurrences += 1;
      if (existing.role === 'other' && role !== 'other') {
        existing.role = role;
        existing.source = source;
      }
    } else {
      colorMap.set(hex, { hex, source, role, occurrences: 1 });
    }
  };
  const roleOf = (name: string): BrandColor['role'] => {
    const n = name.toLowerCase();
    if (/primary|brand|main|principal/.test(n)) return 'primary';
    if (/secondary|secundari/.test(n)) return 'secondary';
    if (/accent|highlight|destaque/.test(n)) return 'accent';
    if (/background|^bg|surface|fundo/.test(n)) return 'background';
    if (/text|foreground|^fg|texto/.test(n)) return 'text';
    return 'other';
  };
  let styleFiles = 0;
  for (const f of files) {
    if (STYLE_EXT.test(f.rel) && styleFiles < 300) {
      styleFiles++;
      const text = readText(f.abs);
      let hit = false;
      for (const m of text.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g)) {
        addColor(normHex(m[2]), `--${m[1]} em ${f.rel}`, roleOf(m[1]));
        hit = true;
      }
      for (const m of text.matchAll(/\$([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g)) {
        addColor(normHex(m[2]), `$${m[1]} em ${f.rel}`, roleOf(m[1]));
        hit = true;
      }
      if (hit) sourceFiles.add(f.rel);
    } else if (
      /(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/.test(f.rel) ||
      /(^|\/)(theme|colors|tokens)\.(ts|js|json)$/.test(f.rel)
    ) {
      const text = readText(f.abs);
      let hit = false;
      for (const m of text.matchAll(/['"]?([\w-]+)['"]?\s*:\s*['"](#[0-9a-fA-F]{3,6})['"]/g)) {
        addColor(normHex(m[2]), `${m[1]} em ${f.rel}`, roleOf(m[1]));
        hit = true;
      }
      if (hit) sourceFiles.add(f.rel);
    }
  }
  for (const t of themeColors) addColor(t.hex, t.source, 'primary');
  const roleRank: Record<BrandColor['role'], number> = {
    primary: 0,
    accent: 1,
    secondary: 2,
    background: 3,
    text: 4,
    other: 5,
  };
  const colors = [...colorMap.values()]
    .filter((c) => c.role !== 'other' || c.occurrences > 1)
    .sort((a, b) => roleRank[a.role] - roleRank[b.role] || b.occurrences - a.occurrences)
    .slice(0, 16);

  // ── Fonts ───────────────────────────────────────────────────────────────
  const fonts = new Map<string, string>();
  const generic =
    /^(sans-serif|serif|monospace|system-ui|inherit|initial|cursive|fantasy|-apple-system|blinkmacsystemfont|ui-sans-serif|ui-serif|ui-monospace|var\()/i;
  for (const f of files) {
    if (!(STYLE_EXT.test(f.rel) || /\.(tsx?|jsx?|html)$/.test(f.rel))) continue;
    if (f.size > MAX_TEXT_BYTES) continue;
    const text = readText(f.abs);
    if (!text.includes('font') && !text.includes('Font')) continue;
    for (const m of text.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
      const fam = m[1].split(',')[0].trim().replace(/['"]/g, '');
      if (fam && !generic.test(fam) && fam.length < 60 && !fonts.has(fam)) fonts.set(fam, f.rel);
    }
    for (const m of text.matchAll(/fonts\.googleapis\.com\/css2?\?family=([A-Za-z0-9+]+)/g)) {
      const fam = m[1].replace(/\+/g, ' ');
      if (!fonts.has(fam)) fonts.set(fam, f.rel);
    }
    for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]next\/font\/google['"]/g)) {
      for (const name of m[1].split(',')) {
        const fam = name
          .trim()
          .split(/\s+as\s+/)[0]
          .replace(/_/g, ' ');
        if (fam && !fonts.has(fam)) fonts.set(fam, f.rel);
      }
    }
    if (fonts.size >= 12) break;
  }

  const logoCandidates = candidates
    .filter((c) => c.kind !== 'screenshot' && c.kind !== 'image')
    .slice(0, 12);
  const screenshots = candidates.filter((c) => c.kind === 'screenshot').slice(0, 20);
  const primary = colors.find((c) => c.role === 'primary')?.hex ?? colors[0]?.hex;
  const accent = colors.find((c) => c.role === 'accent' || c.role === 'secondary')?.hex;
  return {
    logoCandidates: [...logoCandidates, ...screenshots].slice(0, 40),
    selectedLogoPath: logoCandidates[0]?.path,
    selectedByUser: false,
    colors,
    fonts: [...fonts.entries()].slice(0, 12).map(([family, source]) => ({ family, source })),
    sourceFiles: [...sourceFiles].slice(0, 100),
    theme: { primary, accent },
  };
}

/**
 * ProjectBrandingEngine — runs the extractor against a read-only mirror of
 * the repository, caches the result by commit SHA, stores the top logo files
 * in the asset cache, and preserves the user's explicit logo choice across
 * refreshes.
 */
export class ProjectBrandingEngine {
  constructor(private readonly assets: ProjectAssetCache) {}

  build(
    project: Project,
    mirrorPath: string,
    commitSha: string,
    previous?: ProjectBranding,
  ): ProjectBranding {
    if (previous && previous.commitSha === commitSha && previous.status === 'ok') {
      return previous; // cache hit: nothing changed in the repo
    }
    try {
      const extracted = extractBrand(mirrorPath, project.name);
      let stored = 0;
      for (const c of extracted.logoCandidates) {
        if (stored >= 24) break;
        try {
          c.assetId = this.assets.put(fs.readFileSync(path.join(mirrorPath, c.path)), c.mime);
          stored++;
        } catch {
          // unsupported or corrupt image: keep the candidate without a preview
        }
      }
      const keepChoice =
        previous?.selectedByUser &&
        extracted.logoCandidates.some((c) => c.path === previous.selectedLogoPath);
      const hasAnything = extracted.logoCandidates.length > 0 || extracted.colors.length > 0;
      return {
        projectId: project.id,
        commitSha,
        extractedAt: nowIso(),
        ...extracted,
        selectedLogoPath: keepChoice ? previous!.selectedLogoPath : extracted.selectedLogoPath,
        selectedByUser: Boolean(keepChoice),
        status: hasAnything ? 'ok' : 'empty',
      };
    } catch (err) {
      return {
        projectId: project.id,
        commitSha,
        extractedAt: nowIso(),
        logoCandidates: [],
        selectedByUser: false,
        colors: [],
        fonts: [],
        sourceFiles: [],
        theme: {},
        status: 'error',
        error: (err as Error).message,
      };
    }
  }
}
