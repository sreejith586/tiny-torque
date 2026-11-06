// The ONLY file in this module that talks to Supabase (D-007). Reads only: quest progress, season
// points and credits are written by the database (the world_earn_consumer trigger + earn_tokens,
// 07 P4 / D-071) — nothing in app code ever inserts into quest_progress / season_points or
// touches token_ledger (D-021).
import type { Client } from '@/lib/supabase/types';
import type { CurrentQuestRow, QuestProgressRow, SeasonRow } from './types';

/** The 3 daily + 3 weekly quests on offer at `at`, with their period bounds (current_quests()). */
export async function listCurrentQuests(supabase: Client, at: Date): Promise<CurrentQuestRow[]> {
  const { data, error } = await supabase.rpc('current_quests', { p_at: at.toISOString() });
  if (error) throw error;
  return data ?? [];
}

/** The caller's progress rows from `fromPeriodStart` (YYYY-MM-DD) on — RLS keeps it to their own. */
export async function listProgress(
  supabase: Client,
  userId: string,
  fromPeriodStart: string
): Promise<QuestProgressRow[]> {
  const { data, error } = await supabase
    .from('quest_progress')
    .select('*')
    .eq('user_id', userId)
    .gte('period_start', fromPeriodStart);
  if (error) throw error;
  return data ?? [];
}

/** The season running at `atIso` (the latest-starting one if windows overlap), or null. */
export async function getActiveSeason(supabase: Client, atIso: string): Promise<SeasonRow | null> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .lte('starts_at', atIso)
    .gt('ends_at', atIso)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getSeasonPoints(
  supabase: Client,
  seasonId: string,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('season_points')
    .select('points')
    .eq('season_id', seasonId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.points ?? 0;
}

/** Consecutive UTC days with a first open, ending today (world_login_streak(), own user only). */
export async function getLoginStreak(supabase: Client, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('world_login_streak', { p_user: userId });
  if (error) throw error;
  return data ?? 0;
}
