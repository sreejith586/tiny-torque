// The ONLY file in this module that talks to Supabase (D-007). admin_search_users is a definer
// RPC that re-checks is_admin() itself — this is a second layer, not the real gate (that's the
// RPC + /admin route guards, src/proxy.ts and src/app/admin/layout.tsx).
import type { Client } from '@/lib/supabase/types';
import type {
  AdminFeedbackItem,
  AdminOverviewRow,
  AdminProfileRow,
  EarnFreezeRow,
  HostSuspensionAction,
  HostSuspensionRow,
  EconomySummaryRow,
  EconomyWeeklyRow,
  InviteRow,
  JobRunRow,
  PilotKpiRow,
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

// ---------- S10: Overview, pilot KPIs, invites, feedback (MV-S10-03/04/05) ----------
/** admin_overview() — one row; the RPC re-checks is_admin(). */
export async function getOverview(supabase: Client): Promise<AdminOverviewRow | null> {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Newest week first. The materialised view itself is not API-readable; this RPC is the door. */
export async function getPilotKpis(supabase: Client, weeks = 12): Promise<PilotKpiRow[]> {
  const { data, error } = await supabase.rpc('admin_pilot_kpis', { p_weeks: weeks });
  if (error) throw error;
  return data ?? [];
}

/** Rebuilds pilot_kpis_weekly now; returns the job_runs row it logged. */
export async function refreshPilotKpis(supabase: Client): Promise<JobRunRow> {
  const { data, error } = await supabase.rpc('refresh_pilot_kpis');
  if (error) throw error;
  return data as JobRunRow;
}

/** RLS: "Admins manage invites" (identity_v2) — a non-admin reads nothing. */
export async function listInvites(supabase: Client, limit = 500): Promise<InviteRow[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function insertInvites(
  supabase: Client,
  rows: Array<Pick<InviteRow, 'code' | 'cohort' | 'max_uses' | 'expires_at' | 'created_by'>>
): Promise<InviteRow[]> {
  const { data, error } = await supabase.from('invites').insert(rows).select('*');
  if (error) throw error;
  return data ?? [];
}

/** Ends a code now (expires_at = now). used_count is never touched here — redeem_invite owns it. */
export async function expireInvite(supabase: Client, code: string): Promise<InviteRow> {
  const { data, error } = await supabase
    .from('invites')
    .update({ expires_at: new Date().toISOString() })
    .eq('code', code)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Newest first, with the submitter's handle from public_profiles (never the profiles row). */
export async function listFeedback(supabase: Client, limit = 100): Promise<AdminFeedbackItem[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const who = new Map<string, { handle: string | null; display_name: string | null }>();
  if (ids.length > 0) {
    const { data: people, error: peopleError } = await supabase
      .from('public_profiles')
      .select('id, handle, display_name')
      .in('id', ids);
    if (peopleError) throw peopleError;
    for (const p of people ?? []) {
      if (p.id) who.set(p.id, { handle: p.handle, display_name: p.display_name });
    }
  }
  return rows.map((r) => ({
    ...r,
    handle: who.get(r.user_id)?.handle ?? null,
    display_name: who.get(r.user_id)?.display_name ?? null,
  }));
}
