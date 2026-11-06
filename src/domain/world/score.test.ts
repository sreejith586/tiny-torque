import { describe, it, expect } from 'vitest';
import {
  garageScore,
  rarityWeight,
  scoreBreakdown,
  scoreFromEvents,
  type ScoreEvent,
} from './score';

const G = '75000000-0000-0000-0000-00000000000a';
const V = '75000000-0000-0000-0000-00000000000b';

// The same figures pgTAP 0027 pins on the SQL side.
describe('world.garageScore (07 §2.1, D-091 weights — mirrors world_garage_score_value)', () => {
  it('1 rare car + 1 decor at level 1 = 25', () => {
    expect(
      garageScore({
        displayedRarities: ['rare'],
        decorCount: 1,
        trophyCount: 0,
        kudosCount: 0,
        visitCount: 0,
        level: 1,
      })
    ).toBe(25);
  });

  it('a visit (+1) and kudos (+2) make 28; losing the car leaves 8', () => {
    const base = { displayedRarities: ['rare'], decorCount: 1, trophyCount: 0, level: 1 };
    expect(garageScore({ ...base, kudosCount: 1, visitCount: 1 })).toBe(28);
    expect(garageScore({ ...base, displayedRarities: [], kudosCount: 1, visitCount: 1 })).toBe(8);
  });

  it('weights rarity, trophies and level steps', () => {
    expect(rarityWeight('chase')).toBe(5);
    expect(rarityWeight('common')).toBe(0);
    expect(rarityWeight(null)).toBe(0);
    expect(rarityWeight('made-up')).toBe(0);
    expect(
      garageScore({
        displayedRarities: ['chase', null],
        decorCount: 0,
        trophyCount: 2,
        kudosCount: 0,
        visitCount: 0,
        level: 3,
      })
    ).toBe(2 * 10 + 5 * 5 + 2 * 15 + 2 * 20);
  });

  it('never goes negative and treats level 0 as level 1', () => {
    expect(
      garageScore({
        displayedRarities: [],
        decorCount: 0,
        trophyCount: 0,
        kudosCount: 0,
        visitCount: 0,
        level: 0,
      })
    ).toBe(0);
  });
});

describe('world.scoreFromEvents — replay determinism (F-26 AC: same values after drop + replay)', () => {
  const state = { displayedRarities: ['rare'], decorCount: 1, level: 1 };
  const events: ScoreEvent[] = [
    { id: 1, type: 'world.visited', actor_id: V, entity_id: G },
    { id: 2, type: 'world.kudos_given', actor_id: V, entity_id: G },
    { id: 3, type: 'world.kudos_given', actor_id: V, entity_id: V }, // someone else's garage
    { id: 4, type: 'world.item_bought', actor_id: G, entity_id: null, payload: { kind: 'decor' } },
    {
      id: 5,
      type: 'world.item_granted',
      actor_id: G,
      entity_id: null,
      payload: { kind: 'trophy' },
    },
    { id: 6, type: 'quest.completed', actor_id: G, entity_id: null },
  ];

  it('folds visits, kudos and trophies for the garage only', () => {
    expect(scoreFromEvents(G, state, events)).toBe(25 + 1 + 2 + 15);
  });

  it('is independent of event order and of replayed duplicates', () => {
    const expected = scoreFromEvents(G, state, events);
    for (let seed = 1; seed <= 20; seed++) {
      const shuffled = [...events].sort(() => ((seed * 9301 + 49297) % 233280) / 233280 - 0.5);
      expect(scoreFromEvents(G, state, shuffled)).toBe(expected);
    }
    expect(scoreFromEvents(G, state, [...events, ...events])).toBe(expected);
  });

  it('breakdown names the parts that are present', () => {
    expect(
      scoreBreakdown({
        displayedRarities: ['rare', 'common'],
        decorCount: 1,
        trophyCount: 0,
        kudosCount: 2,
        visitCount: 1,
        level: 2,
      })
    ).toEqual(['2 cars on show', '1 decor', '2 kudos', '1 visit']);
  });
});
