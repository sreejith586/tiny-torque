// Fixed-window request limiter for route handlers (MV-W01-07). Process-local, best-effort — the
// same scope as domain/flags' cache: fine for pilot-scale traffic on a handful of warm serverless
// instances, not a distributed limiter. DB-side rate limits (triggers, 07 §6.6) remain the real
// backstop for writes; this just keeps a misbehaving client from hammering a read endpoint.

const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();
let sweepAt = 0;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit = 60,
  windowMs = WINDOW_MS,
  now = Date.now()
): RateLimitResult {
  if (now > sweepAt) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    sweepAt = now + windowMs;
  }
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  const ok = b.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - b.count),
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

/** Best-effort caller identity for an unauthenticated request (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip'))?.trim() || 'unknown';
}

/** Test hook. */
export function _resetRateLimits() {
  buckets.clear();
  sweepAt = 0;
}
