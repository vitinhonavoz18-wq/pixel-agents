import { randomBytes } from 'node:crypto';

/** Short, URL-safe, sortable-ish id: `<prefix>_<time36><rand>`. */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(5).toString('hex')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
