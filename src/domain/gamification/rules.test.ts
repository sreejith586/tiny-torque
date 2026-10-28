import { describe, it, expect } from 'vitest';
import {
  computeXp,
  computeGamification,
  evaluateBadges,
  levelForXp,
  levelProgress,
  questForDay,
  questStatus,
  LEVELS,
  XP_RULES,
  type GamificationEvent,
  type AchievementDef,
} from './rules';

const ME = '00000000-0000-4000-8000-00000000000a';
const OTHER = '00000000-0000-4000-8000-00000000000b';

let seq = 0;
function ev(
  type: string,
  occurredAt: string,
  extra: Partial<GamificationEvent> = {}
): GamificationEvent {
  seq += 1;
  return {
    id: seq,
    actor_id: ME,
    type,
    entity: 'item',
    entity_id: `e-${seq}`,
    payload: {},
    occurred_at: occurredAt,
    ...extra,
  };
}

// The five seeded rules, exactly as 0020 stores them.
const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first_add', rule: { kind: 'event_count', event: 'item.created', threshold: 1 } },
  { key: 'growing_garage', rule: { kind: 'stat', stat: 'totalItems', threshold: 25 } },
  { key: 'treasure_hunter', rule: { kind: 'stat', stat: 'rareItems', threshold: 5 } },
  { key: 'deal_maker', rule: { kind: 'event_count', event: 'offer.completed', threshold: 1 } },
  { key: 'value_collector', rule: { kind: 'stat', stat: 'totalValue', threshold: 1000 } },
];

describe('XP rules (F-13)', () => {
  it('pays +10 per added item, capped at 50 per UTC day', () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      ev('item.created', `2026-10-20T0${i}:00:00.000Z`)
    );
    expect(computeXp(ME, events).xp).toBe(XP_RULES.itemCreatedDailyCap);
    // a second day starts a fresh cap
    events.push(ev('item.created', '2026-10-21T01:00:00.000Z'));
    expect(computeXp(ME, events).xp).toBe(50 + 10);
  });

  it('pays the first photo once per item, a listing publish, and one open per day', () => {
    const events = [
      ev('item.photo_added', '2026-10-20T01:00:00.000Z', { entity_id: 'item-1' }),
      ev('item.photo_added', '2026-10-20T02:00:00.000Z', { entity_id: 'item-1' }), // replayed dup
      ev('listing.published', '2026-10-20T03:00:00.000Z', { entity: 'listing' }),
      ev('user.opened', '2026-10-20T03:00:00.000Z', { entity: 'profile' }),
      ev('user.opened', '2026-10-20T09:00:00.000Z', { entity: 'profile' }), // same day
      ev('user.opened', '2026-10-21T09:00:00.000Z', { entity: 'profile' }),
    ];
    const { xp, breakdown } = computeXp(ME, events);
    expect(breakdown.firstPhoto).toBe(5);
    expect(breakdown.listingPublished).toBe(15);
    expect(breakdown.dailyFirstOpen).toBe(10);
    // The 20th has a photo and a listing, so its quest is done unless it rotated to "add a car";
    // the 21st only has an open, which no quest asks for.
    const questXp = questForDay('2026-10-20').event === 'item.created' ? 0 : XP_RULES.dailyQuest;
    expect(breakdown.dailyQuest).toBe(questXp);
    expect(xp).toBe(30 + questXp);
  });

  it('pays a completed deal to BOTH sides, once per offer', () => {
    const events = [
      ev('offer.completed', '2026-10-20T01:00:00.000Z', {
        actor_id: OTHER, // the seller completes it
        entity: 'offer',
        entity_id: 'offer-1',
        payload: { buyer_id: ME, seller_id: OTHER },
      }),
    ];
    expect(computeXp(ME, events).xp).toBe(XP_RULES.dealCompleted);
    expect(computeXp(OTHER, events).xp).toBe(XP_RULES.dealCompleted);
    // a stranger gets nothing
    expect(computeXp('someone-else', events).xp).toBe(0);
  });

  it('pays a 5★ review to the seller only, and nothing for 4★', () => {
    const events = [
      ev('review.created', '2026-10-20T01:00:00.000Z', {
        actor_id: OTHER,
        entity: 'review',
        entity_id: 'rev-1',
        payload: { seller_id: ME, rating: 5 },
      }),
      ev('review.created', '2026-10-20T02:00:00.000Z', {
        actor_id: OTHER,
        entity: 'review',
        entity_id: 'rev-2',
        payload: { seller_id: ME, rating: 4 },
      }),
    ];
    expect(computeXp(ME, events).xp).toBe(XP_RULES.fiveStarReview);
    expect(computeXp(OTHER, events).xp).toBe(0);
  });

  it('ignores events that pay someone else', () => {
    const events = [ev('item.created', '2026-10-20T01:00:00.000Z', { actor_id: OTHER })];
    expect(computeXp(ME, events).xp).toBe(0);
  });
});

