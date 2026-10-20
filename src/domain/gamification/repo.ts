// The ONLY file in this module that talks to Supabase (D-007). Reads go through the
// gamification_events RPC (domain_events itself is admin-read-only) and plain selects on the
// RLS-scoped achievements / user_achievements tables; the single write goes through
// apply_gamification (the only path profiles.xp/level and user_achievements change — a trigger
// rejects everything else, 0020).
import type { Client, Json } from '@/lib/supabase/types';
import type { BadgeState, GamificationEvent } from './rules';
import type { AchievementRow, FeedbackKind, UserAchievementRow } from './types';

export async function listAchievements(supabase: Client): Promise<AchievementRow[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listUserAchievements(
  supabase: Client,
  userId: string
): Promise<UserAchievementRow[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchEvents(supabase: Client, userId: string): Promise<GamificationEvent[]> {
  const { data, error } = await supabase.rpc('gamification_events', { p_user: userId });
  if (error) throw error;
  return (data ?? []) as GamificationEvent[];
}

export interface ApplyResult {
  xp_delta: number;
  newly_unlocked: string[];
}

export async function applyState(
  supabase: Client,
  userId: string,
  xp: number,
  level: number,
  badges: BadgeState[]
): Promise<ApplyResult> {
  const { data, error } = await supabase.rpc('apply_gamification', {
    p_user: userId,
    p_xp: xp,
    p_level: level,
    p_badges: badges.map((b) => ({
      key: b.key,
      progress: b.progress,
      unlocked: b.unlocked,
    })) as unknown as Json,
  });
  if (error) throw error;
  const r = (data ?? {}) as { xp_delta?: number; newly_unlocked?: string[] };
  return { xp_delta: r.xp_delta ?? 0, newly_unlocked: r.newly_unlocked ?? [] };
}

export async function insertFeedback(
  supabase: Client,
  userId: string,
  kind: FeedbackKind,
  message: string,
  page: string | null
): Promise<void> {
  const { error } = await supabase
    .from('feedback')
    .insert({ user_id: userId, kind, message, page });
  if (error) throw error;
}
