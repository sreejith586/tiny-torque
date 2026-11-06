// The ONLY file in this module that talks to Supabase (D-007). admin_search_users is a definer
// RPC that re-checks is_admin() itself — this is a second layer, not the real gate (that's the
// RPC + /admin route guards, src/proxy.ts and src/app/admin/layout.tsx).
import type { Client } from '@/lib/supabase/types';
import type { AdminProfileRow, EarnFreezeRow, EconomySummaryRow, EconomyWeeklyRow } from './types';

export async function searchUsers(
  supabase: Client,
  query: string,
  limit = 20
): Promise<AdminProfileRow[]> {
  const { data, error } = await supabase.rpc('admin_search_users', {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AdminProfileRow[];
}

/** `days` null/0 unsuspends; a positive number sets suspended_until that many days out. */
export async function setSuspension(
  supabase: Client,
  userId: string,
  days: number | null
): Promise<AdminProfileRow> {
  const { data, error } = await supabase.rpc('admin_set_suspension', {
    p_user_id: userId,
    p_days: days ?? undefined,
  });
  if (error) throw error;
  return data as unknown as AdminProfileRow;
}

// ---------- Collectors World economy + earn freeze (MV-W05-05/06, F-28) ----------
// Every function below is a definer RPC that re-checks is_admin() (or the service role) itself.

export async function listEarnFreezes(supabase: Client): Promise<EarnFreezeRow[]> {
  const { data, error } = await supabase
    .from('world_earn_freezes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Freeze (true) / unfreeze (false) one user's earning; logged as user.earn_frozen / unfrozen. */
export async function setEarnFreeze(
  supabase: Client,
  userId: string,
  frozen: boolean,
  note?: string | null
): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_set_earn_freeze', {
    p_user: userId,
    p_frozen: frozen,
    p_note: note ?? undefined,
  });
  if (error) throw error;
  return data ?? frozen;
}

export async function getEconomyWeekly(supabase: Client, weeks = 8): Promise<EconomyWeeklyRow[]> {
  const { data, error } = await supabase.rpc('world_economy_weekly', { p_weeks: weeks });
  if (error) throw error;
  return data ?? [];
}

export async function getEconomySummary(supabase: Client): Promise<EconomySummaryRow[]> {
  const { data, error } = await supabase.rpc('world_economy_summary');
  if (error) throw error;
  return data ?? [];
}
