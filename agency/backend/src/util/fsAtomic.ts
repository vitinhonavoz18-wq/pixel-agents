import * as fs from 'node:fs';
import * as path from 'node:path';

/** Write via tmp + rename so a crash never leaves a half-written file. */
export function writeFileAtomic(file: string, data: string | Buffer, mode = 0o600): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data, { mode });
  fs.renameSync(tmp, file);
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** Resolve `rel` under `root`, refusing anything that escapes it. */
export function safeJoin(root: string, rel: string): string {
  const resolved = path.resolve(root, rel);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new Error(`Path escapes root: ${rel}`);
  }
  return resolved;
}
