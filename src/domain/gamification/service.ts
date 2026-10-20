// Gamification service (MV-S8-02, F-13, D-009/D-066). Components/routes import from here.
//
// The consumer is pull-based: syncGamification() runs when the owner opens /garage or /profile,
// reads their slice of the event log, recomputes XP/level/badges from scratch with the pure rules
// (rules.ts) and writes the result through apply_gamification — which emits xp.granted /
// badge.unlocked and the badge notification only for what actually changed. Running it twice on the
// same inputs is a no-op; scripts/gamification-replay.ts runs the same computation for every user
// with the service role (the backstop if anyone ever tampers with xp through the RPC).
import type { Client } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import { getGarageStats } from '@/domain/garage';
import * as repo from './repo';
import { feedbackSchema } from './schema';
import { computeGamification, levelProgress, utcDay, type GamificationEvent } from './rules';
import type { Badge, GamificationSummary } from './types';

export {
  XP_RULES,
  LEVELS,
  levelForXp,
  levelProgress,
  computeXp,
  evaluateBadges,
  computeGamification,
  utcDay,
} from './rules';
export const listAchievements = repo.listAchievements;

/** Records today's first open (+5 XP, F-13) if the event log has none for today (UTC). Returns the
 *  events list with the new row appended so the caller's recompute already counts it. */
async function ensureDailyOpen(
  supabase: Client,
  userId: string,
  events: GamificationEvent[],
  now: Date
): Promise<GamificationEvent[]> {
  const today = utcDay(now.toISOString());
  const opened = events.some((e) => e.type === 'user.opened' && utcDay(e.occurred_at) === today);
  if (opened) return events;
  await emitEvent(supabase, {
    actorId: userId,
    type: 'user.opened',
    entity: 'profile',
    entityId: userId,
    payload: { day: today },
  });
  return [
    ...events,
    {
      id: `local-${today}`,
      actor_id: userId,
      type: 'user.opened',
      entity: 'profile',
      entity_id: userId,
      payload: { day: today },
      occurred_at: now.toISOString(),
    },
  ];
}

/** Recompute + persist the caller's XP/level/badges. Safe to call on every page view. */
export async function syncGamification(
  supabase: Client,
  userId: string,
  now: Date = new Date()
): Promise<GamificationSummary> {
  const [rawEvents, stats, achievements] = await Promise.all([
    repo.fetchEvents(supabase, userId),
    getGarageStats(supabase, userId),
    repo.listAchievements(supabase),
  ]);
  const events = await ensureDailyOpen(supabase, userId, rawEvents, now);
  const state = computeGamification(userId, events, stats, achievements);
  const applied = await repo.applyState(supabase, userId, state.xp, state.level, state.badges);
  const progressRows = await repo.listUserAchievements(supabase, userId);
  const unlockedAtByKey = new Map(progressRows.map((r) => [r.achievement_key, r.unlocked_at]));

  const badges: Badge[] = state.badges.map((b) => {
    const def = achievements.find((a) => a.key === b.key)!;
    return {
      ...b,
      name: def.name,
      description: def.description,
      icon: def.icon,
      unlockedAt: unlockedAtByKey.get(b.key) ?? null,
    };
  });

  return {
    level: levelProgress(state.xp),
    badges,
    newlyUnlocked: applied.newly_unlocked,
    xpDelta: applied.xp_delta,
  };
}

/** Settings › feedback / bug report (F-14). Zod at the boundary (D-013); the insert trigger emits
 *  feedback.created (rule 9). */
export async function submitFeedback(supabase: Client, userId: string, input: unknown) {
  const v = feedbackSchema.parse(input);
  await repo.insertFeedback(supabase, userId, v.kind, v.message, v.page ?? null);
}

export type {
  AchievementRow,
  UserAchievementRow,
  FeedbackRow,
  FeedbackKind,
  Badge,
  GamificationSummary,
  BadgeState,
  LevelProgress,
  GamificationEvent,
  CollectionStats,
} from './types';
export { FEEDBACK_KINDS, feedbackSchema } from './schema';
