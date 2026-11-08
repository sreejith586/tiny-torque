import { describe, it, expect } from 'vitest';
import {
  addDays,
  computeQuestProgress,
  computeSeasonPoints,
  loginStreak,
  periodEnd,
  periodStart,
  questProgress,
  questSetIndex,
  questsOnOffer,
  type QuestDef,
  type QuestEvent,
} from './rules';

const ME = '00000000-0000-4000-8000-00000000000a';
const OTHER = '00000000-0000-4000-8000-00000000000b';

// The twelve seeded rows of 0014_quests_seasons, as the rules see them.
const Q = (
  key: string,
  cadence: QuestDef['cadence'],
  sort_order: number,
  event: string,
  threshold: number,
  reward_xp: number,
  reward_credits: number,
  kind: 'event_count' | 'event_days' = 'event_count'
): QuestDef => ({
  key,
  cadence,
  sort_order,
  active: true,
  rule: { kind, event, threshold },
  reward_xp,
  reward_credits,
});
const QUESTS: QuestDef[] = [
  Q('visit_garage', 'daily', 1, 'world.visited', 1, 10, 2),
  Q('give_kudos', 'daily', 2, 'world.kudos_given', 1, 10, 2),
  Q('sign_guestbook', 'daily', 3, 'world.guestbook_posted', 1, 10, 2),
  Q('visit_three', 'daily', 4, 'world.visited', 3, 15, 2),
  Q('arrange_garage', 'daily', 5, 'world.layout_saved', 1, 10, 2),
  Q('add_car', 'daily', 6, 'item.created', 1, 10, 2),
  Q('weekly_visits', 'weekly', 1, 'world.visited', 10, 40, 8),
  Q('weekly_kudos', 'weekly', 2, 'world.kudos_given', 5, 40, 8),
  Q('weekly_open_days', 'weekly', 3, 'user.opened', 5, 40, 8, 'event_days'),
  Q('weekly_guestbook', 'weekly', 4, 'world.guestbook_posted', 3, 40, 8),
  Q('weekly_add_cars', 'weekly', 5, 'item.created', 3, 40, 8),
  Q('weekly_garage_update', 'weekly', 6, 'world.garage_updated', 1, 30, 8),
];

let seq = 0;
function ev(type: string, occurredAt: string, actor: string = ME): QuestEvent {
  seq += 1;
  return { id: seq, actor_id: actor, type, occurred_at: occurredAt };
}

