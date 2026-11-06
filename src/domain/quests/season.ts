// Season v0 (F-26, MV-W05-03, D-091) — the pure half. The DATABASE pays milestones
// (season_track_award, keyed per season × milestone × user through earn_tokens) and rolls seasons
// over (rollover_season, idempotent on announced_at / closed_at). This file reads the `track`
// jsonb at the boundary (zod, D-013), derives the milestone statuses a page shows, and mirrors the
// rollover decision so a determinism test can prove both are pure functions of their inputs.
// PURE and dependency-free apart from zod.
import { z } from 'zod';

export const seasonMilestoneSchema = z
  .object({
    points: z.number().int().positive().max(1_000_000),
    reward_credits: z.number().int().min(0).max(10_000).default(0),
    label: z.string().min(1).max(60).default('Milestone'),
    reward_item_sku: z.string().min(1).max(60).optional(),
  })
  .passthrough();
export const seasonTrackSchema = z.array(seasonMilestoneSchema).max(50);
export type SeasonMilestone = z.infer<typeof seasonMilestoneSchema>;

/** Lenient read of `seasons.track`: a malformed row renders as an empty track, never a crash.
 *  Milestones come back sorted by points (the SQL pays them in array order; a seed that is not
 *  ascending is a data bug the sort hides from the reader, not from the ledger). */
export function parseSeasonTrack(json: unknown): SeasonMilestone[] {
  const parsed = seasonTrackSchema.safeParse(json);
  return parsed.success ? parsed.data : [];
}

/** The ledger idempotency key season_track_award() uses — 1-based index in array order. */
export function milestoneKey(seasonId: string, index1: number, userId: string): string {
  return `season:${seasonId}:${index1}:${userId}`;
}

export interface MilestoneStatus {
  /** 1-based, array order (= the SQL's index). */
  index: number;
  label: string;
  points: number;
  rewardCredits: number;
  rewardItemSku: string | null;
  /** points ≥ milestone.points */
  reached: boolean;
  /** A ledger row exists under the milestone key (the credit was posted). */
  paid: boolean;
  /** Points still missing (0 when reached). */
  remaining: number;
}

/** Status of every milestone for a user with `points`, given the keys that exist in the ledger. */
export function trackStatus(
  track: readonly SeasonMilestone[],
  points: number,
  paidKeys: ReadonlySet<string>,
  seasonId: string,
  userId: string
): MilestoneStatus[] {
  return track.map((m, i) => {
    const index = i + 1;
    const reached = points >= m.points;
    return {
      index,
      label: m.label,
      points: m.points,
      rewardCredits: m.reward_credits,
      rewardItemSku: m.reward_item_sku ?? null,
      reached,
      paid: paidKeys.has(milestoneKey(seasonId, index, userId)),
      remaining: Math.max(0, m.points - points),
    };
  });
}

/** The next milestone not yet reached, or null when the track is finished. */
export function nextMilestone(statuses: readonly MilestoneStatus[]): MilestoneStatus | null {
  return statuses.find((s) => !s.reached) ?? null;
}

/** 0–100 fill towards the next milestone (100 when finished, 0 with no track). */
export function trackPercent(statuses: readonly MilestoneStatus[], points: number): number {
  if (statuses.length === 0) return 0;
  const next = nextMilestone(statuses);
  if (!next) return 100;
  const prev = statuses[next.index - 2]?.points ?? 0;
  const span = Math.max(1, next.points - prev);
  return Math.max(0, Math.min(100, Math.round(((points - prev) / span) * 100)));
}

export interface SeasonWindowRow {
  id: string;
  starts_at: string;
  ends_at: string;
  announced_at: string | null;
  closed_at: string | null;
}

/** Mirrors rollover_season(p_at): which seasons to announce (started, not announced) and close
 *  (ended, not closed) at `at`. Stamped seasons never come back — a second plan on the stamped
 *  rows is empty, whatever order the rows arrive in. */
export function rolloverPlan(
  seasons: readonly SeasonWindowRow[],
  at: Date
): { start: string[]; end: string[] } {
  const t = at.getTime();
  const sorted = [...seasons].sort(
    (a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id)
  );
  return {
    start: sorted
      .filter((s) => new Date(s.starts_at).getTime() <= t && s.announced_at === null)
      .map((s) => s.id),
    end: sorted
      .filter((s) => new Date(s.ends_at).getTime() <= t && s.closed_at === null)
      .map((s) => s.id),
  };
}

/** Applies a plan the way the SQL stamps rows, so the test can show the second run is empty. */
export function applyRollover(
  seasons: readonly SeasonWindowRow[],
  plan: { start: string[]; end: string[] },
  at: Date
): SeasonWindowRow[] {
  const iso = at.toISOString();
  return seasons.map((s) => ({
    ...s,
    announced_at: plan.start.includes(s.id) ? iso : s.announced_at,
    closed_at: plan.end.includes(s.id) ? iso : s.closed_at,
  }));
}

/** Whole UTC days left until `endsAt` (0 when over). */
export function daysLeft(endsAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000));
}
