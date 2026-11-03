// F-25 racing stats model v1 — SKELETON (MV-W08-prep; the full module is MV-W08-01).
//
// PURE and dependency-free on purpose (type-only import from domain/catalog): the W08 Edge
// `run-race` function and the replay viewer must compute exactly what this file computes, and
// a race pins the STATS_VERSION it ran with (D-075: "stats version pinned per race, results
// immutable, replay from seed"). Changing any number below is a new STATS_VERSION, never an edit.
//
// What this version covers (07 §2.4): base stats from the canonical model's real-car specs
// (0022_catalog_specs) with the segment archetype as the fallback for fantasy castings /
// unmatched items, plus the D-075 influence cap for tunes + driver level. What W08-01 adds on
// top, in this same file: scale factor, condition → reliability, rarity bonus, the seeded luck
// component and the xorshift RNG. Nothing here is wired to a table or a flag yet.
//
// ---- Formula v1 (all stats 0–100, one decimal) ------------------------------------------------
// acceleration
//   zero_to_100_s present       → lin(t, 12 s → 0, 2 s → 100)
//   else power_kw + weight_kg   → specific power kW/tonne, lin(p, 40 → 0, 400 → 100)
//   else                        → archetype.acceleration
//   + launch nudge when derived from specs: awd +3, fwd −2 (rwd 0)
// topSpeed
//   top_speed_kmh present       → lin(v, 120 km/h → 0, 400 km/h → 100)
//   else power_kw               → v = (2P / (ρ·cd·A))^(1/3) with ρ 1.225, A 2.2 m², cd = drag_cd
//                                 or 0.33 → same lin() as above (aero top-speed estimate)
//   else                        → archetype.topSpeed
// handling  (weighted mean of whichever components exist, weights renormalised)
//   weight_kg  (0.5)            → lin(w, 2200 kg → 0, 900 kg → 100)
//   drag_cd    (0.25)           → lin(cd, 0.45 → 0, 0.25 → 100)
//   drivetrain (0.25)           → awd 75 · rwd 60 · fwd 45
//   none present                → archetype.handling
// lin() clamps to 0–100. Only VERIFIED specs race (D-008: a proposal is not the catalogue yet).
//
// ---- Influence cap (D-075) -----------------------------------------------------------------
// tunes (paid, per stat, summed)  ≤ MAX_TUNE_INFLUENCE   (5 %)
// driver level (F-13, 0.5 %/lvl)  ≤ MAX_LEVEL_INFLUENCE  (5 %)
// combined per stat               ≤ MAX_PAID_LEVEL_INFLUENCE (10 %) — stats.test.ts asserts it
// with absurd inputs, on every stat and on the composite raceScore.
import type { CarSpecs, Drivetrain } from '@/domain/catalog/specs';

export const STATS_VERSION = 1 as const;

