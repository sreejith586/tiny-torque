import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitEvent } from '@/domain/events';
import { getPublicProfile } from '@/domain/identity';
import { listPublicCollectionItems } from '@/domain/garage';
import { EVENT_TYPES } from '@/domain/events/types';
import {
  WorldError,
  buyItem,
  buyLevel,
  getGarageForVisitor,
  getOwnGarage,
  isGarageVisibleTo,
  parseStoredLayout,
  saveLayout,
  updateGarageSettings,
  validateLayout,
} from './service';
import type { Client } from '@/lib/supabase/types';
import type { WorldGarageRow, WorldLevelRow } from './types';

// Mocked repo (D-007: tests never import a repo either — the mock object stands in for it).
const repo = vi.hoisted(() => ({
  getGarage: vi.fn(),
  listLevels: vi.fn(),
  listActiveItems: vi.fn(),
  listInventory: vi.fn(),
  updateGarage: vi.fn(),
  ensureGarage: vi.fn(),
  buyLevel: vi.fn(),
  buyItem: vi.fn(),
}));
vi.mock('./repo', () => repo);
vi.mock('@/domain/events', () => ({ emitEvent: vi.fn() }));
vi.mock('@/domain/identity', () => ({ getPublicProfile: vi.fn() }));
vi.mock('@/domain/garage', () => ({ listPublicCollectionItems: vi.fn() }));

const supabase = {} as Client;
const OWNER = '11111111-1111-4111-8111-111111111111';
const VIEWER = '22222222-2222-4222-8222-222222222222';
const CAR_A = '33333333-3333-4333-8333-333333333333';
const CAR_B = '44444444-4444-4444-8444-444444444444';
const LAMP = '55555555-5555-4555-8555-555555555555';

const LEVELS: WorldLevelRow[] = [
  {
    level: 1,
    name: 'Shed',
    display_slots: 4,
    decor_slots: 2,
    visitor_cap: 10,
    host_cap: 0,
    price: 0,
    min_xp_level: 0,
  },
  {
    level: 2,
    name: 'Garage',
    display_slots: 8,
    decor_slots: 4,
    visitor_cap: 25,
    host_cap: 10,
    price: 40,
    min_xp_level: 1,
  },
];

function garage(over: Partial<WorldGarageRow> = {}): WorldGarageRow {
  return {
    user_id: OWNER,
    level: 1,
    name: "Owner's Garage",
    open_mode: 'public',
    featured_item_id: null,
    theme_item_id: null,
    layout: { version: 1, slots: [], decor: [] },
    score: 0,
    created_at: '2026-10-20T00:00:00.000Z',
    updated_at: '2026-10-20T00:00:00.000Z',
    ...over,
  };
}

const ctx = {
  displaySlots: 4,
  decorSlots: 2,
  publicItemIds: new Set([CAR_A, CAR_B]),
  ownedWorldItemIds: new Set([LAMP]),
};

beforeEach(() => {
  vi.resetAllMocks();
  repo.listLevels.mockResolvedValue(LEVELS);
  repo.listInventory.mockResolvedValue([]);
});

describe('world.validateLayout (07 §6.2)', () => {
  it('accepts a layout within capacity using public cars and owned decor', () => {
    const out = validateLayout(
      {
        version: 1,
        slots: [
          { slot: 0, itemId: CAR_A },
          { slot: 3, itemId: CAR_B },
        ],
        decor: [{ slot: 1, itemId: LAMP }],
      },
      ctx
    );
    expect(out.slots).toHaveLength(2);
  });

  it.each([
    ['layout_invalid', { version: 2, slots: [], decor: [] }],
    ['layout_invalid', { version: 1, slots: [], decor: [], extra: true }],
    [
      'too_many_slots',
      { version: 1, slots: [0, 1, 2, 3, 4].map((s) => ({ slot: s, itemId: CAR_A })), decor: [] },
    ],
    [
      'too_many_decor',
      { version: 1, slots: [], decor: [0, 1, 2].map((s) => ({ slot: s, itemId: LAMP })) },
    ],
    ['slot_out_of_range', { version: 1, slots: [{ slot: 4, itemId: CAR_A }], decor: [] }],
    [
      'duplicate_slot',
      {
        version: 1,
        slots: [
          { slot: 0, itemId: CAR_A },
          { slot: 0, itemId: CAR_B },
        ],
        decor: [],
      },
    ],
    [
      'duplicate_item',
      {
        version: 1,
        slots: [
          { slot: 0, itemId: CAR_A },
          { slot: 1, itemId: CAR_A },
        ],
        decor: [],
      },
    ],
    ['item_not_public', { version: 1, slots: [{ slot: 0, itemId: LAMP }], decor: [] }],
    ['item_not_owned', { version: 1, slots: [], decor: [{ slot: 0, itemId: CAR_A }] }],
  ])('rejects %s', (code, input) => {
    expect(() => validateLayout(input, ctx)).toThrow(new WorldError(code as never));
  });

  it('parseStoredLayout falls back to an empty document for a malformed stored value', () => {
    expect(parseStoredLayout({ garbage: true })).toEqual({ version: 1, slots: [], decor: [] });
    expect(parseStoredLayout(null)).toEqual({ version: 1, slots: [], decor: [] });
  });
});