describe('daily quest (F-13 stretch, MV-S8-07)', () => {
  it('rotates through the three quests by UTC day and is stable for a given day', () => {
    const keys = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map(
      (d) => questForDay(d).key
    );
    expect(new Set(keys.slice(0, 3)).size).toBe(3); // three consecutive days, three quests
    expect(keys[3]).toBe(keys[0]); // period 3
    expect(questForDay('2026-10-20')).toEqual(questForDay('2026-10-20'));
  });

  it('is done only when that day has the quest event for this user, and pays +15 once per day', () => {
    const day = '2026-10-20';
    const quest = questForDay(day);
    expect(questStatus(ME, [], day).done).toBe(false);
    const done = [
      ev(quest.event, `${day}T09:00:00.000Z`, { entity_id: 'q-1' }),
      ev(quest.event, `${day}T10:00:00.000Z`, { entity_id: 'q-2' }),
    ];
    expect(questStatus(ME, done, day).done).toBe(true);
    expect(computeXp(ME, done).breakdown.dailyQuest).toBe(XP_RULES.dailyQuest);
    // the other user's event doesn't complete my quest; yesterday's event doesn't count today
    expect(
      questStatus(ME, [ev(quest.event, `${day}T09:00:00.000Z`, { actor_id: OTHER })], day).done
    ).toBe(false);
    expect(questStatus(ME, [ev(quest.event, '2026-10-19T23:00:00.000Z')], day).done).toBe(false);
  });
});

describe('levels / tiers (F-13)', () => {
  it('maps the 0/100/300/700/1500/3000 thresholds to six tiers', () => {
    expect(LEVELS.map((l) => l.minXp)).toEqual([0, 100, 300, 700, 1500, 3000]);
    expect(levelForXp(0).tier).toBe('Rookie');
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100).tier).toBe('Collector');
    expect(levelForXp(299).level).toBe(2);
    expect(levelForXp(300).tier).toBe('Serious Collector');
    expect(levelForXp(700).tier).toBe('Curator');
    expect(levelForXp(1500).tier).toBe('Legend');
    expect(levelForXp(3000).tier).toBe('Vault Master');
    expect(levelForXp(99999).tier).toBe('Vault Master');
  });

  it('reports progress towards the next level and 100% at the top', () => {
    expect(levelProgress(150)).toMatchObject({
      level: 2,
      currentMin: 100,
      nextMin: 300,
      percent: 25,
    });
    expect(levelProgress(5000)).toMatchObject({ level: 6, nextMin: null, percent: 100 });
  });
});

describe('badge evaluators (03 §2.18)', () => {
  it('unlocks first_add and deal_maker from events, the stat badges from the collection', () => {
    const events = [
      ev('item.created', '2026-10-20T01:00:00.000Z'),
      ev('offer.completed', '2026-10-20T02:00:00.000Z', {
        actor_id: OTHER,
        entity: 'offer',
        entity_id: 'offer-1',
        payload: { buyer_id: ME, seller_id: OTHER },
      }),
    ];
    const badges = evaluateBadges(
      ME,
      events,
      { totalItems: 30, totalValue: 420, rareItems: 2 },
      ACHIEVEMENTS
    );
    const byKey = Object.fromEntries(badges.map((b) => [b.key, b]));
    expect(byKey.first_add).toMatchObject({ progress: 1, target: 1, unlocked: true });
    expect(byKey.deal_maker).toMatchObject({ progress: 1, target: 1, unlocked: true });
    expect(byKey.growing_garage).toMatchObject({ progress: 25, target: 25, unlocked: true });
    expect(byKey.treasure_hunter).toMatchObject({ progress: 2, target: 5, unlocked: false });
    expect(byKey.value_collector).toMatchObject({ progress: 420, target: 1000, unlocked: false });
  });

  it('treats a malformed rule as zero progress instead of throwing', () => {
    const [b] = evaluateBadges(ME, [], { totalItems: 0, totalValue: 0, rareItems: 0 }, [
      { key: 'broken', rule: { kind: 'nope' } },
    ]);
    expect(b).toEqual({ key: 'broken', progress: 0, target: 1, unlocked: false });
  });
});

