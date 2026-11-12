import type { Database, Tables } from '@/lib/supabase/types';

export type AdminProfileRow = Tables<'profiles'>;
export type EarnFreezeRow = Tables<'world_earn_freezes'>;
/** One hosting suspension (world_host_suspensions, MV-W07-05) — automatic at two upheld reports or
 *  set by an admin; `lifted_at` null = in force. */
export type HostSuspensionRow = Tables<'world_host_suspensions'>;
export type HostSuspensionAction = 'suspend' | 'lift' | 'note';
/** One scheduled-job run (job_runs, 03 §2.42) — written only by run_world_job (MV-W04-04). */
export type JobRunRow = Tables<'job_runs'>;

/** One UTC week of the economy (world_economy_weekly, 07 §3.4) — plain integers over the ledger. */
export type EconomyWeeklyRow =
  Database['public']['Functions']['world_economy_weekly']['Returns'][number];
/** One point-in-time metric row (world_economy_summary). */
export type EconomySummaryRow =
  Database['public']['Functions']['world_economy_summary']['Returns'][number];

/** Derived ratios for a weekly row (07 §3.4): sinks ÷ sources and the earned share of spend. */
export interface EconomyWeekRatios {
  /** Σ spend ÷ Σ earned credits; null when nothing was earned (target > 1.2 for active users). */
  sinksOverSources: number | null;
  /** consumed_earned ÷ spend, 0–1; null when nothing was spent. */
  earnedShareOfSpend: number | null;
  /** World sinks ÷ all sinks, 0–1; null when nothing was spent. */
  worldShareOfSpend: number | null;
}

/** The latest run of one job with the health signal the admin table shows (pure, from job_runs). */
export interface JobHealthRow {
  job: string;
  /** The newest run (by started_at) of this job. */
  latest: JobRunRow;
  /** Runs of this job in the window that ended in status = error. */
  errors: number;
  /** Total runs of this job in the window. */
  runs: number;
}
