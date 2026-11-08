import { describe, it, expect } from 'vitest';
import {
  ARCHETYPES,
  ARCHETYPE_STATS,
  MAX_LEVEL_INFLUENCE,
  MAX_PAID_LEVEL_INFLUENCE,
  MAX_TUNE_INFLUENCE,
  STATS_VERSION,
  applyInfluence,
  baseStatsForModel,
  baseStatsFromSpecs,
  raceScore,
} from './stats';
import type { BaseStats } from './stats';
import type { CarSpecs } from '@/domain/catalog/specs';

const R34: CarSpecs = {
  power_kw: 206,
  torque_nm: 392,
  weight_kg: 1560,
  zero_to_100_s: 4.9,
  top_speed_kmh: 250,
  drivetrain: 'awd',
  drag_cd: 0.34,
  model_year: 1999,
};

const inRange = (s: BaseStats) =>
  [s.acceleration, s.topSpeed, s.handling].every((v) => v >= 0 && v <= 100);

describe('baseStatsFromSpecs — formula v1', () => {
  it('is pinned to STATS_VERSION 1', () => {
    expect(STATS_VERSION).toBe(1);
    expect(baseStatsFromSpecs(R34).version).toBe(1);
  });

  it('computes the documented numbers for a full real-car spec (R34)', () => {
    const s = baseStatsFromSpecs(R34, 'sports');
    expect(s.source).toBe('specs');
    expect(s.archetype).toBe('sports');
    expect(s.acceleration).toBe(74); // lin(4.9 s) = 71 + awd launch nudge 3
    expect(s.topSpeed).toBe(46.4); // (250 − 120) / 280
    expect(s.handling).toBe(57.1); // 0.5·49.2 (weight) + 0.25·55 (cd) + 0.25·75 (awd)
    expect(raceScore(s)).toBe(60.1);
  });

  it('empty specs → the archetype verbatim; default archetype is neutral', () => {
    for (const a of ARCHETYPES) {
      const s = baseStatsFromSpecs({}, a);
      expect(s.source).toBe('archetype');
      expect({ acceleration: s.acceleration, topSpeed: s.topSpeed, handling: s.handling }).toEqual(
        ARCHETYPE_STATS[a]
      );
    }
    expect(baseStatsFromSpecs({})).toMatchObject({
      archetype: 'neutral',
      ...ARCHETYPE_STATS.neutral,
    });
  });

  it('partial specs fall back per stat (mixed) and estimate top speed from power + drag', () => {
    const onlyDrivetrain = baseStatsFromSpecs({ drivetrain: 'rwd' }, 'muscle');
    expect(onlyDrivetrain.source).toBe('mixed');
    expect(onlyDrivetrain.acceleration).toBe(ARCHETYPE_STATS.muscle.acceleration);
    expect(onlyDrivetrain.topSpeed).toBe(ARCHETYPE_STATS.muscle.topSpeed);
    expect(onlyDrivetrain.handling).toBe(60); // rwd alone

    const powerOnly = baseStatsFromSpecs({ power_kw: 206, weight_kg: 1560 });
    expect(powerOnly.source).toBe('specs');
    // specific power 132 kW/t → (132 − 40) / 360
    expect(powerOnly.acceleration).toBeCloseTo(25.6, 1);
    // aero estimate with cd 0.33: ≈ 279 km/h → (279 − 120) / 280
    expect(powerOnly.topSpeed).toBeGreaterThan(50);
    expect(powerOnly.topSpeed).toBeLessThan(62);
    expect(powerOnly.handling).toBeCloseTo(49.2, 1); // weight only
  });

  it('is monotonic in the obvious directions and clamps to 0–100', () => {
    const quick = baseStatsFromSpecs({ zero_to_100_s: 2.5 });
    const slow = baseStatsFromSpecs({ zero_to_100_s: 9 });
    expect(quick.acceleration).toBeGreaterThan(slow.acceleration);

    const fast = baseStatsFromSpecs({ top_speed_kmh: 350 });
    const sluggish = baseStatsFromSpecs({ top_speed_kmh: 160 });
    expect(fast.topSpeed).toBeGreaterThan(sluggish.topSpeed);

    const light = baseStatsFromSpecs({ weight_kg: 1000 });
    const heavy = baseStatsFromSpecs({ weight_kg: 2000 });
    expect(light.handling).toBeGreaterThan(heavy.handling);

    const extreme = baseStatsFromSpecs({
      zero_to_100_s: 1,
      top_speed_kmh: 600,
      weight_kg: 300,
      drag_cd: 0.1,
      drivetrain: 'awd',
    });
    // handling tops out at 93.8: weight + cd saturate, awd's fixed 75 holds the last quarter back
    expect(extreme).toMatchObject({ acceleration: 100, topSpeed: 100, handling: 93.8 });
    const tractor = baseStatsFromSpecs({
      zero_to_100_s: 60,
      top_speed_kmh: 30,
      weight_kg: 10000,
      drag_cd: 1.5,
      drivetrain: 'fwd',
    });
    expect(tractor).toMatchObject({ acceleration: 0, topSpeed: 0, handling: 11.3 });
    expect(inRange(extreme) && inRange(tractor)).toBe(true);
  });

  it('is deterministic — the replay contract (D-075)', () => {
    expect(baseStatsFromSpecs(R34, 'exotic')).toEqual(baseStatsFromSpecs({ ...R34 }, 'exotic'));
  });
});

