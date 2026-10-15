import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as path from 'node:path';

import { readJson, writeFileAtomic } from './util/fsAtomic.js';
import { newId, nowIso } from './util/ids.js';

export type Scope = 'admin' | 'app' | 'bridge';

export interface ApiToken {
  id: string;
  name: string;
  /** sha256(token) — the plaintext is shown once at creation, never stored. */
  hash: string;
  scopes: Scope[];
  /** Project ids this token may operate on, or '*' for all. */
  projects: string[] | '*';
  revoked: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

export interface Principal {
  tokenId: string;
  name: string;
  scopes: Scope[];
  projects: string[] | '*';
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Bearer-token registry with scopes, per-project authorization and
 * revocation. Tokens are random 32-byte secrets ("pa_…"), stored hashed.
 */
export class TokenRegistry {
  private tokens: ApiToken[];
  private readonly file: string;

  constructor(dataDir: string, bootstrapAdminToken?: string) {
    this.file = path.join(dataDir, 'tokens.json');
    this.tokens = readJson<ApiToken[]>(this.file, []);
    if (bootstrapAdminToken) {
      const hash = sha256(bootstrapAdminToken);
      if (!this.tokens.some((t) => t.hash === hash)) {
        this.tokens.push({
          id: 'bootstrap-admin',
          name: 'AGENCY_ADMIN_TOKEN',
          hash,
          scopes: ['admin', 'app'],
          projects: '*',
          revoked: false,
          createdAt: nowIso(),
        });
        this.save();
      }
    }
  }

  private save(): void {
    writeFileAtomic(this.file, JSON.stringify(this.tokens, null, 1));
  }

  /** Constant-time lookup of a presented token. */
  verify(presented: string | undefined): Principal | null {
    if (!presented || presented.length < 16 || presented.length > 200) return null;
    const hash = Buffer.from(sha256(presented), 'hex');
    for (const t of this.tokens) {
      const candidate = Buffer.from(t.hash, 'hex');
      if (candidate.length === hash.length && timingSafeEqual(candidate, hash)) {
        if (t.revoked) return null;
        t.lastUsedAt = nowIso();
        return { tokenId: t.id, name: t.name, scopes: t.scopes, projects: t.projects };
      }
    }
    return null;
  }

  create(input: { name: string; scopes: Scope[]; projects: string[] | '*' }): {
    token: string;
    record: ApiToken;
  } {
    const token = `pa_${randomBytes(32).toString('base64url')}`;
    const record: ApiToken = {
      id: newId('tok'),
      name: input.name.slice(0, 80),
      hash: sha256(token),
      scopes: input.scopes,
      projects: input.projects,
      revoked: false,
      createdAt: nowIso(),
    };
    this.tokens.push(record);
    this.save();
    return { token, record };
  }

  revoke(id: string): boolean {
    const t = this.tokens.find((x) => x.id === id);
    if (!t || t.revoked) return false;
    t.revoked = true;
    this.save();
    return true;
  }

  list(): Array<Omit<ApiToken, 'hash'>> {
    return this.tokens.map(({ hash: _hash, ...rest }) => rest);
  }

  count(): number {
    return this.tokens.filter((t) => !t.revoked).length;
  }
}

export function canAccessProject(p: Principal, projectId: string): boolean {
  return p.projects === '*' || p.projects.includes(projectId);
}

export function hasScope(p: Principal, scope: Scope): boolean {
  return p.scopes.includes(scope) || (scope === 'app' && p.scopes.includes('admin'));
}

export function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  return m?.[1];
}
