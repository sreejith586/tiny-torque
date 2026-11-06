// Quests & seasons service (MV-W04-02, F-26). Components/routes import from here, never from the
// repo (D-007). Read-only by design: progress, completion, credits and season points are written
// by the database consumer (07 P4 / D-071) — the only thing this service does is shape the
// caller's board. The `world_earn` flag check is the caller's job (route/page), as everywhere.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { parseQuestRule } from './schema';
import type { CurrentQuestRow, QuestBoard, QuestProgressRow, QuestStatus } from './types';

export {
  EARN_RULES,
  QUEST_EPOCH,
  QUESTS_PER_SET,
  utcDay,
  dayNumber,
  addDays,
  periodStart,
  periodEnd,
  questSetIndex,
  questsOnOffer,
  questProgress,
  computeQuestProgress,
  computeSeasonPoints,
  loginStreak,
} from './rules';
export { parseQuestRule, questRuleSchema, QUEST_RULE_KINDS } from './schema';

function toStatus(
  row: CurrentQuestRow,
  progress: QuestProgressRow | undefined
): QuestStatus | null {
  const rule = parseQuestRule(row.rule);
  if (!rule) return null; // a malformed seed row must not take the panel down
  const done = Math.min(progress?.progress ?? 0, rule.threshold);
  return {
    key: row.key,
    cadence: row.cadence,
    title: row.title,
    description: row.description ?? null,
    event: rule.event,
    threshold: rule.threshold,
    progress: done,
    percent: Math.round((done / rule.threshold) * 100),
    completed: progress?.completed_at != null,
    completedAt: progress?.completed_at ?? null,
    rewardCredits: row.reward_credits,
    rewardXp: row.reward_xp,
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

/** The caller's quest board: today's 3 daily + this week's 3 weekly quests with progress, the login
 *  streak and the running season. Safe to call on every /world view (reads only). */
export async function getQuestBoard(
  supabase: Client,
  userId: string,
  now: Date = new Date()
): Promise<QuestBoard> {
  const [current, streak, season] = await Promise.all([
    repo.listCurrentQuests(supabase, now),
    repo.getLoginStreak(supabase, userId).catch(() => 0),
    repo.getActiveSeason(supabase, now.toISOString()),
  ]);

  const periods = current.map((q) => q.period_start).sort();
  const progress = periods.length > 0 ? await repo.listProgress(supabase, userId, periods[0]!) : [];
  const progressByKey = new Map(progress.map((p) => [`${p.quest_key}:${p.period_start}`, p]));

  const statuses = current
    .map((q) => toStatus(q, progressByKey.get(`${q.key}:${q.period_start}`)))
    .filter((s): s is QuestStatus => s !== null);

  const points = season ? await repo.getSeasonPoints(supabase, season.id, userId) : 0;

  return {
    daily: statuses.filter((s) => s.cadence === 'daily'),
    weekly: statuses.filter((s) => s.cadence === 'weekly'),
    streak,
    season: season
      ? {
          id: season.id,
          name: season.name,
          theme: season.theme,
          startsAt: season.starts_at,
          endsAt: season.ends_at,
          points,
        }
      : null,
  };
}

export type {
  CurrentQuestRow,
  QuestBoard,
  QuestCadence,
  QuestProgressRow,
  QuestRow,
  QuestStatus,
  SeasonPointsRow,
  SeasonRow,
  SeasonSummary,
} from './types';
export { QUEST_CADENCES } from './types';
export type { QuestRule } from './schema';
export type { OfferedQuest, QuestDef, QuestEvent, QuestProgressState, SeasonWindow } from './rules';
