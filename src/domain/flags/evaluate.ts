// Pure audience-evaluation logic — no Supabase, unit-testable in isolation.
import type { FlagAudience, FlagContext, FlagRow } from './types';

/** Deterministic 0-99 bucket for a string, so the same user always lands in the same percent slice. */
export function stableBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // keep it a 32-bit int
  }
  return Math.abs(hash) % 100;
}

/**
 * `user_ids` is an allowlist override: a listed user always matches, regardless of the other
 * clauses. Every other specified dimension (plans, countries, percent) must match (AND) — a
 * dimension left out of the audience entirely doesn't filter on it. An empty audience matches
 * everyone once the flag is `enabled`.
 */
export function isInAudience(audience: FlagAudience, ctx: FlagContext): boolean {
  if (audience.user_ids?.length && ctx.userId && audience.user_ids.includes(ctx.userId)) {
    return true;
  }
  if (audience.plans?.length && (!ctx.plan || !audience.plans.includes(ctx.plan))) {
    return false;
  }
  if (
    audience.countries?.length &&
    (!ctx.countryCode || !audience.countries.includes(ctx.countryCode))
  ) {
    return false;
  }
  if (typeof audience.percent === 'number') {
    // No stable identity to bucket on (e.g. a pre-auth context) -> fail closed.
    if (!ctx.userId || stableBucket(ctx.userId) >= audience.percent) return false;
  }
  return true;
}

/** `enabled` is the hard kill switch; audience only narrows an already-enabled flag. */
export function isFlagActive(
  flag: Pick<FlagRow, 'enabled' | 'audience'>,
  ctx: FlagContext = {}
): boolean {
  if (!flag.enabled) return false;
  return isInAudience(flag.audience ?? {}, ctx);
}
