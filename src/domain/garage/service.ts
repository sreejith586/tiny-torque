// Garage (My Garage) service. Components import from here, never from repo.
import type { Client, TablesInsert } from '@/lib/supabase/types';
import * as repo from './repo';
import { collectionItemInputSchema } from './schema';
import type { CollectionItemInput, CollectionItemRow } from './types';

export const listCollectionItems = repo.listByOwner;
export const getCollectionItem = repo.getById;
export const updateCollectionItem = repo.update;
export const deleteCollectionItem = repo.remove;
export const uploadCarPhoto = repo.uploadPhoto;

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

export function toInsertRow(userId: string, input: CollectionItemInput): TablesInsert<'collection_items'> {
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
    photo: v.photo ?? v.photos[0] ?? null,
    photos: v.photos,
    is_public: v.isPublic,
    for_sale: v.forSale,
    open_to_offers: v.openToOffers,
    open_to_trade: v.openToTrade,
    ask_price: v.askPrice ?? 0,
  };
}

export async function addCollectionItem(supabase: Client, userId: string, input: CollectionItemInput): Promise<CollectionItemRow> {
  const [row] = await repo.insertMany(supabase, [toInsertRow(userId, input)]);
  if (!row) throw new Error('Insert returned no row');
  return row;
}

export async function addCollectionItems(supabase: Client, userId: string, inputs: CollectionItemInput[]): Promise<CollectionItemRow[]> {
  if (inputs.length === 0) return [];
  return repo.insertMany(supabase, inputs.map((i) => toInsertRow(userId, i)));
}

export type { CollectionItemInput, CollectionItemRow };