describe('baseStatsForModel — only verified specs race (D-008)', () => {
  it('uses verified specs, ignores a pending proposal, archetype when unmatched', () => {
    expect(baseStatsForModel({ specs: R34, verified: true }, 'sports').source).toBe('specs');
    expect(baseStatsForModel({ specs: R34, verified: false }, 'sports')).toEqual(
      baseStatsFromSpecs({}, 'sports')
    );
    expect(baseStatsForModel(null)).toEqual(baseStatsFromSpecs({}, 'neutral'));
  });
});

describe('applyInfluence — D-075 cap', () => {
  const bases: BaseStats[] = [
    ...ARCHETYPES.map((a) => ARCHETYPE_STATS[a]),
    baseStatsFromSpecs(R34, 'sports'),
    { acceleration: 1, topSpeed: 99, handling: 50 },
  ];
  const absurdTunes = Array.from({ length: 6 }, () => ({
    acceleration: 0.5,
    topSpeed: 0.5,
    handling: 0.5,
  }));

  it('tunes + driver level together move every stat and the race score by ≤ 10 %', () => {
    expect(MAX_TUNE_INFLUENCE + MAX_LEVEL_INFLUENCE).toBeLessThanOrEqual(MAX_PAID_LEVEL_INFLUENCE);
    for (const base of bases) {
      const boosted = applyInfluence(base, { tunes: absurdTunes, driverLevel: 999 });
      for (const k of ['acceleration', 'topSpeed', 'handling'] as const) {
        expect(boosted[k]).toBeGreaterThanOrEqual(base[k]);
        expect(boosted[k]).toBeLessThanOrEqual(base[k] * (1 + MAX_PAID_LEVEL_INFLUENCE) + 0.05);
        expect(boosted[k]).toBeLessThanOrEqual(100);
      }
      expect(raceScore(boosted)).toBeLessThanOrEqual(
        raceScore(base) * (1 + MAX_PAID_LEVEL_INFLUENCE) + 0.1
      );
    }
  });

  it('each lever alone stays within its own cap; nothing fitted changes nothing', () => {
    const base = ARCHETYPE_STATS.neutral;
    const tunesOnly = applyInfluence(base, { tunes: absurdTunes, driverLevel: 0 });
    const levelOnly = applyInfluence(base, { tunes: [], driverLevel: 999 });
    expect(tunesOnly.acceleration).toBe(50 * (1 + MAX_TUNE_INFLUENCE));
    expect(levelOnly.acceleration).toBe(50 * (1 + MAX_LEVEL_INFLUENCE));
    expect(applyInfluence(base, { tunes: [], driverLevel: 0 })).toEqual(base);
    // a realistic F-13 level 6 is worth 3 %, a negative or fractional level nothing odd
    expect(applyInfluence(base, { tunes: [], driverLevel: 6 }).topSpeed).toBe(51.5);
    expect(applyInfluence(base, { tunes: [], driverLevel: -3 })).toEqual(base);
  });

  it('negative tune effects never lower a stat', () => {
    const base = ARCHETYPE_STATS.exotic;
    expect(applyInfluence(base, { tunes: [{ handling: -0.9 }], driverLevel: 0 })).toEqual(base);
  });
});
