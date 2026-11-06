import { describe, it, expect } from 'vitest';
import {
  applyRollover,
  daysLeft,
  milestoneKey,
  nextMilestone,
  parseSeasonTrack,
  rolloverPlan,
  trackPercent,
  trackStatus,
  type SeasonWindowRow,
} from './season';

const SEASON = '00000000-0000-4000-8000-00000000f001';
const ME = '75000000-0000-0000-0000-00000000000d';

// The founders' track as 0014c seeds it (PLACEHOLDER numbers).
const TRACK = parseSeasonTrack([
  { points: 50, reward_credits: 5, label: 'Warm-up' },
  { points: 150, reward_credits: 10, label: 'On the road' },
  {
    points: 300,
    reward_credits: 25,
    label: 'Season finisher',
    reward_item_sku: 'trophy_season_finisher',
  },
]);

describe('quests.season — track (F-26, D-091)', () => {
  it('parses the seeded track and ignores malformed rows', () => {
    expect(TRACK).toHaveLength(3);
    expect(TRACK[2]!.reward_item_sku).toBe('trophy_season_finisher');
    expect(parseSeasonTrack(null)).toEqual([]);
    expect(parseSeasonTrack([{ points: -1 }])).toEqual([]);
    expect(parseSeasonTrack('nope')).toEqual([]);
  });

  it('uses the SQL key shape (season:<id>:<index1>:<user>)', () => {
    expect(milestoneKey(SEASON, 2, ME)).toBe(`season:${SEASON}:2:${ME}`);
  });

  it('marks reached / paid / remaining per milestone', () => {
    const paid = new Set([milestoneKey(SEASON, 1, ME)]);
    const st = trackStatus(TRACK, 120, paid, SEASON, ME);
    expect(st.map((s) => [s.reached, s.paid, s.remaining])).toEqual([
      [true, true, 0],
      [false, false, 30],
      [false, false, 180],
    ]);
    expect(nextMilestone(st)?.index).toBe(2);
    // 120 of the 50 → 150 span = 70 %
    expect(trackPercent(st, 120)).toBe(70);
  });

  it('a reached-but-unpaid milestone (frozen / no headroom) shows as reached, not paid', () => {
    const st = trackStatus(TRACK, 60, new Set(), SEASON, ME);
    expect(st[0]).toMatchObject({ reached: true, paid: false });
  });

  it('a finished track has no next milestone and 100 %', () => {
    const st = trackStatus(TRACK, 300, new Set(), SEASON, ME);
    expect(nextMilestone(st)).toBeNull();
    expect(trackPercent(st, 300)).toBe(100);
    expect(trackPercent([], 10)).toBe(0);
  });

  it('counts whole days left', () => {
    expect(daysLeft('2027-01-05T00:00:00.000Z', new Date('2026-12-30T12:00:00.000Z'))).toBe(6);
    expect(daysLeft('2026-01-01T00:00:00.000Z', new Date('2026-12-30T12:00:00.000Z'))).toBe(0);
  });
});

describe('quests.season — rollover determinism (mirrors rollover_season, pgTAP 0027)', () => {
  const seasons: SeasonWindowRow[] = [
    {
      id: 'f4',
      starts_at: '2026-09-01T00:00:00Z',
      ends_at: '2026-12-31T00:00:00Z',
      announced_at: null,
      closed_at: null,
    },
    {
      id: 'f3',
      starts_at: '2026-08-01T00:00:00Z',
      ends_at: '2026-09-15T00:00:00Z',
      announced_at: null,
      closed_at: null,
    },
    {
      id: 'f1',
      starts_at: '2099-01-01T00:00:00Z',
      ends_at: '2099-02-01T00:00:00Z',
      announced_at: null,
      closed_at: null,
    },
    {
      id: 'f0',
      starts_at: '2026-11-10T00:00:00Z',
      ends_at: '2027-01-05T00:00:00Z',
      announced_at: null,
      closed_at: null,
    },
  ];
  const at = new Date('2026-10-01T00:00:00Z');

  it('announces the two seasons that started and closes the one that ended, in start order', () => {
    expect(rolloverPlan(seasons, at)).toEqual({ start: ['f3', 'f4'], end: ['f3'] });
  });

  it('is independent of row order', () => {
    const reversed = [...seasons].reverse();
    expect(rolloverPlan(reversed, at)).toEqual(rolloverPlan(seasons, at));
  });

  it('a second run on the stamped rows does nothing (idempotent)', () => {
    const stamped = applyRollover(seasons, rolloverPlan(seasons, at), at);
    expect(rolloverPlan(stamped, at)).toEqual({ start: [], end: [] });
    // later, the founders season starts and f4 ends — each exactly once
    const later = new Date('2027-01-01T00:00:00Z');
    expect(rolloverPlan(stamped, later)).toEqual({ start: ['f0'], end: ['f4'] });
    const stamped2 = applyRollover(stamped, rolloverPlan(stamped, later), later);
    expect(rolloverPlan(stamped2, later)).toEqual({ start: [], end: [] });
  });
});
