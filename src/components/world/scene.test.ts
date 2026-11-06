import { describe, it, expect } from 'vitest';
import { levelBackdrop, placeInSlot, slotCells, unplacedItems } from './scene';
import type { GarageItem } from '@/domain/garage';

const A = { id: 'a' } as GarageItem;
const B = { id: 'b' } as GarageItem;
const items = [A, B];
const layout = { version: 1 as const, slots: [{ slot: 1, itemId: 'a' }], decor: [] };

describe('world scene helpers (MV-W02-02)', () => {
  it('slotCells yields one cell per slot up to capacity, with placed items resolved', () => {
    const cells = slotCells(layout, items, 3);
    expect(cells.map((c) => c.item?.id ?? null)).toEqual([null, 'a', null]);
  });

  it('slotCells ignores items beyond capacity and unknown ids', () => {
    const l = {
      ...layout,
      slots: [
        { slot: 5, itemId: 'a' },
        { slot: 0, itemId: 'ghost' },
      ],
    };
    expect(slotCells(l, items, 2).map((c) => c.item)).toEqual([null, null]);
  });

  it('unplacedItems lists only what is not already in a slot', () => {
    expect(unplacedItems(layout, items).map((i) => i.id)).toEqual(['b']);
  });

  it('placeInSlot moves an item (never duplicates it) and clears with null', () => {
    const moved = placeInSlot(layout, 0, 'a');
    expect(moved.slots).toEqual([{ slot: 0, itemId: 'a' }]);
    const both = placeInSlot(moved, 2, 'b');
    expect(both.slots).toEqual([
      { slot: 0, itemId: 'a' },
      { slot: 2, itemId: 'b' },
    ]);
    expect(placeInSlot(both, 0, null).slots).toEqual([{ slot: 2, itemId: 'b' }]);
    expect(layout.slots).toHaveLength(1); // input untouched
  });

  it('levelBackdrop clamps to the five seeded levels', () => {
    expect(levelBackdrop(0)).toBe('shed');
    expect(levelBackdrop(3)).toBe('showroom');
    expect(levelBackdrop(9)).toBe('vault');
  });
});
