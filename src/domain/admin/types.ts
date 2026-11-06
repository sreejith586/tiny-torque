import type { Database, Tables } from '@/lib/supabase/types';

export type AdminProfileRow = Tables<'profiles'>;
export type EarnFreezeRow = Tables<'world_earn_freezes'>;

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