export const ARCHETYPES = [
  'sports',
  'muscle',
  'exotic',
  'truck',
  'classic',
  'fantasy',
  'neutral',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export interface BaseStats {
  acceleration: number;
  topSpeed: number;
  handling: number;
}

export type StatsSource = 'specs' | 'archetype' | 'mixed';

export interface ModelStats extends BaseStats {
  version: typeof STATS_VERSION;
  archetype: Archetype;
  /** `specs` = all three from real-car data, `archetype` = none, `mixed` = some. */
  source: StatsSource;
}

/** Segment archetypes (07 §2.4) — the fallback for fantasy castings and unmatched items.
 *  `neutral` is deliberately the exact middle so an unmatched garage can still race (07 §2.3). */
export const ARCHETYPE_STATS: Readonly<Record<Archetype, BaseStats>> = {
  sports: { acceleration: 62, topSpeed: 60, handling: 70 },
  muscle: { acceleration: 68, topSpeed: 58, handling: 42 },
  exotic: { acceleration: 85, topSpeed: 85, handling: 80 },
  truck: { acceleration: 30, topSpeed: 32, handling: 28 },
  classic: { acceleration: 35, topSpeed: 40, handling: 40 },
  fantasy: { acceleration: 55, topSpeed: 55, handling: 55 },
  neutral: { acceleration: 50, topSpeed: 50, handling: 50 },
};

export const MAX_TUNE_INFLUENCE = 0.05;
export const MAX_LEVEL_INFLUENCE = 0.05;
/** D-075: tunes + driver level together may move a stat by at most this fraction. */
export const MAX_PAID_LEVEL_INFLUENCE = 0.1;
const LEVEL_INFLUENCE_PER_LEVEL = 0.005;

const LAUNCH_NUDGE: Record<Drivetrain, number> = { awd: 3, rwd: 0, fwd: -2 };
const DRIVETRAIN_HANDLING: Record<Drivetrain, number> = { awd: 75, rwd: 60, fwd: 45 };
const AIR_DENSITY = 1.225;
const FRONTAL_AREA_M2 = 2.2;
const DEFAULT_DRAG_CD = 0.33;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
/** Linear map `from0 → 0`, `from100 → 100`, clamped. Works in either direction. */
const lin = (x: number, from0: number, from100: number) =>
  clamp(((x - from0) / (from100 - from0)) * 100, 0, 100);

function accelerationFromSpecs(s: CarSpecs): number | null {
  let v: number | null = null;
  if (s.zero_to_100_s !== undefined) v = lin(s.zero_to_100_s, 12, 2);
  else if (s.power_kw !== undefined && s.weight_kg !== undefined)
    v = lin((s.power_kw / s.weight_kg) * 1000, 40, 400);
  if (v === null) return null;
  if (s.drivetrain) v = clamp(v + LAUNCH_NUDGE[s.drivetrain], 0, 100);
  return v;
}

function topSpeedFromSpecs(s: CarSpecs): number | null {
  if (s.top_speed_kmh !== undefined) return lin(s.top_speed_kmh, 120, 400);
  if (s.power_kw !== undefined) {
    const cd = s.drag_cd ?? DEFAULT_DRAG_CD;
    const ms = Math.cbrt((2 * s.power_kw * 1000) / (AIR_DENSITY * cd * FRONTAL_AREA_M2));
    return lin(ms * 3.6, 120, 400);
  }
  return null;
}

function handlingFromSpecs(s: CarSpecs): number | null {
  const parts: Array<[number, number]> = [];
  if (s.weight_kg !== undefined) parts.push([lin(s.weight_kg, 2200, 900), 0.5]);
  if (s.drag_cd !== undefined) parts.push([lin(s.drag_cd, 0.45, 0.25), 0.25]);
  if (s.drivetrain) parts.push([DRIVETRAIN_HANDLING[s.drivetrain], 0.25]);
  if (parts.length === 0) return null;
  const weight = parts.reduce((a, [, w]) => a + w, 0);
  return parts.reduce((a, [v, w]) => a + v * w, 0) / weight;
}

/** Base stats for a car from its real-car specs, falling back per stat to the segment archetype
 *  (default `neutral`). `{}` → the archetype verbatim. Deterministic: same input, same output. */
export function baseStatsFromSpecs(specs: CarSpecs, archetype: Archetype = 'neutral'): ModelStats {
  const fallback = ARCHETYPE_STATS[archetype];
  const acc = accelerationFromSpecs(specs);
  const top = topSpeedFromSpecs(specs);
  const han = handlingFromSpecs(specs);
  const fromSpecs = [acc, top, han].filter((v) => v !== null).length;
  return {
    version: STATS_VERSION,
    archetype,
    source: fromSpecs === 3 ? 'specs' : fromSpecs === 0 ? 'archetype' : 'mixed',
    acceleration: round1(acc ?? fallback.acceleration),
    topSpeed: round1(top ?? fallback.topSpeed),
    handling: round1(han ?? fallback.handling),
  };
}

/** The D-008 rule applied to racing: only VERIFIED catalogue specs count; a pending proposal or
 *  an unmatched item races on the archetype. `null` model = no canonical match. */
export function baseStatsForModel(
  model: { specs: CarSpecs; verified: boolean } | null,
  archetype: Archetype = 'neutral'
): ModelStats {
  if (!model || !model.verified) return baseStatsFromSpecs({}, archetype);
  return baseStatsFromSpecs(model.specs, archetype);
}

/** A tune item's effect as fractions per stat (0.02 = +2 %). Negative/absent = no effect. */
export interface TuneEffect {
  acceleration?: number;
  topSpeed?: number;
  handling?: number;
}

export interface InfluenceInput {
  /** Every tune the entrant owns and has fitted; their effects are summed per stat then capped. */
  tunes: readonly TuneEffect[];
  /** F-13 driver level (profiles.level); 0 = no bonus. */
  driverLevel: number;
}

const STAT_KEYS: ReadonlyArray<keyof BaseStats> = ['acceleration', 'topSpeed', 'handling'];

/** Applies the paid + level influence with the D-075 cap. Never lowers a stat; never raises one
 *  by more than MAX_PAID_LEVEL_INFLUENCE; never above 100. */
export function applyInfluence(base: BaseStats, input: InfluenceInput): BaseStats {
  const level = clamp(
    Math.max(0, Math.floor(input.driverLevel)) * LEVEL_INFLUENCE_PER_LEVEL,
    0,
    MAX_LEVEL_INFLUENCE
  );
  const out = { ...base };
  for (const k of STAT_KEYS) {
    const tune = clamp(
      input.tunes.reduce((a, t) => a + Math.max(0, t[k] ?? 0), 0),
      0,
      MAX_TUNE_INFLUENCE
    );
    const combined = clamp(tune + level, 0, MAX_PAID_LEVEL_INFLUENCE);
    out[k] = round1(clamp(base[k] * (1 + combined), 0, 100));
  }
  return out;
}

/** Composite 0–100 performance score the W08 simulation will race on (before seeded luck). */
export function raceScore(stats: BaseStats): number {
  return round1(0.4 * stats.acceleration + 0.35 * stats.topSpeed + 0.25 * stats.handling);
}
