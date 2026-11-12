// Admin console service (MV-S6-07, F-16). Components/routes import from here, never from repo.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import type { EconomyWeeklyRow, EconomyWeekRatios, JobHealthRow, JobRunRow } from './types';

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

export type {
  EarnFreezeRow,
  EconomyWeeklyRow,
  EconomySummaryRow,
  EconomyWeekRatios,
  JobRunRow,
  JobHealthRow,
} from './types';
