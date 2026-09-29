// Flags service — server-side reads. Components import from here, never from repo.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { isFlagActive } from './evaluate';
import type { FlagContext, FlagKey, FlagRow } from './types';

const CACHE_TTL_MS = 60_000;
let cache: { flags: FlagRow[]; fetchedAt: number } | null = null;

// Process-local, best-effort cache: fine for a pilot-scale app on a handful of warm serverless
// instances (feature_flags changes rarely, via admin toggles), not a distributed cache.
async function getFlags(supabase: Client): Promise<FlagRow[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.flags;
  const flags = await repo.listFlags(supabase);
  cache = { flags, fetchedAt: now };
  return flags;
}

/** Server-side helper: `if (await isFlagEnabled(supabase, 'ai_scan', { userId, plan })) ...`. */
export async function isFlagEnabled(
  supabase: Client,
  key: FlagKey,
  ctx: FlagContext = {}
): Promise<boolean> {
  const flags = await getFlags(supabase);
  const flag = flags.find((f) => f.key === key);
  if (!flag) return false; // unseeded/unknown flag defaults OFF (D-018 kill-switch philosophy)
  return isFlagActive(flag, ctx);
}

/** Every flag's resolved on/off state for `ctx`, for handing to <FlagsProvider> once per request. */
export async function getAllFlagStates(
  supabase: Client,
  ctx: FlagContext = {}
): Promise<Record<string, boolean>> {
  const flags = await getFlags(supabase);
  return Object.fromEntries(flags.map((f) => [f.key, isFlagActive(f, ctx)]));
}

export { FLAG_KEYS } from './types';
