// Admin console service (MV-S6-07, F-16). Components/routes import from here, never from repo.
import type { Client } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import * as repo from './repo';
import { createInvitesSchema } from './schema';
import type {
  AdminOverviewRow,
  EconomyWeeklyRow,
  EconomyWeekRatios,
  InviteCohortSummary,
  InviteRow,
  JobHealthRow,
  JobRunRow,
  OverviewCosts,
  PilotKpiRatios,
  PilotKpiRow,
  RevenueByCurrency,
} from './types';

export async function searchUsers(supabase: Client, query: string, limit = 20) {
  return repo.searchUsers(supabase, query.trim(), limit);
}

export const setSuspension = repo.setSuspension;

// ---------- Collectors World economy dashboard + earn freeze (MV-W05-05/06, F-28) ----------
export const listEarnFreezes = repo.listEarnFreezes;
export const getEconomyWeekly = repo.getEconomyWeekly;
export const getEconomySummary = repo.getEconomySummary;

/** Freeze / unfreeze one user's earning (admin RPC; the audit event is written in the DB). */
export async function setEarnFreeze(
  supabase: Client,
  userId: string,
  frozen: boolean,
  note?: string | null
): Promise<boolean> {
  const trimmed = note?.trim() || null;
  if (trimmed && trimmed.length > 280) throw new Error('note_too_long');
  return repo.setEarnFreeze(supabase, userId, frozen, trimmed);
}

/** 07 §3.4 ratios from one weekly row. Pure; null where the denominator is 0 so a table can show
 *  "—" instead of a fake 0 or ∞. */
