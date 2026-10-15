import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/gif': 'gif',
};

export const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  gif: 'image/gif',
};

const ASSET_ID = /^[a-f0-9]{40}\.(png|jpg|webp|svg|ico|gif)$/;

/** Check the leading bytes really match the declared image type. */
export function sniffImage(buf: Buffer, mime: string): boolean {
  switch (mime) {
    case 'image/png':
      return buf
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/webp':
      return (
        buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
        buf.subarray(8, 12).toString('latin1') === 'WEBP'
      );
    case 'image/gif':
      return buf.subarray(0, 4).toString('latin1') === 'GIF8';
    case 'image/svg+xml': {
      const head = buf.subarray(0, 2048).toString('utf8');
      return /<svg[\s>]/i.test(head);
    }
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return buf[0] === 0 && buf[1] === 0 && (buf[2] === 1 || buf[2] === 2);
    default:
      return false;
  }
}

/** PNG width/height from the IHDR chunk (no decoder needed). */
export function pngSize(buf: Buffer): { width: number; height: number } | undefined {
  if (buf.length < 24 || !sniffImage(buf, 'image/png')) return undefined;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * ProjectAssetCache — content-addressed store for project images (logos,
 * screenshots, uploads). The same file extracted twice is stored once, and
 * re-extraction of an unchanged repo is free.
 *
 * Images are served only through short-lived HMAC-signed URLs, so the web
 * build can use plain <img src> without exposing the API token. SVGs are
 * served with a CSP that disables scripts.
 */
export class ProjectAssetCache {
  private readonly dir: string;

  constructor(
    dataDir: string,
    private readonly signingKey: string,
  ) {
    this.dir = path.join(dataDir, 'assets');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  put(buf: Buffer, mime: string): string {
    const ext = EXT_BY_MIME[mime];
    if (!ext) throw new Error(`Tipo de imagem não suportado: ${mime}`);
    if (!sniffImage(buf, mime))
      throw new Error('Conteúdo não corresponde ao tipo de imagem declarado');
    const id = `${createHash('sha1').update(buf).digest('hex')}.${ext}`;
    const file = path.join(this.dir, id);
    if (!fs.existsSync(file)) fs.writeFileSync(file, buf, { mode: 0o600 });
    return id;
  }

  read(id: string): { buf: Buffer; mime: string } | null {
    if (!ASSET_ID.test(id)) return null;
    try {
      const buf = fs.readFileSync(path.join(this.dir, id));
      return { buf, mime: MIME_BY_EXT[id.split('.').pop()!] };
    } catch {
      return null;
    }
  }

  private sig(id: string, exp: number): string {
    return createHmac('sha256', this.signingKey).update(`${id}:${exp}`).digest('base64url');
  }

  /** Relative signed URL, valid for `ttlSec` (default 24 h). */
  signedPath(id: string, ttlSec = 86_400, now = Date.now()): string {
    const exp = Math.floor(now / 1000) + ttlSec;
    return `/api/assets/${id}?exp=${exp}&sig=${this.sig(id, exp)}`;
  }

  verify(id: string, exp: string | undefined, sig: string | undefined, now = Date.now()): boolean {
    if (!exp || !sig) return false;
    const e = Number(exp);
    if (!Number.isFinite(e) || e * 1000 < now) return false;
    const expected = Buffer.from(this.sig(id, e));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