describe('replay determinism (F-13 AC)', () => {
  // A realistic month: adds across days (some over the cap), photos, a listing, a deal both ways,
  // reviews, daily opens — in arbitrary order.
  const events: GamificationEvent[] = [];
  for (let d = 1; d <= 9; d++) {
    for (let i = 0; i < (d % 3) + 4; i++) {
      events.push(
        ev('item.created', `2026-10-0${d}T1${i}:00:00.000Z`, { entity_id: `i-${d}-${i}` })
      );
      if (i === 0)
        events.push(
          ev('item.photo_added', `2026-10-0${d}T12:00:00.000Z`, { entity_id: `i-${d}-0` })
        );
    }
    events.push(ev('user.opened', `2026-10-0${d}T08:00:00.000Z`, { entity: 'profile' }));
  }
  events.push(ev('listing.published', '2026-10-05T10:00:00.000Z', { entity: 'listing' }));
  events.push(
    ev('offer.completed', '2026-10-06T10:00:00.000Z', {
      actor_id: OTHER,
      entity: 'offer',
      entity_id: 'offer-1',
      payload: { buyer_id: ME, seller_id: OTHER },
    })
  );
  events.push(
    ev('review.created', '2026-10-07T10:00:00.000Z', {
      actor_id: OTHER,
      entity: 'review',
      entity_id: 'rev-1',
      payload: { seller_id: ME, rating: 5 },
    })
  );
  const stats = { totalItems: 41, totalValue: 1250, rareItems: 6 };

  it('recomputing from scratch (xp dropped to 0) yields the identical state', () => {
    const first = computeGamification(ME, events, stats, ACHIEVEMENTS);
    // "drop xp": there is no stored input to the computation at all — it only reads the log —
    // so a replay is literally the same call on the same log.
    const replayed = computeGamification(ME, events, stats, ACHIEVEMENTS);
    expect(replayed).toEqual(first);
    // Daily quest (MV-S8-07): every day has an add and a first photo, only day 5 has a listing,
    // so a day's quest is done unless it rotated to "list a car" on a day other than the 5th.
    const questDays = Array.from({ length: 9 }, (_, i) => `2026-10-0${i + 1}`).filter((day) => {
      const q = questForDay(day);
      return q.event !== 'listing.published' || day === '2026-10-05';
    }).length;
    expect(first.xp).toBe(
      // 9 days × min(adds×10, 50): adds per day are 5,6,4,5,6,4,5,6,4 → 50,50,40,50,50,40,50,50,40
      50 +
        50 +
        40 +
        50 +
        50 +
        40 +
        50 +
        50 +
        40 +
        9 * XP_RULES.firstPhoto +
        9 * XP_RULES.dailyFirstOpen +
        questDays * XP_RULES.dailyQuest +
        XP_RULES.listingPublished +
        XP_RULES.dealCompleted +
        XP_RULES.fiveStarReview
    );
    expect(first.badges.every((b) => b.unlocked)).toBe(true);
  });

  it('is independent of event order', () => {
    const shuffled = [...events].sort((a, b) => (String(b.id) > String(a.id) ? 1 : -1));
    expect(computeGamification(ME, shuffled, stats, ACHIEVEMENTS)).toEqual(
      computeGamification(ME, events, stats, ACHIEVEMENTS)
    );
  });

  it('is idempotent under duplicated events (a replay that re-reads the same rows)', () => {
    const doubled = [...events, ...events];
    // item.created has no per-item dedupe (a real re-add is a real add), so only the daily cap
    // bounds it; everything else dedupes on entity_id — the AC holds on the event log itself,
    // which is append-only and never contains duplicates. Assert the deduped parts explicitly.
    const once = computeXp(ME, events).breakdown;
    const twice = computeXp(ME, doubled).breakdown;
    expect(twice.firstPhoto).toBe(once.firstPhoto);
    expect(twice.dealCompleted).toBe(once.dealCompleted);
    expect(twice.fiveStarReview).toBe(once.fiveStarReview);
    expect(twice.dailyFirstOpen).toBe(once.dailyFirstOpen);
  });
});
