/** Sliding-window rate limiter keyed by e.g. IP. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {
    // Drop idle keys so the map doesn't grow forever.
    setInterval(() => {
      for (const key of this.hits.keys()) this.recent(key);
    }, windowMs).unref();
  }

  private recent(key: string): number[] {
    const cutoff = Date.now() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  allowed(key: string): boolean {
    return this.recent(key).length < this.limit;
  }

  record(key: string): void {
    const list = this.recent(key);
    list.push(Date.now());
    this.hits.set(key, list);
  }

  /** Record a hit and report whether it was within the limit. */
  take(key: string): boolean {
    const ok = this.allowed(key);
    this.record(key);
    return ok;
  }
}
