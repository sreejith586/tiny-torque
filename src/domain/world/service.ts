// Collectors World core service (MV-W01-04/06, F-20/F-27). Components/routes call this, never the
// repo (D-007). Every mutation emits a domain event (D-009): the RPC-backed ones
// (ensure/buyLevel/buyItem) emit inside the RPC transaction, the owner edits emit from here.
// Everything here stays dark until the `world*` flags are on (D-018/D-028) — the flag check is
// the caller's job (route/page), same as every other domain service.
import type { Client, Json } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import { getPublicProfile } from '@/domain/identity';
import { listPublicCollectionItems } from '@/domain/garage';
import * as repo from './repo';
import { WorldError, rethrowAsWorldError } from './errors';
import {
  buyItemSchema,
  handleParamSchema,
  parseStoredLayout,
  updateGarageSchema,
  validateLayout,
} from './schema';
import type { GarageLayout } from './schema';
import type {
  OwnGarage,
  VisitorGarage,
  WorldGarageRow,
  WorldInventoryRow,
  WorldShop,
} from './types';

export { WorldError } from './errors';
export type { WorldErrorCode } from './errors';

/** Lazily creates the caller's garage (RPC, idempotent, emits world.garage_created once). */
export async function ensureGarage(supabase: Client): Promise<WorldGarageRow> {
  try {
    return await repo.ensureGarage(supabase);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

/** Pure visibility rule mirrored from the world_garages RLS policy, for the viewer-side facts the
 *  service already holds (owner, public, invite). Follower/block facts stay with RLS — a row the
 *  policy hides never reaches here, so this is defense in depth on the parts that are free. */
export function isGarageVisibleTo(
  garage: Pick<WorldGarageRow, 'user_id' | 'open_mode'>,
  viewerId: string | null
): boolean {
  if (viewerId && viewerId === garage.user_id) return true;
  if (garage.open_mode === 'public') return true;
  if (garage.open_mode === 'followers') return viewerId !== null; // RLS decided the follow
  return false; // invite: owner-only until world_invites (W03)
}

export async function getOwnGarage(supabase: Client): Promise<OwnGarage> {
  const garage = await ensureGarage(supabase);
  const [levels, inventory] = await Promise.all([
    repo.listLevels(supabase),
    repo.listInventory(supabase, garage.user_id),
  ]);
  const level = levels.find((l) => l.level === garage.level);
  if (!level) throw new WorldError('garage_not_found');
  return {
    garage,
    level,
    nextLevel: levels.find((l) => l.level === garage.level + 1) ?? null,
    inventory,
    layout: parseStoredLayout(garage.layout),
  };
}

/** A garage by its owner's handle, as seen by `viewerId` (null = anon). Returns null for unknown
 *  handle, hidden garage (open_mode / blocks via RLS) or a garage that was never created. */
export async function getGarageForVisitor(
  supabase: Client,
  handleInput: unknown,
  viewerId: string | null
): Promise<VisitorGarage | null> {
  const parsedHandle = handleParamSchema.safeParse(handleInput);
  if (!parsedHandle.success) return null;

  const owner = await getPublicProfile(supabase, parsedHandle.data);
  if (!owner?.id || !owner.handle) return null;

  const garage = await repo.getGarage(supabase, owner.id);
  if (!garage || !isGarageVisibleTo(garage, viewerId)) return null;

  const levels = await repo.listLevels(supabase);
  const level = levels.find((l) => l.level === garage.level);
  if (!level) return null;

  return {
    garage: {
      user_id: garage.user_id,
      level: garage.level,
      name: garage.name,
      open_mode: garage.open_mode,
      featured_item_id: garage.featured_item_id,
      theme_item_id: garage.theme_item_id,
      score: garage.score,
      created_at: garage.created_at,
    },
    level,
    layout: parseStoredLayout(garage.layout),
    owner: { id: owner.id, handle: owner.handle, displayName: owner.display_name ?? owner.handle },
  };
}

/** Owner edits name / open house mode / featured car. Level and score are RPC-only. */
export async function updateGarageSettings(
  supabase: Client,
  userId: string,
  input: unknown
): Promise<WorldGarageRow> {
  const v = updateGarageSchema.parse(input);
  const patch: Parameters<typeof repo.updateGarage>[2] = {};
  if (v.name !== undefined) patch.name = v.name;
  if (v.openMode !== undefined) patch.open_mode = v.openMode;
  if (v.featuredItemId !== undefined) patch.featured_item_id = v.featuredItemId;

  await ensureGarage(supabase);
  const row = await repo.updateGarage(supabase, userId, patch);
  await emitEvent(supabase, {
    actorId: userId,
    type: 'world.garage_updated',
    entity: 'garage',
    entityId: userId,
    payload: { fields: Object.keys(patch) },
  });
  return row;
}

/** Saves the layout document after checking slots ≤ level capacity, items public + owned (07 §6.2). */
export async function saveLayout(
  supabase: Client,
  userId: string,
  input: unknown
): Promise<GarageLayout> {
  const own = await getOwnGarage(supabase);
  const publicItems = await listPublicCollectionItems(supabase, userId);
  const layout = validateLayout(input, {
    displaySlots: own.level.display_slots,
    decorSlots: own.level.decor_slots,
    publicItemIds: new Set(publicItems.map((i) => i.id)),
    ownedWorldItemIds: new Set(own.inventory.map((i) => i.item_id)),
  });
  await repo.updateGarage(supabase, userId, { layout: layout as unknown as NonNullable<Json> });
  await emitEvent(supabase, {
    actorId: userId,
    type: 'world.layout_saved',
    entity: 'garage',
    entityId: userId,
    payload: { slots: layout.slots.length, decor: layout.decor.length },
  });
  return layout;
}

/** Next garage level, paid with tokens inside buy_world_level (spend_tokens, D-021). The RPC
 *  emits world.level_up. Throws WorldError: xp_level_too_low / max_level / insufficient_balance. */
export async function buyLevel(supabase: Client): Promise<WorldGarageRow> {
  try {
    return await repo.buyLevel(supabase);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

/** Shop purchase via buy_world_item (emits world.item_bought). Throws WorldError:
 *  item_not_found / earned_only / level_too_low / already_owned / insufficient_balance. */
export async function buyItem(supabase: Client, input: unknown): Promise<WorldInventoryRow> {
  const v = buyItemSchema.parse(input);
  try {
    return await repo.buyItem(supabase, v.itemId, v.idempotencyKey);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

export async function listShop(supabase: Client): Promise<WorldShop> {
  const [levels, items] = await Promise.all([
    repo.listLevels(supabase),
    repo.listActiveItems(supabase),
  ]);
  return { levels, items };
}

export const listLevels = repo.listLevels;

export type {
  OwnGarage,
  VisitorGarage,
  WorldShop,
  WorldGarageRow,
  WorldInventoryRow,
  WorldItemRow,
  WorldLevelRow,
  WorldOpenMode,
  WorldItemKind,
} from './types';
export { WORLD_OPEN_MODES } from './types';
export {
  garageLayoutSchema,
  EMPTY_LAYOUT,
  parseStoredLayout,
  validateLayout,
  updateGarageSchema,
  buyItemSchema,
  handleParamSchema,
} from './schema';
export type { GarageLayout, UpdateGarageInput, BuyItemInput, LayoutContext } from './schema';
