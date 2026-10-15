/**
 * Claude Code statusline command that ALSO reports the official subscription
 * limits (`rate_limits.five_hour|seven_day`) to PIXEL AGENCY.
 *
 * ~/.claude/settings.json:
 *   { "statusLine": { "type": "command", "command": "node /caminho/pixel-agency-statusline.js" } }
 * Env: AGENCY_URL, AGENCY_BRIDGE_TOKEN.
 *
 * Only `rate_limits`, `model` and `cost` are sent — never the workspace path,
 * transcript or prompt content.
 */
import { formatCountdown } from '@pixel-agency/shared';

interface StatuslineInput {
  model?: { display_name?: string };
  rate_limits?: Record<string, { used_percentage?: number; resets_at?: number }>;
  cost?: { total_cost_usd?: number };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export function renderLine(input: StatuslineInput, now = Date.now()): string {
  const parts = ['PIXEL AGENCY'];
  if (input.model?.display_name) parts.push(input.model.display_name);
  const fh = input.rate_limits?.five_hour;
  const sd = input.rate_limits?.seven_day;
  const reset = (s?: number) => (s ? formatCountdown(new Date(s * 1000).toISOString(), now) : '');
  if (fh?.used_percentage !== undefined) {
    const r = reset(fh.resets_at);
    parts.push(`sessão ${Math.round(fh.used_percentage)}%${r ? ` (${r})` : ''}`);
  }
  if (sd?.used_percentage !== undefined) parts.push(`semana ${Math.round(sd.used_percentage)}%`);
  return parts.join(' · ');
}

async function main(): Promise<void> {
  const raw = await readStdin();
  let input: StatuslineInput = {};
  try {
    input = JSON.parse(raw) as StatuslineInput;
  } catch {
    // keep defaults
  }
  process.stdout.write(renderLine(input) + '\n');
  const url = process.env.AGENCY_URL;
  const token = process.env.AGENCY_BRIDGE_TOKEN;
  if (!url || !token || !input.rate_limits) return;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 1500);
  try {
    await fetch(new URL('/api/bridge/statusline', url), {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rate_limits: input.rate_limits,
        model: input.model,
        cost: input.cost,
      }),
    });
  } catch {
    // never break the user's statusline
  } finally {
    clearTimeout(t);
  }
}

if (process.argv[1] && /statusline\.(ts|js)$/.test(process.argv[1])) void main();
