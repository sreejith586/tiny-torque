// Garage score (07 §2.1, MV-W05-04, D-091) — the pure half. The DATABASE is the writer:
// world_garage_score_value() / world_recompute_score() in 20261106101709_world_season_economy.sql
// compute and store it (guarded `score` column, consumer trigger on domain_events, nightly
// world_recompute_all_scores). This file is the same arithmetic in TypeScript so the
// replay-determinism test can prove the score is a pure, order-independent function of the garage
// state + the social event log, and so screens can explain the number without a round trip.
// Any divergence from the SQL is a bug in one of the two — pgTAP 0027 pins the SQL side on the
// same figures score.test.ts uses. PURE and dependency-free (type-only imports).

/** PLACEHOLDER weights (D-091) — mirrored in world_garage_score_value(). Change both or neither. */
export const SCORE_WEIGHTS = {
  displayedCar: 10,
  rarityUnit: 5,
  decor: 5,
  trophy: 15,
  kudos: 2,
  visit: 1,
  levelStep: 20,
} as const;

/** Rarity → units (× rarityUnit). Unknown / null rarity counts 0 (a common car still scores 10). */
export const RARITY_WEIGHT: Readonly<Record<string, number>> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  'super-rare': 3,
  'treasure-hunt': 5,
  chase: 5,
};

export function rarityWeight(rarity: string | null | undefined): number {
  return rarity ? (RARITY_WEIGHT[rarity] ?? 0) : 0;
}

export interface ScoreInput {
  /** Rarities of the cars actually displayed: layout slots holding a public, non-deleted own car. */
  displayedRarities: readonly (string | null | undefined)[];
  /** Entries in `layout.decor`. */
  decorCount: number;
  /** Durable `trophy` items in the inventory. */
  trophyCount: number;
  /** One-per-giver-per-day kudos rows / `world.kudos_given` events for the garage. */
  kudosCount: number;
  /** One-per-visitor-per-day visit rows / `world.visited` events for the garage. */
  visitCount: number;
  /** world_garages.level (1–5). */
  level: number;
}

/** score = displayed × 10 + Σ rarity units × 5 + decor × 5 + trophies × 15 + kudos × 2 + visits
 *  + (level − 1) × 20. Never negative. */
export function garageScore(input: ScoreInput): number {
  const w = SCORE_WEIGHTS;
  const rarityUnits = input.displayedRarities.reduce((sum, r) => sum + rarityWeight(r), 0);
  return Math.max(
    0,
    input.displayedRarities.length * w.displayedCar +
      rarityUnits * w.rarityUnit +
      input.decorCount * w.decor +
      input.trophyCount * w.trophy +
      input.kudosCount * w.kudos +
      input.visitCount * w.visit +
      (Math.max(1, input.level) - 1) * w.levelStep
  );
}

/** The slice of a domain event the replay needs. */
export interface ScoreEvent {
  id: number | string;
  type: string;
  actor_id: string | null;
  entity_id: string | null;
  payload?: Record<string, unknown> | null;
}

export interface ScoreState {
  displayedRarities: readonly (string | null | undefined)[];
  decorCount: number;
  level: number;
}

/** Social + trophy counts folded from the event log for one garage, in ANY order: each counted
 *  event is one durable row (visit / kudos / trophy grant or purchase), so the fold is a plain
 *  count with no ordering assumptions — that is what makes a drop + replay land on the same score. */
export function scoreFromEvents(
  garageUserId: string,
  state: ScoreState,
  events: readonly ScoreEvent[]
): number {
  let kudos = 0;
  let visits = 0;
  let trophies = 0;
  const seen = new Set<string>();
  for (const e of events) {
    const key = `${e.type}:${e.id}`;
    if (seen.has(key)) continue; // a replayed duplicate never double counts
    seen.add(key);
    if (e.type === 'world.kudos_given' && e.entity_id === garageUserId) kudos += 1;
    else if (e.type === 'world.visited' && e.entity_id === garageUserId) visits += 1;
    else if (
      (e.type === 'world.item_granted' || e.type === 'world.item_bought') &&
      e.actor_id === garageUserId &&
      e.payload?.kind === 'trophy'
    )
      trophies += 1;
  }
  return garageScore({
    displayedRarities: state.displayedRarities,
    decorCount: state.decorCount,
    trophyCount: trophies,
    kudosCount: kudos,
    visitCount: visits,
    level: state.level,
  });
}

/** Human line for the garage card / scene ("28 pts · 2 cars · 1 decor · 2 kudos"). */
export function scoreBreakdown(input: ScoreInput): string[] {
  const parts: string[] = [];
  if (input.displayedRarities.length)
    parts.push(
      `${input.displayedRarities.length} car${input.displayedRarities.length === 1 ? '' : 's'} on show`
    );
  if (input.decorCount) parts.push(`${input.decorCount} decor`);
  if (input.trophyCount)
    parts.push(`${input.trophyCount} troph${input.trophyCount === 1 ? 'y' : 'ies'}`);
  if (input.kudosCount) parts.push(`${input.kudosCount} kudos`);
  if (input.visitCount) parts.push(`${input.visitCount} visit${input.visitCount === 1 ? '' : 's'}`);
  return parts;
}