export function economyWeekRatios(row: EconomyWeeklyRow): EconomyWeekRatios {
  return {
    sinksOverSources: row.earned > 0 ? round2(row.spent / row.earned) : null,
    earnedShareOfSpend: row.spent > 0 ? round2(row.spent_from_earned / row.spent) : null,
    worldShareOfSpend: row.spent > 0 ? round2(row.world_spent / row.spent) : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- scheduled jobs log (MV-W04-04; 06 §5 "a job_runs row shows an error") ----------
export const listJobRuns = repo.listJobRuns;

/** Pure: the dispatcher's five jobs, in run order, so the health table has a stable row set even
 *  before a job has ever run (03 §3 run_world_job). */
export const WORLD_JOB_NAMES = [
  'quest_reset',
  'earned_expiry_notice',
  'earned_expiry',
  'season_rollover',
  'score_recompute',
] as const;

/** Pure: the H1 housekeeping jobs (MV-S9-01, 03 §3 run_h1_job + the two Edge purges), in run order. */
export const H1_JOB_NAMES = [
  'expire_listings',
  'expire_offers',
  'purge_trash',
  'ensure_event_partitions',
  'purge_media',
  'purge_accounts',
  'refresh_pilot_kpis', // MV-S10-03: nightly pilot_kpis_weekly rebuild (pg_cron pilot_kpis_refresh)
] as const;

/** Every known job, World first then H1 — the "never ran" rows of the admin health table. */
export const KNOWN_JOB_NAMES = [...WORLD_JOB_NAMES, ...H1_JOB_NAMES] as const;

/** Pure: one row per job seen in `runs` (plus the known World jobs that never ran are left out —
 *  the caller shows them as "never ran"), with its newest run and the error count. Order: World
 *  jobs first in dispatcher order, then any other job (S9's) alphabetically. */
export function jobHealth(runs: JobRunRow[]): JobHealthRow[] {
  const byJob = new Map<string, JobHealthRow>();
  for (const r of runs) {
    const cur = byJob.get(r.job);
    if (!cur) {
      byJob.set(r.job, { job: r.job, latest: r, errors: r.status === 'error' ? 1 : 0, runs: 1 });
      continue;
    }
    cur.runs += 1;
    if (r.status === 'error') cur.errors += 1;
    if (Date.parse(r.started_at) > Date.parse(cur.latest.started_at)) cur.latest = r;
  }
  const rank = (job: string) => {
    const i = (KNOWN_JOB_NAMES as readonly string[]).indexOf(job);
    return i === -1 ? KNOWN_JOB_NAMES.length : i;
  };
  return [...byJob.values()].sort((a, b) =>
    rank(a.job) === rank(b.job) ? a.job.localeCompare(b.job) : rank(a.job) - rank(b.job)
  );
}

/** Pure: wall time of a run in whole seconds, or null while it is still running. */
export function jobRunSeconds(run: Pick<JobRunRow, 'started_at' | 'finished_at'>): number | null {
  if (!run.finished_at) return null;
  const ms = Date.parse(run.finished_at) - Date.parse(run.started_at);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : null;
}

/** Pure: a one-line summary of a run's jsonb result for the table ("expired 3 · users 2"). */
export function jobResultSummary(result: JobRunRow['result']): string {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return '';
  return Object.entries(result as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .map(([k, v]) => `${k} ${String(v)}`)
    .join(' · ');
}

// ---------- S10: Overview, pilot KPIs, invites, feedback (MV-S10-03/04/05, F-16 / F-18) ----------
export const getOverview = repo.getOverview;
export const getPilotKpis = repo.getPilotKpis;
export const refreshPilotKpis = repo.refreshPilotKpis;
export const listInvites = repo.listInvites;
export const listFeedback = repo.listFeedback;

/** SMS cost model for the Overview tile — PLACEHOLDERS until a provider invoice exists (D-025 is
 *  still open): OTP texts per phone-active collector per month, and USD per text. */
export const SMS_OTPS_PER_ACTIVE_USER = 2;
export const SMS_UNIT_COST_USD = 0.05;

/** Pure: jsonb `{ "AED": 57 }` → a typed map; anything that is not a finite number is dropped. */
export function revenueByCurrency(value: unknown): RevenueByCurrency {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: RevenueByCurrency = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k.trim().toUpperCase()] = n;
  }
  return out;
}

/** Pure: "AED 57.00 · INR 499.00", or "—" when nothing was sold. Never sums across currencies. */
export function formatRevenue(revenue: RevenueByCurrency): string {
  const parts = Object.entries(revenue)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => `${currency} ${amount.toFixed(2)}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** Pure: the Overview's cost / revenue tiles from the admin_overview() row. */
export function overviewCosts(row: AdminOverviewRow): OverviewCosts {
  return {
    scanCostUsd: Number(row.scan_cost_usd_month) || 0,
    scans: row.scans_month,
    tokenRevenue: revenueByCurrency(row.token_revenue_month),
    tokenPurchases: row.token_purchases_month,
    smsUsers: row.phone_users_active_month,
    smsEstimateUsd: round2(
      row.phone_users_active_month * SMS_OTPS_PER_ACTIVE_USER * SMS_UNIT_COST_USD
    ),
  };
}

function share(numerator: number | null, denominator: number | null): number | null {
  if (!denominator || denominator <= 0) return null;
  return round2((numerator ?? 0) / denominator);
}

/** Pure: the 01 §6 ratios of one weekly row (null where the week has no denominator). */
export function pilotKpiRatios(row: PilotKpiRow): PilotKpiRatios {
  return {
    activation: share(row.activated_7d, row.signups),
    scanShare: share(row.scan_accepted, row.items_added),
    scanAcceptance: share(row.scan_accepted, row.scan_candidates),
    publisherShare: share(row.signups_published, row.signups),
    offersPerListing: share(row.offers_created, row.listings_live),
    tokenConversion: share(row.token_buyers, row.wau),
    retentionW4: share(row.retained_w4, row.signups),
    reportsActionedShare: share(row.reports_actioned, row.listings_live),
  };
}

// No 0/O/1/I/L: codes get read out over WhatsApp and typed on a phone.
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Pure given `random`: `TT-` + 8 characters from the unambiguous alphabet (≈ 40 bits). */
export function generateInviteCode(random: (max: number) => number = secureRandomInt): string {
  let body = '';
  for (let i = 0; i < 8; i += 1) body += INVITE_ALPHABET[random(INVITE_ALPHABET.length)];
  return `TT-${body.slice(0, 4)}-${body.slice(4)}`;
}

function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  // Rejection sampling: no modulo bias.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  let value = limit;
  while (value >= limit) {
    globalThis.crypto.getRandomValues(buf);
    value = buf[0] ?? limit;
  }
  return value % max;
}

/** Pure: can this code still be redeemed at `now`? */
export function isInviteOpen(invite: InviteRow, now: Date = new Date()): boolean {
  if (invite.used_count >= invite.max_uses) return false;
  return !invite.expires_at || new Date(invite.expires_at) > now;
}

/** Pure: one line per cohort (codes without a cohort are grouped as "—"), biggest first. */
export function inviteCohortSummary(
  invites: InviteRow[],
  now: Date = new Date()
): InviteCohortSummary[] {
  const by = new Map<string, InviteCohortSummary>();
  for (const inv of invites) {
    const cohort = inv.cohort?.trim() || '—';
    const cur = by.get(cohort) ?? { cohort, codes: 0, seats: 0, used: 0, open: 0 };
    cur.codes += 1;
    cur.seats += inv.max_uses;
    cur.used += inv.used_count;
    if (isInviteOpen(inv, now)) cur.open += 1;
    by.set(cohort, cur);
  }
  return [...by.values()].sort((a, b) => b.seats - a.seats || a.cohort.localeCompare(b.cohort));
}

/** Mint a batch of invite codes for one cohort (F-16 "Invites (create codes/cohorts)"). RLS is the
 *  gate (admins only); the event is the audit trail (rule 9) — codes themselves stay out of it. */
export async function createInvites(
  supabase: Client,
  adminId: string,
  input: unknown,
  now: Date = new Date()
): Promise<InviteRow[]> {
  const v = createInvitesSchema.parse(input);
  const expiresAt =
    v.expiresInDays && v.expiresInDays > 0
      ? new Date(now.getTime() + v.expiresInDays * 86_400_000).toISOString()
      : null;
  const codes = new Set<string>();
  while (codes.size < v.count) codes.add(generateInviteCode());
  const rows = await repo.insertInvites(
    supabase,
    [...codes].map((code) => ({
      code,
      cohort: v.cohort,
      max_uses: v.maxUses,
      expires_at: expiresAt,
      created_by: adminId,
    }))
  );
  await emitEvent(supabase, {
    actorId: adminId,
    type: 'invite.created',
    entity: 'invite',
    payload: { cohort: v.cohort, count: rows.length, max_uses: v.maxUses, expires_at: expiresAt },
  });
  return rows;
}

/** End one code now. Seats already used stay used. */
export async function expireInvite(
  supabase: Client,
  adminId: string,
  code: string
): Promise<InviteRow> {
  const row = await repo.expireInvite(supabase, code);
  await emitEvent(supabase, {
    actorId: adminId,
    type: 'invite.expired',
    entity: 'invite',
    payload: { cohort: row.cohort, used_count: row.used_count, max_uses: row.max_uses },
  });
  return row;
}

export { createInvitesSchema } from './schema';
export type {
  AdminFeedbackItem,
  AdminOverviewRow,
  InviteCohortSummary,
  InviteRow,
  OverviewCosts,
  PilotKpiRatios,
  PilotKpiRow,
  RevenueByCurrency,
  EarnFreezeRow,
  EconomyWeeklyRow,
  EconomySummaryRow,
  EconomyWeekRatios,
  JobRunRow,
  JobHealthRow,
} from './types';
