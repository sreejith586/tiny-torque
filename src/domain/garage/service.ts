// Garage (My Garage) service. Components import from here, never from repo.
import type { Client, TablesInsert } from '@/lib/supabase/types';
import { listMediaForEntities, listItemMedia } from '@/domain/media';
import * as repo from './repo';
import { collectionItemInputSchema } from './schema';
import { computeStats, type GarageQuery, type GarageStats } from './query';
import type { CollectionItemInput, CollectionItemRow, GarageItem } from './types';

export const updateCollectionItem = repo.update;
/** Delete is a SOFT delete now (30-day trash, F-02); restore via restoreCollectionItem. */
export const deleteCollectionItem = repo.softDelete;
export const restoreCollectionItem = repo.restore;

/** Attach each item's photos (media rows → display ids) in one batched query. */
async function attachMedia(supabase: Client, items: CollectionItemRow[]): Promise<GarageItem[]> {
  if (items.length === 0) return [];
  const media = await listMediaForEntities(
    supabase,
    'item',
    items.map((i) => i.id)
  );
  const byItem = new Map<string, { id: string }[]>();
  for (const m of media) {
    if (!m.entity_id) continue;
    const list = byItem.get(m.entity_id) ?? [];
    list.push({ id: m.id });
    byItem.set(m.entity_id, list);
  }
  return items.map((item) => ({ ...item, media: byItem.get(item.id) ?? [] }));
}

export async function listCollectionItems(supabase: Client, userId: string): Promise<GarageItem[]> {
  return attachMedia(supabase, await repo.listByOwner(supabase, userId));
}

export async function listPublicCollectionItems(
  supabase: Client,
  userId: string
): Promise<GarageItem[]> {
  return attachMedia(supabase, await repo.listPublicByOwner(supabase, userId));
}

export async function getCollectionItem(
  supabase: Client,
  itemId: string
): Promise<GarageItem | null> {
  const item = await repo.getById(supabase, itemId);
  if (!item) return null;
  const media = await listItemMedia(supabase, itemId);
  return { ...item, media: media.map((m) => ({ id: m.id })) };
}

/** Server-side filtered/sorted/keyset-paginated garage list (F-02). */
export async function listGarage(
  supabase: Client,
  userId: string,
  query: GarageQuery = {}
): Promise<{ items: GarageItem[]; nextCursor: string | null }> {
  const { items, nextCursor } = await repo.listPage(supabase, userId, query);
  return { items: await attachMedia(supabase, items), nextCursor };
}

export async function getGarageStats(supabase: Client, userId: string): Promise<GarageStats> {
  return computeStats(await repo.statRows(supabase, userId));
}

export async function listTrashItems(supabase: Client, userId: string): Promise<GarageItem[]> {
  return attachMedia(supabase, await repo.listTrash(supabase, userId));
}

/** Non-blocking duplicate warning: same brand + model + variant for this owner. */
export function findPossibleDuplicates(
  supabase: Client,
  userId: string,
  brand: string,
  model: string | null,
  variant: string | null
) {
  return repo.findMatches(supabase, userId, brand, model, variant);
}

export function toInsertRow(
  userId: string,
  input: CollectionItemInput
): TablesInsert<'collection_items'> {
  const v = collectionItemInputSchema.parse(input);
  return {
    owner_id: userId,
    brand: v.brand,
    model: v.model ?? null,
    series: v.series ?? null,
    scale: v.scale ?? null,
    variant: v.variant ?? null,
    card_type: v.cardType ?? null,
    rarity: v.rarity ?? null,
    condition: v.condition ?? null,
    qty: v.qty,
    price_paid: v.pricePaid,
    source: v.source ?? null,
    is_public: v.isPublic,
    for_sale: v.forSale,
    open_to_offers: v.openToOffers,
    open_to_trade: v.openToTrade,
    ask_price: v.askPrice ?? 0,
  };
}

export async function addCollectionItem(
  supabase: Client,
  userId: string,
  input: CollectionItemInput
): Promise<CollectionItemRow> {
  const [row] = await repo.insertMany(supabase, [toInsertRow(userId, input)]);
  if (!row) throw new Error('Insert returned no row');
  return row;
}

export async function addCollectionItems(
  supabase: Client,
  userId: string,
  inputs: CollectionItemInput[]
): Promise<CollectionItemRow[]> {
  if (inputs.length === 0) return [];
  return repo.insertMany(
    supabase,
    inputs.map((i) => toInsertRow(userId, i))
  );
}

export type { CollectionItemInput, CollectionItemRow, GarageItem, DisplayMedia } from './types';
export {
  GARAGE_PAGE_SIZE,
  computeStats,
  type GarageQuery,
  type GarageSort,
  type GarageStats,
} from './query';
