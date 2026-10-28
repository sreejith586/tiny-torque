// F-13 gamification rules — XP rules + daily caps, the level/tier table, and the five badge
// evaluators (03 §2.18: "xp_rules live in code, levels/tiers as a static table in code").
//
// PURE and dependency-free on purpose: this file is imported by the Vitest replay-determinism
// test AND by scripts/gamification-replay.ts (run with Node's type stripping, no bundler), so it
// must not import anything at runtime — type-only imports are fine, nothing else.
//
// The consumer (service.ts) feeds it the caller's slice of `domain_events` (via the
// gamification_events RPC) plus the current collection stats, and writes the result through
// apply_gamification. Replaying = calling computeGamification again on the same inputs; the
// determinism test proves that dropping xp and recomputing yields identical values (F-13 AC).

export const XP_RULES = {
  /** add item +10 (cap 50/day) */
  itemCreated: 10,
  itemCreatedDailyCap: 50,
  /** first photo on item +5 */
  firstPhoto: 5,
  /** publish listing +15 */
  listingPublished: 15,
  /** complete deal +50 (both sides) */
  dealCompleted: 50,
  /** receive 5★ review +20 */
  fiveStarReview: 20,
  /** daily first open +5 */
  dailyFirstOpen: 5,
  /** daily quest completed +15 (F-13 stretch, MV-S8-07) */
  dailyQuest: 15,
} as const;

export interface DailyQuest {
  key: string;
  title: string;
  /** The event type that completes it — must be one the rules already count. */
  event: string;
  href: string;
}

/** Three quests rotating by UTC day (MV-S8-07). Completion is derived from that day's events
 *  alone, so a replay sees exactly the same quests completed on exactly the same days. */
export const DAILY_QUESTS: readonly DailyQuest[] = [
  { key: 'add_car', title: 'Add a car to your garage', event: 'item.created', href: '/garage/add' },
  {
    key: 'add_photo',
    title: 'Add a photo to one of your cars',
    event: 'item.photo_added',
    href: '/garage',
  },
  {
    key: 'list_car',
    title: 'List a car on the Market',
    event: 'listing.published',
    href: '/garage',
  },
];

/** Days since the Unix epoch for a YYYY-MM-DD UTC day. */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

export function questForDay(day: string): DailyQuest {
  return DAILY_QUESTS[dayNumber(day) % DAILY_QUESTS.length]!;
}

export interface DailyQuestStatus extends DailyQuest {
  day: string;
  xp: number;
  done: boolean;
}

/** Today's quest and whether the user's events for that UTC day already complete it. */
export function questStatus(
  userId: string,
  events: readonly GamificationEvent[],
  day: string
): DailyQuestStatus {
  const quest = questForDay(day);
  const done = events.some(
    (e) => e.type === quest.event && utcDay(e.occurred_at) === day && eventPaysUser(e, userId)
  );
  return { ...quest, day, xp: XP_RULES.dailyQuest, done };
}

export interface LevelDef {
  level: number;
  minXp: number;
  tier: string;
}

/** 0/100/300/700/1500/3000 XP → the six tiers named in F-13 (Varun's names where they existed). */
export const LEVELS: readonly LevelDef[] = [
  { level: 1, minXp: 0, tier: 'Rookie' },
  { level: 2, minXp: 100, tier: 'Collector' },
  { level: 3, minXp: 300, tier: 'Serious Collector' },
  { level: 4, minXp: 700, tier: 'Curator' },
  { level: 5, minXp: 1500, tier: 'Legend' },
  { level: 6, minXp: 3000, tier: 'Vault Master' },
];

export function levelForXp(xp: number): LevelDef {
  let current = LEVELS[0]!;
  for (const l of LEVELS) if (xp >= l.minXp) current = l;
  return current;
}

export interface LevelProgress {
  level: number;
  tier: string;
  xp: number;
  /** XP at which the current level started. */
  currentMin: number;
  /** XP needed for the next level, or null at the top. */
  nextMin: number | null;
  /** 0–100 fill of the bar towards the next level (100 at the top level). */
  percent: number;
}

export function levelProgress(xp: number): LevelProgress {
  const def = levelForXp(xp);
  const next = LEVELS.find((l) => l.level === def.level + 1) ?? null;
  const span = next ? next.minXp - def.minXp : 0;
  const percent = next ? Math.min(100, Math.round(((xp - def.minXp) / span) * 100)) : 100;
  return {
    level: def.level,
    tier: def.tier,
    xp,
    currentMin: def.minXp,
    nextMin: next ? next.minXp : null,
    percent,
  };
}

/** One row of gamification_events() — the subset of a domain_events row the rules need. */
export interface GamificationEvent {
  id: number | string;
  actor_id: string | null;
  type: string;
  entity: string;
  entity_id: string | null;
  payload: unknown;
  occurred_at: string;
}

/** The collection figures the stat-based badges read (garage's computeStats shape). */
export interface CollectionStats {
  totalItems: number;
  totalValue: number;
  rareItems: number;
}

export interface AchievementDef {
  key: string;
  /** `rule` jsonb from the achievements table: {kind, event?|stat?, threshold}. */
  rule: unknown;
}

export interface BadgeState {
  key: string;
  progress: number;
  target: number;
  unlocked: boolean;
}

export interface GamificationState {
  xp: number;
  level: number;
  tier: string;
  breakdown: Record<string, number>;
  badges: BadgeState[];
}

function payloadOf(e: GamificationEvent): Record<string, unknown> {
  return e.payload && typeof e.payload === 'object' ? (e.payload as Record<string, unknown>) : {};
}

/** UTC calendar day of an ISO timestamp — the daily-cap bucket. UTC (not the user's zone) so a
 *  replay produces the same buckets wherever it runs. */
