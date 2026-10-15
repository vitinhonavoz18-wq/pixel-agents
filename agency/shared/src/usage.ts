import type { SubscriptionLimits, UsageTotals } from './schemas';

export const EMPTY_USAGE: UsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0,
};

export function addUsage(a: UsageTotals, b: Partial<UsageTotals>): UsageTotals {
  return {
    inputTokens: a.inputTokens + (b.inputTokens ?? 0),
    outputTokens: a.outputTokens + (b.outputTokens ?? 0),
    cacheReadTokens: a.cacheReadTokens + (b.cacheReadTokens ?? 0),
    cacheCreationTokens: a.cacheCreationTokens + (b.cacheCreationTokens ?? 0),
    costUsd: Math.round((a.costUsd + (b.costUsd ?? 0)) * 1e6) / 1e6,
  };
}

export function totalTokens(u: UsageTotals): number {
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheCreationTokens;
}

/** "1,2 mi" / "34,5 mil" / "812" — compact pt-BR token counts. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')} mil`;
  return String(n);
}

export function formatUsd(n: number): string {
  return `US$ ${n.toFixed(n < 1 ? 4 : 2).replace('.', ',')}`;
}

/** "2 h 42 min" until `iso`, or "agora". */
export function formatCountdown(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const ms = Date.parse(iso) - now;
  if (!Number.isFinite(ms)) return '—';
  if (ms <= 0) return 'agora';
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export const LIMITS_UNAVAILABLE_TEXT = 'Dados de limite indisponíveis nesta integração.';

/**
 * Build `SubscriptionLimits` from the JSON Claude Code passes to a statusline
 * command (documented field `rate_limits.five_hour|seven_day` with
 * `used_percentage` 0-100 and `resets_at` in Unix epoch seconds). Returns
 * unavailable when the object is absent (API-key users, or before the
 * session's first response).
 */
export function limitsFromStatusline(statusline: unknown, observedAt: string): SubscriptionLimits {
  const rl = (statusline as { rate_limits?: Record<string, unknown> } | null)?.rate_limits;
  if (!rl || typeof rl !== 'object') {
    return {
      available: false,
      reason:
        'O Claude Code não informou rate_limits (só existe para assinantes Pro/Max após a primeira resposta da sessão).',
    };
  }
  const win = (v: unknown) => {
    const w = v as { used_percentage?: unknown; resets_at?: unknown } | undefined;
    if (!w || typeof w.used_percentage !== 'number') return undefined;
    const usedPercent = Math.max(0, Math.min(100, w.used_percentage));
    const resetsAt =
      typeof w.resets_at === 'number' ? new Date(w.resets_at * 1000).toISOString() : undefined;
    return { usedPercent, resetsAt };
  };
  const session = win(rl.five_hour);
  const weekly = win(rl.seven_day);
  if (!session && !weekly) {
    return { available: false, reason: 'rate_limits presente, mas sem janelas reconhecidas.' };
  }
  return { available: true, source: 'claude_code_statusline', observedAt, session, weekly };
}
