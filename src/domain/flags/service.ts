// Flags service — server-side reads (+ the admin editor's write). Components import from here,
// never from repo.
import type { Client } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import * as repo from './repo';
import { isFlagActive } from './evaluate';
import { updateFlagSchema } from './schema';
import type { FlagAdminRow, FlagContext, FlagKey, FlagRow } from './types';

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

/** /admin flags editor (F-16, MV-W01-09). Uncached: the editor must show the stored truth. */
export const listFlagsForAdmin = repo.listFlagsForAdmin;

/** Admin toggle + audience edit. RLS is the backstop (admin-only update policy); the event is the
 *  audit trail (D-009) — flipping a kill switch is a deliberate, logged act. */
export async function updateFlag(
  supabase: Client,
  adminId: string,
  input: unknown
): Promise<FlagAdminRow> {
  const v = updateFlagSchema.parse(input);
  const row = await repo.updateFlag(supabase, adminId, v.key, {
    enabled: v.enabled,
    audience: v.audience,
  });
  cache = null; // this instance sees the change immediately; others within CACHE_TTL_MS
  await emitEvent(supabase, {
    actorId: adminId,
    type: 'flag.updated',
    entity: 'flag',
    payload: { key: v.key, enabled: v.enabled, audience: v.audience },
  });
  return row;
}

export { FLAG_KEYS, FLAG_GROUPS, WORLD_FLAG_KEYS, CORE_FLAG_KEYS } from './types';
export type { FlagAdminRow, FlagAudience, FlagKey } from './types';
export { updateFlagSchema, flagAudienceSchema } from './schema';
