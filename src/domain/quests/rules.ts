// F-26 quest rules — the pure half of the earn engine. The DATABASE is the writer (the
// world_earn_consumer trigger in 20261106092928_earn_engine.sql recounts progress from
// domain_events on every matching event and pays through earn_tokens); this file is the same
// arithmetic in TypeScript so the replay-determinism test (F-26 AC: "same values after drop +
// replay") can prove the rules are a pure, order-independent function of the event log, and so
// the panel can label periods without a round trip. Any divergence from the SQL is a bug in one of
// the two — the pgTAP file pins the SQL side on the same dates this file's tests use.
//
// PURE and dependency-free on purpose (same discipline as domain/gamification/rules.ts): type-only
// imports, nothing at runtime.
import type { QuestRule } from './schema';
import type { QuestCadence } from './types';

/** Mirrors the constants inside earn_engine.sql (PLACEHOLDER values, 07 §3.2 / D-070). */
export const EARN_RULES = {
  /** Σ earn_* credits per UTC day, enforced inside earn_tokens(). */
  dailyCeiling: 15,
  dailyLogin: 1,
  streakBonus: 5,
  streakDays: 7,
  earnedExpiryDays: 180,
} as const;

/** Monday 2026-01-05 — the parity epoch the SQL rotation uses (quest_set_index). */
export const QUEST_EPOCH = '2026-01-05';
/** Quests shown per cadence per period (rows 1–3 or 4–6 of the 6-row pool). */
export const QUESTS_PER_SET = 3;

/** YYYY-MM-DD of an ISO timestamp, in UTC. */
export function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Days since the Unix epoch for a YYYY-MM-DD UTC day. */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

export function addDays(day: string, n: number): string {
  return new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10);
}

/** The period an instant falls in: its UTC day (daily) or that day's Monday (weekly). */
export function periodStart(cadence: QuestCadence, iso: string): string {
  const day = utcDay(iso);
  if (cadence === 'daily') return day;
  const dow = new Date(`${day}T00:00:00.000Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** Exclusive end of a period. */
export function periodEnd(cadence: QuestCadence, start: string): string {
  return addDays(start, cadence === 'daily' ? 1 : 7);
}

/** 0 or 1 — which half of the pool a period shows. Integer division truncates toward zero like
 *  the SQL, so both sides agree even before the epoch. */
export function questSetIndex(cadence: QuestCadence, start: string): number {
  const days = dayNumber(start) - dayNumber(QUEST_EPOCH);
  const n = cadence === 'daily' ? days : Math.trunc(days / 7);
  return ((n % 2) + 2) % 2;
}

export interface QuestDef {
  key: string;
  cadence: QuestCadence;
  active: boolean;
  sort_order: number;
  rule: QuestRule;
  reward_xp: number;
  reward_credits: number;
}

export interface OfferedQuest extends QuestDef {
  period_start: string;
  period_end: string;
}

/** The 3 + 3 quests on offer at `iso`, with their periods — the TS twin of current_quests(). */
export function questsOnOffer(quests: readonly QuestDef[], iso: string): OfferedQuest[] {
  return quests
    .filter((q) => q.active)
    .filter((q) => {
      const start = periodStart(q.cadence, iso);
      return Math.floor((q.sort_order - 1) / QUESTS_PER_SET) === questSetIndex(q.cadence, start);
    })
    .map((q) => {
      const start = periodStart(q.cadence, iso);
      return { ...q, period_start: start, period_end: periodEnd(q.cadence, start) };
    })
    .sort((a, b) => a.cadence.localeCompare(b.cadence) || a.sort_order - b.sort_order);
}

/** The subset of a domain_events row the rules need. */
export interface QuestEvent {
  id: number | string;
  actor_id: string | null;
  type: string;
  occurred_at: string;
}

export interface QuestProgressState {
  quest_key: string;
  period_start: string;
  progress: number;
  completed_at: string | null;
}

function byTime(a: QuestEvent, b: QuestEvent): number {
  if (a.occurred_at !== b.occurred_at) return a.occurred_at < b.occurred_at ? -1 : 1;
  const ai = typeof a.id === 'number' ? a.id : Number(a.id);
  const bi = typeof b.id === 'number' ? b.id : Number(b.id);
  if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
  return String(a.id).localeCompare(String(b.id));
}

/** Progress of one offered quest from the user's events: the count of their own events of the
 *  rule's type inside the period (event_count) or of distinct UTC days with one (event_days),
 *  clamped at the threshold; completed_at = when the threshold was crossed. Null when nothing
 *  counted (the consumer writes no row before the first matching event). */
export function questProgress(
  userId: string,
  quest: OfferedQuest,
  events: readonly QuestEvent[]
): QuestProgressState | null {
  const startIso = `${quest.period_start}T00:00:00.000Z`;
  const endIso = `${quest.period_end}T00:00:00.000Z`;
  const hits = events
    .filter(
      (e) =>
        e.actor_id === userId &&
        e.type === quest.rule.event &&
        e.occurred_at >= startIso &&
        e.occurred_at < endIso
    )
    .sort(byTime);
  if (hits.length === 0) return null;

  const { threshold } = quest.rule;
  let count: number;
  let crossedAt: string | null = null;
  if (quest.rule.kind === 'event_days') {
    const firstOfDay = new Map<string, string>();
    for (const e of hits) {
      const day = utcDay(e.occurred_at);
      if (!firstOfDay.has(day)) firstOfDay.set(day, e.occurred_at);
    }
    const days = [...firstOfDay.keys()].sort();
    count = days.length;
    if (count >= threshold) crossedAt = firstOfDay.get(days[threshold - 1]!)!;
  } else {
    count = hits.length;
    if (count >= threshold) crossedAt = hits[threshold - 1]!.occurred_at;
  }
  return {
    quest_key: quest.key,
    period_start: quest.period_start,
    progress: Math.min(count, threshold),
    completed_at: crossedAt,
  };
}

/** Every offered quest's progress for `iso`'s periods — the rows the consumer would hold. */
export function computeQuestProgress(
  userId: string,
  quests: readonly QuestDef[],
  events: readonly QuestEvent[],
  iso: string
): QuestProgressState[] {
  return questsOnOffer(quests, iso)
    .map((q) => questProgress(userId, q, events))
    .filter((r): r is QuestProgressState => r !== null);
}

export interface SeasonWindow {
  id: string;
  starts_at: string;
  ends_at: string;
}

/** Season points = Σ reward_xp of quests completed inside the season window (replay formula). */
export function computeSeasonPoints(
  progress: readonly QuestProgressState[],
  quests: readonly Pick<QuestDef, 'key' | 'reward_xp'>[],
  seasons: readonly SeasonWindow[]
): Array<{ season_id: string; points: number }> {
  const xpByKey = new Map(quests.map((q) => [q.key, q.reward_xp]));
  return seasons
    .map((s) => ({
      season_id: s.id,
      points: progress
        .filter(
          (p) => p.completed_at && p.completed_at >= s.starts_at && p.completed_at < s.ends_at
        )
        .reduce((sum, p) => sum + (xpByKey.get(p.quest_key) ?? 0), 0),
    }))
    .filter((s) => s.points > 0);
}

/** Consecutive UTC days with a `user.opened` event, ending on `day`. */
export function loginStreak(userId: string, events: readonly QuestEvent[], day: string): number {
  const days = new Set(
    events
      .filter((e) => e.actor_id === userId && e.type === 'user.opened')
      .map((e) => utcDay(e.occurred_at))
  );
  let streak = 0;
  let cursor = day;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
