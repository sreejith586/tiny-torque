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

// ---------- S10: Overview, pilot KPIs, invites, feedback (MV-S10-03/04/05, F-16 / F-18) ----------
/** One row of counts + this month's costs and revenue (admin_overview()). */
export type AdminOverviewRow = Database['public']['Functions']['admin_overview']['Returns'][number];
/** One UTC week of pilot KPIs (pilot_kpis_weekly via admin_pilot_kpis()). */
export type PilotKpiRow = Database['public']['Functions']['admin_pilot_kpis']['Returns'][number];
export type InviteRow = Tables<'invites'>;
export type FeedbackRow = Tables<'feedback'>;

/** A feedback row with the submitter's public identity for the admin list. */
export interface AdminFeedbackItem extends FeedbackRow {
  handle: string | null;
  display_name: string | null;
}

/** Money per currency code, e.g. { AED: 57 } — token revenue is never summed across currencies. */
export type RevenueByCurrency = Record<string, number>;

/** The three cost / revenue tiles of the Overview (05 MV-S10-04). */
export interface OverviewCosts {
  scanCostUsd: number;
  scans: number;
  tokenRevenue: RevenueByCurrency;
  tokenPurchases: number;
  /** phone users active this month × OTPs per user × unit price — an ESTIMATE, see SMS_* constants. */
  smsEstimateUsd: number;
  smsUsers: number;
}

/** The 01 §6 ratios derivable from one weekly row; null where the denominator is 0. */
export interface PilotKpiRatios {
  /** sign-ups with ≥ 5 items inside 7 days ÷ sign-ups (target ≥ 0.6). */
  activation: number | null;
  /** items added through an accepted scan candidate ÷ items added (target ≥ 0.4). */
  scanShare: number | null;
  /** accepted candidates ÷ candidates returned (proxy for "accepted without edits", target ≥ 0.6). */
  scanAcceptance: number | null;
  /** sign-ups who have published a listing ÷ sign-ups (target ≥ 0.35). */
  publisherShare: number | null;
  /** offers created ÷ live listings, for the week (target ≥ 0.5 per month ≈ 0.12 per week). */
  offersPerListing: number | null;
  /** token buyers ÷ weekly active users (target ≥ 0.08). */
  tokenConversion: number | null;
  /** sign-ups active in their 4th week ÷ sign-ups (target ≥ 0.4); meaningful 4 weeks on. */
  retentionW4: number | null;
  /** reports that needed action ÷ live listings (target < 0.02). */
  reportsActionedShare: number | null;
}

/** Invites grouped by cohort for the admin page and the pilot ops kit. */
export interface InviteCohortSummary {
  cohort: string;
  codes: number;
  seats: number;
  used: number;
  /** Codes that can still be redeemed (not expired, seats left). */
  open: number;
}
