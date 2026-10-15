import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { canAccessProject, extractBearer, TokenRegistry } from '../src/auth.js';
import { RateLimiter } from '../src/rateLimit.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agency-auth-'));

describe('TokenRegistry', () => {
  it('stores only hashes, verifies, scopes projects and revokes', () => {
    const dir = tmp();
    const reg = new TokenRegistry(dir);
    const { token, record } = reg.create({
      name: 'tablet',
      scopes: ['app'],
      projects: ['flydelivery'],
    });
    expect(token.startsWith('pa_')).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'tokens.json'), 'utf8')).not.toContain(token);
    const p = reg.verify(token)!;
    expect(p.scopes).toEqual(['app']);
    expect(canAccessProject(p, 'flydelivery')).toBe(true);
    expect(canAccessProject(p, 'conectfly')).toBe(false);
    expect(reg.verify(token + 'x')).toBeNull();
    expect(reg.revoke(record.id)).toBe(true);
    expect(reg.verify(token)).toBeNull();
    // persisted across instances
    expect(new TokenRegistry(dir).verify(token)).toBeNull();
  });

  it('bootstraps the env admin token once', () => {
    const dir = tmp();
    new TokenRegistry(dir, 'bootstrap-admin-token-xyz');
    const reg = new TokenRegistry(dir, 'bootstrap-admin-token-xyz');
    expect(reg.list()).toHaveLength(1);
    expect(reg.verify('bootstrap-admin-token-xyz')?.scopes).toContain('admin');
  });

  it('parses bearer headers strictly', () => {
    expect(extractBearer('Bearer abc')).toBe('abc');
    expect(extractBearer('Basic abc')).toBeUndefined();
    expect(extractBearer(undefined)).toBeUndefined();
  });
});

describe('RateLimiter', () => {
  it('allows a burst then refills over time', () => {
    const rl = new RateLimiter(60, 3);
    const t0 = 1_000_000;
    expect([1, 2, 3].map(() => rl.take('k', 1, t0))).toEqual([true, true, true]);
    expect(rl.take('k', 1, t0)).toBe(false);
    expect(rl.take('k', 1, t0 + 1_000)).toBe(true); // 60/min = 1/s
    expect(rl.take('other', 1, t0)).toBe(true);
  });
});