describe('world.isGarageVisibleTo (mirrors the RLS policy)', () => {
  it('owner always sees their own garage, whatever the mode', () => {
    expect(isGarageVisibleTo({ user_id: OWNER, open_mode: 'invite' }, OWNER)).toBe(true);
  });
  it('public garages are visible to anyone, including anon', () => {
    expect(isGarageVisibleTo({ user_id: OWNER, open_mode: 'public' }, null)).toBe(true);
    expect(isGarageVisibleTo({ user_id: OWNER, open_mode: 'public' }, VIEWER)).toBe(true);
  });
  it('followers-only garages are never visible to anon (RLS decides the follow for signed-in viewers)', () => {
    expect(isGarageVisibleTo({ user_id: OWNER, open_mode: 'followers' }, null)).toBe(false);
    expect(isGarageVisibleTo({ user_id: OWNER, open_mode: 'followers' }, VIEWER)).toBe(true);
  });
  it('invite-only garages are owner-only until W03', () => {
    expect(isGarageVisibleTo({ user_id: OWNER, open_mode: 'invite' }, VIEWER)).toBe(false);
    expect(isGarageVisibleTo({ user_id: OWNER, open_mode: 'invite' }, null)).toBe(false);
  });
});

describe('world.getGarageForVisitor', () => {
  it('returns null for a malformed handle without touching the repo', async () => {
    expect(await getGarageForVisitor(supabase, 'not a handle!', VIEWER)).toBeNull();
    expect(getPublicProfile).not.toHaveBeenCalled();
  });

  it('returns null for an unknown handle', async () => {
    vi.mocked(getPublicProfile).mockResolvedValue(null);
    expect(await getGarageForVisitor(supabase, 'nobody', VIEWER)).toBeNull();
    expect(repo.getGarage).not.toHaveBeenCalled();
  });

  it('returns null when the garage is hidden (RLS filtered it or invite-only)', async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      id: OWNER,
      handle: 'owner',
      display_name: 'Owner',
    } as never);
    repo.getGarage.mockResolvedValue(null);
    expect(await getGarageForVisitor(supabase, 'owner', VIEWER)).toBeNull();

    repo.getGarage.mockResolvedValue(garage({ open_mode: 'invite' }));
    expect(await getGarageForVisitor(supabase, 'owner', VIEWER)).toBeNull();
    expect(await getGarageForVisitor(supabase, 'owner', OWNER)).not.toBeNull();
  });

  it('exposes only public fields — no PII, no updated_at, owner handle + display name only', async () => {
    vi.mocked(getPublicProfile).mockResolvedValue({
      id: OWNER,
      handle: 'owner',
      display_name: 'Owner',
      mobile: '+971500000000',
    } as never);
    repo.getGarage.mockResolvedValue(
      garage({ layout: { version: 1, slots: [{ slot: 0, itemId: CAR_A }], decor: [] } })
    );
    const out = await getGarageForVisitor(supabase, 'OWNER', null);
    expect(out).not.toBeNull();
    expect(Object.keys(out!.owner).sort()).toEqual(['displayName', 'handle', 'id']);
    expect(Object.keys(out!.garage)).not.toContain('updated_at');
    expect(JSON.stringify(out)).not.toContain('+971');
    expect(out!.level.name).toBe('Shed');
    expect(out!.layout.slots).toHaveLength(1);
  });
});

describe('world.getOwnGarage', () => {
  it('ensures the garage (lazy create) and resolves level + next level', async () => {
    repo.ensureGarage.mockResolvedValue(garage());
    const own = await getOwnGarage(supabase);
    expect(repo.ensureGarage).toHaveBeenCalledWith(supabase);
    expect(own.level.level).toBe(1);
    expect(own.nextLevel?.level).toBe(2);
  });
  it('nextLevel is null at the top level', async () => {
    repo.ensureGarage.mockResolvedValue(garage({ level: 2 }));
    expect((await getOwnGarage(supabase)).nextLevel).toBeNull();
  });
});

