// Pure helpers for the garage scene (MV-W02-02, 07 §5.1): the layout document → what sits in each
// display slot. The "slot anchor map per breakpoint" is deliberately a CSS grid (World.module.css,
// `--cols` per breakpoint) rather than pixel anchors — no canvas, no WebGL in W1–W5.
import type { GarageLayout } from '@/domain/world';
import type { GarageItem } from '@/domain/garage';

/** Columns per breakpoint — the one place the slot grid shape lives (mirrored in World.module.css). */
export const SLOT_GRID = { phone: 2, tablet: 3, desktop: 4 } as const;

export type SlotCell = { slot: number; item: GarageItem | null };

/** One cell per display slot (0 … capacity-1); an item placed beyond capacity (level dropped,
 *  consumer removed a slot) is simply not shown — the next save re-validates. */
export function slotCells(
  layout: GarageLayout,
  items: readonly GarageItem[],
  capacity: number
): SlotCell[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const placed = new Map(layout.slots.map((s) => [s.slot, byId.get(s.itemId) ?? null]));
  return Array.from({ length: Math.max(0, capacity) }, (_, slot) => ({
    slot,
    item: placed.get(slot) ?? null,
  }));
}

/** Items not yet placed anywhere — what a slot picker may offer. */
export function unplacedItems(layout: GarageLayout, items: readonly GarageItem[]): GarageItem[] {
  const used = new Set(layout.slots.map((s) => s.itemId));
  return items.filter((i) => !used.has(i.id));
}

/** Returns a new layout with `itemId` in `slot` (null clears it); any other slot holding the same
 *  item is cleared so an item never appears twice. */
export function placeInSlot(
  layout: GarageLayout,
  slot: number,
  itemId: string | null
): GarageLayout {
  const slots = layout.slots.filter((s) => s.slot !== slot && s.itemId !== itemId);
  if (itemId) slots.push({ slot, itemId });
  slots.sort((a, b) => a.slot - b.slot);
  return { ...layout, slots };
}

/** Level backdrop key — five seeded levels map to five CSS layer sets; anything else falls back. */
export function levelBackdrop(
  level: number
): 'shed' | 'garage' | 'showroom' | 'warehouse' | 'vault' {
  return (
    (['shed', 'garage', 'showroom', 'warehouse', 'vault'] as const)[
      Math.min(Math.max(level, 1), 5) - 1
    ] ?? 'shed'
  );
}
