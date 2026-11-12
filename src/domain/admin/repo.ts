// The ONLY file in this module that talks to Supabase (D-007). admin_search_users is a definer
// RPC that re-checks is_admin() itself — this is a second layer, not the real gate (that's the
// RPC + /admin route guards, src/proxy.ts and src/app/admin/layout.tsx).
import type { Client } from '@/lib/supabase/types';
import type {
  AdminProfileRow,
  EarnFreezeRow,
  HostSuspensionAction,
  HostSuspensionRow,
  EconomySummaryRow,
  EconomyWeeklyRow,
  JobRunRow,
} from './types';

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

/** Hosting suspensions, newest first (admin-read RLS; in force = lifted_at null). */
export async function listHostSuspensions(
  supabase: Client,
  limit = 50
): Promise<HostSuspensionRow[]> {
  const { data, error } = await supabase
    .from('world_host_suspensions')
    .select('*')
    .order('suspended_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** suspend / lift / note through admin_set_host_suspension (events + notification in the DB). */
export async function setHostSuspension(
  supabase: Client,
  userId: string,
  action: HostSuspensionAction,
  note?: string | null
): Promise<HostSuspensionRow> {
  const { data, error } = await supabase.rpc('admin_set_host_suspension', {
    p_user: userId,
    p_action: action,
    p_note: note ?? undefined,
  });
  if (error) throw error;
  return data as unknown as HostSuspensionRow;
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

// ---------- scheduled jobs log (MV-W04-04, F-26 / 06 §5) ----------
/** Newest first. RLS: admins only (job_runs has no write policy — run_world_job is the writer). */
export async function listJobRuns(supabase: Client, limit = 50): Promise<JobRunRow[]> {
  const { data, error } = await supabase
    .from('job_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
