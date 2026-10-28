// Shared plumbing for the /api/v1/world/* handlers (MV-W01-07, 07 §6.1, ADR-05). These are the
// seam a future dedicated client would use; the PWA itself calls the domain services directly.
// Same auth as server actions (session cookie → RLS), zod on params, flag-gated (404 while
// `world` is off: nothing World-facing is reachable dark, D-028), rate-limited per caller.
import { NextResponse } from 'next/server';
import { WorldError } from '@/domain/world';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

export function apiError(code: string, status: number) {
  return json({ error: code }, status);
}

/** 429 when the caller (user id, else IP) exceeds `limit` requests per minute on `scope`. */
export function enforceRateLimit(req: Request, scope: string, userId: string | null, limit = 60) {
  const rl = rateLimit(`${scope}:${userId ?? clientIp(req)}`, limit);
  return rl.ok
    ? null
    : json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfterSec) });
}

const WORLD_ERROR_STATUS: Partial<Record<WorldError['code'], number>> = {
  not_authorized: 401,
  garage_not_found: 404,
  item_not_found: 404,
  insufficient_balance: 402,
};

export function handleWorldError(e: unknown) {
  if (e instanceof WorldError) return apiError(e.code, WORLD_ERROR_STATUS[e.code] ?? 409);
  throw e;
}