/** Fisher–Yates with a fixed seed so a failure reproduces. */
function shuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe('periods and rotation (the SQL twins: quest_period_start / quest_set_index)', () => {
  it("daily period = UTC day, weekly period = that week's Monday", () => {
    expect(periodStart('daily', '2026-11-06T23:59:59.000Z')).toBe('2026-11-06');
    expect(periodStart('weekly', '2026-11-06T12:00:00.000Z')).toBe('2026-11-02'); // Friday → Monday
    expect(periodStart('weekly', '2026-11-08T12:00:00.000Z')).toBe('2026-11-02'); // Sunday → same Monday
    expect(periodStart('weekly', '2026-11-09T00:00:00.000Z')).toBe('2026-11-09'); // Monday → itself
    expect(periodEnd('daily', '2026-11-06')).toBe('2026-11-07');
    expect(periodEnd('weekly', '2026-11-02')).toBe('2026-11-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('matches the dates pgTAP 0026 pins for the SQL rotation', () => {
    expect(questSetIndex('daily', '2026-01-05')).toBe(0);
    expect(questSetIndex('daily', '2026-01-06')).toBe(1);
    expect(questSetIndex('weekly', '2026-01-12')).toBe(1);
    expect(questSetIndex('weekly', '2026-01-19')).toBe(0);
    expect(questSetIndex('daily', '2026-01-04')).toBe(1); // before the epoch, still 0/1
  });

  it('offers 3 daily + 3 weekly, rows 1–3 or 4–6 by period parity', () => {
    const jan5 = questsOnOffer(QUESTS, '2026-01-05T12:00:00.000Z');
    expect(jan5.filter((q) => q.cadence === 'daily').map((q) => q.key)).toEqual([
      'visit_garage',
      'give_kudos',
      'sign_guestbook',
    ]);
    expect(jan5.filter((q) => q.cadence === 'weekly').map((q) => q.key)).toEqual([
      'weekly_visits',
      'weekly_kudos',
      'weekly_open_days',
    ]);
    const jan12 = questsOnOffer(QUESTS, '2026-01-12T12:00:00.000Z');
    expect(jan12.filter((q) => q.cadence === 'weekly').map((q) => q.key)).toEqual([
      'weekly_guestbook',
      'weekly_add_cars',
      'weekly_garage_update',
    ]);
    expect(jan12.filter((q) => q.cadence === 'daily').map((q) => q.key)).toEqual([
      'visit_three',
      'arrange_garage',
      'add_car',
    ]);
    expect(jan5[0]).toMatchObject({ period_start: '2026-01-05', period_end: '2026-01-06' });
    expect(jan5[3]).toMatchObject({ period_start: '2026-01-05', period_end: '2026-01-12' });
  });

  it('skips inactive quests', () => {
    const quests = QUESTS.map((q) => (q.key === 'visit_garage' ? { ...q, active: false } : q));
    expect(questsOnOffer(quests, '2026-01-05T12:00:00.000Z').map((q) => q.key)).not.toContain(
      'visit_garage'
    );
  });
});

describe('quest progress (F-26)', () => {
  const offered = questsOnOffer(QUESTS, '2026-01-06T12:00:00.000Z'); // daily set 1: visit_three ×3
  const visitThree = offered.find((q) => q.key === 'visit_three')!;

  it('counts own events of the type inside the period, clamps, and dates the completion', () => {
    const events = [
      ev('world.visited', '2026-01-06T08:00:00.000Z'),
      ev('world.visited', '2026-01-06T09:00:00.000Z'),
      ev('world.visited', '2026-01-06T10:00:00.000Z'),
      ev('world.visited', '2026-01-06T11:00:00.000Z'), // past the threshold: clamped
      ev('world.visited', '2026-01-05T23:59:59.000Z'), // yesterday: another period
      ev('world.visited', '2026-01-06T07:00:00.000Z', OTHER), // someone else
      ev('world.kudos_given', '2026-01-06T07:30:00.000Z'), // another rule
    ];
    expect(questProgress(ME, visitThree, events)).toEqual({
      quest_key: 'visit_three',
      period_start: '2026-01-06',
      progress: 3,
      completed_at: '2026-01-06T10:00:00.000Z',
    });
  });

  it('returns null before the first matching event (the consumer writes no row either)', () => {
    expect(questProgress(ME, visitThree, [ev('item.created', '2026-01-06T08:00:00.000Z')])).toBe(
      null
    );
  });

  it("event_days counts distinct UTC days and completes on the threshold-th day's first event", () => {
    const openDays = questsOnOffer(QUESTS, '2026-01-05T12:00:00.000Z').find(
      (q) => q.key === 'weekly_open_days'
    )!;
    const events = [
      ev('user.opened', '2026-01-05T06:00:00.000Z'),
      ev('user.opened', '2026-01-05T18:00:00.000Z'), // same day twice
      ev('user.opened', '2026-01-06T06:00:00.000Z'),
      ev('user.opened', '2026-01-07T06:00:00.000Z'),
      ev('user.opened', '2026-01-09T06:00:00.000Z'),
    ];
    expect(questProgress(ME, openDays, events)).toMatchObject({ progress: 4, completed_at: null });
    const done = questProgress(ME, openDays, [
      ...events,
      ev('user.opened', '2026-01-10T21:00:00.000Z'),
      ev('user.opened', '2026-01-10T05:00:00.000Z'),
    ]);
    expect(done).toMatchObject({ progress: 5, completed_at: '2026-01-10T05:00:00.000Z' });
  });

  it('is deterministic and order-independent: shuffled events replay to the stored rows', () => {
    const at = '2026-01-06T20:00:00.000Z';
    const events: QuestEvent[] = [
      ev('user.opened', '2026-01-05T07:00:00.000Z'),
      ev('user.opened', '2026-01-06T07:00:00.000Z'),
      ev('world.visited', '2026-01-05T08:00:00.000Z'),
      ev('world.visited', '2026-01-06T08:00:00.000Z'),
      ev('world.visited', '2026-01-06T08:30:00.000Z'),
      ev('world.visited', '2026-01-06T09:00:00.000Z'),
      ev('world.layout_saved', '2026-01-06T10:00:00.000Z'),
      ev('world.kudos_given', '2026-01-06T10:30:00.000Z'),
      ev('world.kudos_given', '2026-01-06T10:31:00.000Z'),
      ev('item.created', '2026-01-04T10:00:00.000Z'), // last week: out of both periods
      ev('world.visited', '2026-01-06T09:30:00.000Z', OTHER),
    ];
    // What the DB consumer holds after those events (0026 pins the same arithmetic in SQL).
    const stored = [
      {
        quest_key: 'visit_three',
        period_start: '2026-01-06',
        progress: 3,
        completed_at: '2026-01-06T09:00:00.000Z',
      },
      {
        quest_key: 'arrange_garage',
        period_start: '2026-01-06',
        progress: 1,
        completed_at: '2026-01-06T10:00:00.000Z',
      },
      { quest_key: 'weekly_visits', period_start: '2026-01-05', progress: 4, completed_at: null },
      { quest_key: 'weekly_kudos', period_start: '2026-01-05', progress: 2, completed_at: null },
      {
        quest_key: 'weekly_open_days',
        period_start: '2026-01-05',
        progress: 2,
        completed_at: null,
      },
    ];
    const sortRows = <T extends { quest_key: string }>(rows: T[]) =>
      [...rows].sort((a, b) => a.quest_key.localeCompare(b.quest_key));

    const baseline = computeQuestProgress(ME, QUESTS, events, at);
    expect(sortRows(baseline)).toEqual(sortRows(stored));
    for (const seed of [1, 7, 42, 1337, 99991]) {
      expect(
        sortRows(computeQuestProgress(ME, shuffle(QUESTS, seed), shuffle(events, seed), at))
      ).toEqual(sortRows(stored));
    }
  });

  it('season points = Σ reward_xp of quests completed inside the window', () => {
    const progress = [
      {
        quest_key: 'visit_three',
        period_start: '2026-01-06',
        progress: 3,
        completed_at: '2026-01-06T09:00:00.000Z',
      },
      {
        quest_key: 'arrange_garage',
        period_start: '2026-01-06',
        progress: 1,
        completed_at: '2026-01-06T10:00:00.000Z',
      },
      { quest_key: 'weekly_visits', period_start: '2026-01-05', progress: 4, completed_at: null },
      {
        quest_key: 'add_car',
        period_start: '2025-12-30',
        progress: 1,
        completed_at: '2025-12-30T10:00:00.000Z',
      },
    ];
    const seasons = [
      { id: 's1', starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-03-01T00:00:00.000Z' },
      { id: 's0', starts_at: '2025-11-01T00:00:00.000Z', ends_at: '2026-01-01T00:00:00.000Z' },
      { id: 'empty', starts_at: '2026-06-01T00:00:00.000Z', ends_at: '2026-08-01T00:00:00.000Z' },
    ];
    expect(computeSeasonPoints(progress, QUESTS, seasons)).toEqual([
      { season_id: 's1', points: 25 },
      { season_id: 's0', points: 10 },
    ]);
  });

  it('login streak counts consecutive UTC days ending today', () => {
    const events = [
      ev('user.opened', '2026-01-01T07:00:00.000Z'),
      ev('user.opened', '2026-01-04T07:00:00.000Z'),
      ev('user.opened', '2026-01-05T07:00:00.000Z'),
      ev('user.opened', '2026-01-06T07:00:00.000Z'),
      ev('user.opened', '2026-01-06T20:00:00.000Z'),
      ev('user.opened', '2026-01-06T09:00:00.000Z', OTHER),
    ];
    expect(loginStreak(ME, events, '2026-01-06')).toBe(3);
    expect(loginStreak(ME, events, '2026-01-07')).toBe(0);
    expect(loginStreak(ME, events, '2026-01-01')).toBe(1);
  });
});