export function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Does this event pay XP to `userId`? Most events pay their actor; offer.completed pays both
 *  parties (the RPC merges buyer_id/seller_id into the payload) and review.created pays the
 *  reviewed seller, not the reviewing buyer. */
export function eventPaysUser(e: GamificationEvent, userId: string): boolean {
  const p = payloadOf(e);
  switch (e.type) {
    case 'offer.completed':
      return p.buyer_id === userId || p.seller_id === userId || e.actor_id === userId;
    case 'review.created':
      return p.seller_id === userId;
    default:
      return e.actor_id === userId;
  }
}

/** XP from events alone (F-13 AC: "computed only from domain_events"). Order-independent. */
export function computeXp(
  userId: string,
  events: readonly GamificationEvent[]
): { xp: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {
    itemCreated: 0,
    firstPhoto: 0,
    listingPublished: 0,
    dealCompleted: 0,
    fiveStarReview: 0,
    dailyFirstOpen: 0,
    dailyQuest: 0,
  };
  const itemsPerDay = new Map<string, number>();
  const typesPerDay = new Map<string, Set<string>>();
  const openDays = new Set<string>();
  const completedOffers = new Set<string>();
  const reviews = new Set<string>();
  const photoItems = new Set<string>();

  for (const e of events) {
    if (!eventPaysUser(e, userId)) continue;
    {
      const d = utcDay(e.occurred_at);
      if (!typesPerDay.has(d)) typesPerDay.set(d, new Set());
      typesPerDay.get(d)!.add(e.type);
    }
    switch (e.type) {
      case 'item.created': {
        const d = utcDay(e.occurred_at);
        itemsPerDay.set(d, (itemsPerDay.get(d) ?? 0) + 1);
        break;
      }
      case 'item.photo_added':
        // one bonus per item, however many "first photo" events a replay might contain
        if (e.entity_id && !photoItems.has(e.entity_id)) {
          photoItems.add(e.entity_id);
          breakdown.firstPhoto! += XP_RULES.firstPhoto;
        }
        break;
      case 'listing.published':
        breakdown.listingPublished! += XP_RULES.listingPublished;
        break;
      case 'offer.completed':
        if (e.entity_id && !completedOffers.has(e.entity_id)) {
          completedOffers.add(e.entity_id);
          breakdown.dealCompleted! += XP_RULES.dealCompleted;
        }
        break;
      case 'review.created': {
        const rating = Number(payloadOf(e).rating);
        const key = e.entity_id ?? String(e.id);
        if (rating === 5 && !reviews.has(key)) {
          reviews.add(key);
          breakdown.fiveStarReview! += XP_RULES.fiveStarReview;
        }
        break;
      }
      case 'user.opened':
        openDays.add(utcDay(e.occurred_at));
        break;
      default:
        break;
    }
  }

  for (const n of itemsPerDay.values()) {
    breakdown.itemCreated! += Math.min(n * XP_RULES.itemCreated, XP_RULES.itemCreatedDailyCap);
  }
  breakdown.dailyFirstOpen = openDays.size * XP_RULES.dailyFirstOpen;
  for (const [day, types] of typesPerDay) {
    if (types.has(questForDay(day).event)) breakdown.dailyQuest! += XP_RULES.dailyQuest;
  }

  const xp = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { xp, breakdown };
}

interface ParsedRule {
  kind: 'event_count' | 'stat';
  event?: string;
  stat?: keyof CollectionStats;
  threshold: number;
}

function parseRule(rule: unknown): ParsedRule | null {
  if (!rule || typeof rule !== 'object') return null;
  const r = rule as Record<string, unknown>;
  const threshold = Number(r.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) return null;
  if (r.kind === 'event_count' && typeof r.event === 'string') {
    return { kind: 'event_count', event: r.event, threshold };
  }
  if (r.kind === 'stat' && typeof r.stat === 'string') {
    return { kind: 'stat', stat: r.stat as keyof CollectionStats, threshold };
  }
  return null;
}

/** Badge progress for every achievement definition. Event-count badges count distinct events
 *  that pay the user; stat badges read the live collection figures. Unknown/malformed rules
 *  evaluate to 0 progress rather than throwing — a bad seed row must not break the profile. */
export function evaluateBadges(
  userId: string,
  events: readonly GamificationEvent[],
  stats: CollectionStats,
  achievements: readonly AchievementDef[]
): BadgeState[] {
  const eventCounts = new Map<string, number>();
  const seen = new Set<string>();
  for (const e of events) {
    if (!eventPaysUser(e, userId)) continue;
    const dedupe = `${e.type}:${e.entity_id ?? e.id}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    eventCounts.set(e.type, (eventCounts.get(e.type) ?? 0) + 1);
  }

  return achievements.map((a) => {
    const rule = parseRule(a.rule);
    if (!rule) return { key: a.key, progress: 0, target: 1, unlocked: false };
    const raw =
      rule.kind === 'event_count'
        ? (eventCounts.get(rule.event!) ?? 0)
        : Math.floor(Number(stats[rule.stat!] ?? 0));
    const progress = Math.max(0, Math.min(raw, rule.threshold));
    return { key: a.key, progress, target: rule.threshold, unlocked: raw >= rule.threshold };
  });
}

export function computeGamification(
  userId: string,
  events: readonly GamificationEvent[],
  stats: CollectionStats,
  achievements: readonly AchievementDef[]
): GamificationState {
  const { xp, breakdown } = computeXp(userId, events);
  const lvl = levelForXp(xp);
  return {
    xp,
    level: lvl.level,
    tier: lvl.tier,
    breakdown,
    badges: evaluateBadges(userId, events, stats, achievements),
  };
}
