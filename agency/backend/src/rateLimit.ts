/** Token bucket per key (token id or IP). In-memory; one instance per process. */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; updated: number }>();

  constructor(
    private readonly perMinute: number,
    private readonly burst = Math.max(10, Math.ceil(perMinute / 4)),
  ) {}

  take(key: string, cost = 1, now = Date.now()): boolean {
    const b = this.buckets.get(key) ?? { tokens: this.burst, updated: now };
    const refill = ((now - b.updated) / 60_000) * this.perMinute;
    b.tokens = Math.min(this.burst, b.tokens + refill);
    b.updated = now;
    if (b.tokens < cost) {
      this.buckets.set(key, b);
      return false;
    }
    b.tokens -= cost;
    this.buckets.set(key, b);
    if (this.buckets.size > 10_000) this.gc(now);
    return true;
  }

  private gc(now: number): void {
    for (const [k, b] of this.buckets) if (now - b.updated > 10 * 60_000) this.buckets.delete(k);
  }
}