describe('world.saveLayout', () => {
  it('validates against the level capacity, the owner public cars and inventory, then emits world.layout_saved', async () => {
    repo.ensureGarage.mockResolvedValue(garage());
    repo.listInventory.mockResolvedValue([{ item_id: LAMP } as never]);
    vi.mocked(listPublicCollectionItems).mockResolvedValue([{ id: CAR_A }] as never);
    repo.updateGarage.mockResolvedValue(garage());

    const layout = {
      version: 1,
      slots: [{ slot: 0, itemId: CAR_A }],
      decor: [{ slot: 0, itemId: LAMP }],
    };
    await saveLayout(supabase, OWNER, layout);
    expect(repo.updateGarage).toHaveBeenCalledWith(supabase, OWNER, { layout });
    expect(emitEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ type: 'world.layout_saved', entity: 'garage', entityId: OWNER })
    );
  });

  it('rejects a private car and writes nothing', async () => {
    repo.ensureGarage.mockResolvedValue(garage());
    vi.mocked(listPublicCollectionItems).mockResolvedValue([{ id: CAR_A }] as never);
    await expect(
      saveLayout(supabase, OWNER, { version: 1, slots: [{ slot: 0, itemId: CAR_B }], decor: [] })
    ).rejects.toThrow(new WorldError('item_not_public'));
    expect(repo.updateGarage).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });
});

describe('world.updateGarageSettings', () => {
  it('maps the input, ignores nothing silently (strict schema), and emits world.garage_updated', async () => {
    repo.ensureGarage.mockResolvedValue(garage());
    repo.updateGarage.mockResolvedValue(garage({ name: 'Showcase', open_mode: 'followers' }));
    await updateGarageSettings(supabase, OWNER, { name: ' Showcase ', openMode: 'followers' });
    expect(repo.updateGarage).toHaveBeenCalledWith(supabase, OWNER, {
      name: 'Showcase',
      open_mode: 'followers',
    });
    expect(emitEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        type: 'world.garage_updated',
        payload: { fields: ['name', 'open_mode'] },
      })
    );
  });

  it('refuses a level change from the client (server authority, 07 P4)', async () => {
    await expect(updateGarageSettings(supabase, OWNER, { level: 5 })).rejects.toThrow();
    expect(repo.updateGarage).not.toHaveBeenCalled();
  });
});

describe('world purchases map RPC errors to WorldError', () => {
  it('buyLevel: insufficient_balance', async () => {
    repo.buyLevel.mockRejectedValue({ message: 'insufficient_balance', code: 'P0001' });
    await expect(buyLevel(supabase)).rejects.toThrow(new WorldError('insufficient_balance'));
  });
  it('buyLevel: xp_level_too_low', async () => {
    repo.buyLevel.mockRejectedValue({ message: 'xp_level_too_low' });
    await expect(buyLevel(supabase)).rejects.toThrow(new WorldError('xp_level_too_low'));
  });
  it('buyLevel: passes the new garage row through', async () => {
    repo.buyLevel.mockResolvedValue(garage({ level: 2 }));
    expect((await buyLevel(supabase)).level).toBe(2);
  });
  it('buyItem: validates the id and maps already_owned / earned_only', async () => {
    await expect(buyItem(supabase, { itemId: 'nope' })).rejects.toThrow();
    repo.buyItem.mockRejectedValue({ message: 'already_owned' });
    await expect(buyItem(supabase, { itemId: LAMP })).rejects.toThrow(
      new WorldError('already_owned')
    );
    repo.buyItem.mockRejectedValue({ message: 'earned_only' });
    await expect(buyItem(supabase, { itemId: LAMP, idempotencyKey: 'k1' })).rejects.toThrow(
      new WorldError('earned_only')
    );
    expect(repo.buyItem).toHaveBeenLastCalledWith(supabase, LAMP, 'k1');
  });
  it('buyItem: an unrelated error is rethrown untouched', async () => {
    const boom = new Error('network down');
    repo.buyItem.mockRejectedValue(boom);
    await expect(buyItem(supabase, { itemId: LAMP })).rejects.toBe(boom);
  });
});

describe('event catalogue (MV-W01-06)', () => {
  it('registers the World pillars so every sprint emits from one list', () => {
    for (const t of [
      'world.garage_created',
      'world.level_up',
      'world.item_bought',
      'meetup.rsvp',
      'race.completed',
      'club.joined',
      'quest.completed',
      'user.accepted_terms',
      'flag.updated',
    ]) {
      expect(EVENT_TYPES).toContain(t);
    }
  });
});
