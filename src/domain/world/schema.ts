// zod at the boundary (D-013) for everything a client can send the World service, plus the
// layout document rules from 07 §6.2 ("validates slots ≤ level capacity and items owned + public").
import { z } from 'zod';
import { WORLD_OPEN_MODES } from './types';
import { WorldError } from './errors';

const slotSchema = z.object({
  slot: z.number().int().min(0).max(63),
  itemId: z.string().uuid(),
});

/** `world_garages.layout` — version-pinned so a future renderer can migrate old documents.
 *  `slots` hold the owner's real collection_items (display slots); `decor` holds world_items. */
export const garageLayoutSchema = z
  .object({
    version: z.literal(1),
    slots: z.array(slotSchema).max(64),
    decor: z.array(slotSchema).max(64),
  })
  .strict();
export type GarageLayout = z.infer<typeof garageLayoutSchema>;

export const EMPTY_LAYOUT: GarageLayout = { version: 1, slots: [], decor: [] };

/** Lenient read of a stored layout: a malformed/legacy document renders as empty rather than
 *  taking the garage page down. Writes always go through validateLayout. */
export function parseStoredLayout(json: unknown): GarageLayout {
  const parsed = garageLayoutSchema.safeParse(json);
  return parsed.success ? parsed.data : EMPTY_LAYOUT;
}

export const garageNameSchema = z
  .string()
  .trim()
  .min(1, 'Name your garage')
  .max(40, 'Name is too long');
export const openModeSchema = z.enum(WORLD_OPEN_MODES);
export const handleParamSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/);

export const updateGarageSchema = z
  .object({
    name: garageNameSchema.optional(),
    openMode: openModeSchema.optional(),
    featuredItemId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type UpdateGarageInput = z.infer<typeof updateGarageSchema>;

export const buyItemSchema = z.object({
  itemId: z.string().uuid(),
  /** Only meaningful for consumables; durables are idempotent on user+item inside the RPC. */
  idempotencyKey: z.string().trim().min(1).max(80).optional(),
});
export type BuyItemInput = z.infer<typeof buyItemSchema>;

export interface LayoutContext {
  displaySlots: number;
  decorSlots: number;
  /** The owner's public, non-deleted collection_items ids. */
  publicItemIds: ReadonlySet<string>;
  /** world_items ids the owner holds in world_inventory. */
  ownedWorldItemIds: ReadonlySet<string>;
}

/** Full layout validation: shape (zod) + capacity + ownership/visibility. Throws WorldError. */
export function validateLayout(input: unknown, ctx: LayoutContext): GarageLayout {
  const parsed = garageLayoutSchema.safeParse(input);
  if (!parsed.success) throw new WorldError('layout_invalid');
  const layout = parsed.data;

  if (layout.slots.length > ctx.displaySlots) throw new WorldError('too_many_slots');
  if (layout.decor.length > ctx.decorSlots) throw new WorldError('too_many_decor');

  checkSlots(layout.slots, ctx.displaySlots);
  checkSlots(layout.decor, ctx.decorSlots);

  for (const s of layout.slots) {
    if (!ctx.publicItemIds.has(s.itemId)) throw new WorldError('item_not_public');
  }
  for (const d of layout.decor) {
    if (!ctx.ownedWorldItemIds.has(d.itemId)) throw new WorldError('item_not_owned');
  }
  return layout;
}

function checkSlots(entries: GarageLayout['slots'], capacity: number) {
  const seenSlots = new Set<number>();
  const seenItems = new Set<string>();
  for (const e of entries) {
    if (e.slot >= capacity) throw new WorldError('slot_out_of_range');
    if (seenSlots.has(e.slot)) throw new WorldError('duplicate_slot');
    if (seenItems.has(e.itemId)) throw new WorldError('duplicate_item');
    seenSlots.add(e.slot);
    seenItems.add(e.itemId);
  }
}
