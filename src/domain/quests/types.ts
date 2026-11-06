// Quests, seasons & earning (F-26, MV-W04-02) — row/enum aliases derived from the GENERATED
// src/types/supabase.ts (D-006) plus the shapes the /world quests panel renders.
import type { Database, Enums, Tables } from '@/lib/supabase/types';

export type QuestRow = Tables<'quests'>;
export type QuestProgressRow = Tables<'quest_progress'>;
export type SeasonRow = Tables<'seasons'>;
export type SeasonPointsRow = Tables<'season_points'>;
export type QuestCadence = Enums<'quest_cadence'>;

/** One row of the `current_quests()` RPC: a quest on offer plus its period bounds. */
export type CurrentQuestRow = Database['public']['Functions']['current_quests']['Returns'][number];

export const QUEST_CADENCES = ['daily', 'weekly'] as const satisfies readonly QuestCadence[];

/** A quest as the panel shows it: definition + the caller's progress in the current period. */
export interface QuestStatus {
  key: string;
  cadence: QuestCadence;
  title: string;
  description: string | null;
  /** The domain event type the rule counts (for deep links / copy). */
  event: string;
  threshold: number;
  /** 0…threshold (clamped). */
  progress: number;
  /** 0–100 fill of the progress bar. */
  percent: number;
  completed: boolean;
  completedAt: string | null;
  rewardCredits: number;
  rewardXp: number;
  /** YYYY-MM-DD (UTC) — the UTC day for daily, the Monday for weekly. */
  periodStart: string;
  /** Exclusive end, YYYY-MM-DD (UTC). */
  periodEnd: string;
}

export interface SeasonSummary {
  id: string;
  name: string;
  theme: string | null;
  startsAt: string;
  endsAt: string;
  /** The caller's running total (Σ reward_xp of quests completed inside the season). */
  points: number;
}

/** Everything the /world "Today's quests" panel needs, for the caller. */
export interface QuestBoard {
  daily: QuestStatus[];
  weekly: QuestStatus[];
  /** Consecutive UTC days with a first open, ending today (0 when today is not opened yet). */
  streak: number;
  season: SeasonSummary | null;
}
