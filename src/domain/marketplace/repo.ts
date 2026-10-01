// The ONLY file in this module that talks to Supabase (D-007).
import type { Client, TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import type { ListingStatus } from '@/types/database';
import { decodeCursor, encodeCursor, keysetFilter } from '@/lib/keyset';
import { SORT_CONFIG, MARKET_PAGE_SIZE, type MarketBrowseQuery } from './query';
import type { MarketplaceListingRow, WishlistItemRow } from './types';

// Explicit column list — never selects seller_mobile (rule 15; the column grant also blocks it).
const LISTING_COLS =
  'id, source_item_id, seller_id, seller_type, seller_name, seller_photo, brand, model, variant, ' +
  'rarity, condition, price, qty, open_to_offers, open_to_trade, catalog_model_id, listing_type, ' +
  'currency, country_code, min_offer, description, view_count, favorite_count, offer_count, ' +
  'expires_at, sold_at, status, created_at';

export async function browsePage(
  supabase: Client,
  query: MarketBrowseQuery,
  onlyIds?: string[]
): Promise<{ items: MarketplaceListingRow[]; nextCursor: string | null }> {
  const sort = SORT_CONFIG[query.sort ?? 'newest'];
  const limit = query.limit ?? MARKET_PAGE_SIZE;
  const nowIso = new Date().toISOString();

  let qb = supabase
    .from('marketplace_listings')
    .select(LISTING_COLS)
    .eq('status', 'active')
    .is('deleted_at', null)
    .or(`expires_at.gte.${nowIso},expires_at.is.null`);

  if (onlyIds)
    qb = qb.in('id', onlyIds.length ? onlyIds : ['00000000-0000-0000-0000-000000000000']);
  if (query.q) qb = qb.textSearch('search', query.q, { type: 'websearch', config: 'simple' });
  if (query.brand) qb = qb.eq('brand', query.brand);
  if (query.listingType) qb = qb.eq('listing_type', query.listingType);
  if (query.condition) qb = qb.eq('condition', query.condition);
  if (query.sellerType) qb = qb.eq('seller_type', query.sellerType);
  if (query.minPrice !== undefined) qb = qb.gte('price', query.minPrice);
  if (query.maxPrice !== undefined) qb = qb.lte('price', query.maxPrice);
  if (query.country && query.country !== 'all') qb = qb.eq('country_code', query.country);

  if (query.cursor) {
    const c = decodeCursor(query.cursor);
    if (c) qb = qb.or(keysetFilter(sort.column, sort.ascending, c));
  }

  qb = qb
    .order(sort.column, { ascending: sort.ascending })
    .order('id', { ascending: sort.ascending })
    .limit(limit + 1);

  const { data, error } = await qb;
  if (error) throw error;

  const rows = (data ?? []) as unknown as MarketplaceListingRow[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          value: (last as unknown as Record<string, string | number>)[sort.column]!,
          id: last.id,
        })
      : null;
  return { items, nextCursor };
}

export async function getById(supabase: Client, id: string): Promise<MarketplaceListingRow | null> {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(LISTING_COLS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as MarketplaceListingRow) ?? null;
}

export async function listBySeller(
  supabase: Client,
  sellerId: string,
  status?: ListingStatus
): Promise<MarketplaceListingRow[]> {
  let qb = supabase
    .from('marketplace_listings')
    .select(LISTING_COLS)
    .eq('seller_id', sellerId)
    .is('deleted_at', null);
  if (status) qb = qb.eq('status', status);
  const { data, error } = await qb.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MarketplaceListingRow[];
}

export async function countActiveBySeller(supabase: Client, sellerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('marketplace_listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function insert(
  supabase: Client,
  row: TablesInsert<'marketplace_listings'>
): Promise<MarketplaceListingRow> {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert(row)
    .select(LISTING_COLS)
    .single();
  if (error) throw error;
  return data as unknown as MarketplaceListingRow;
}

export async function update(
  supabase: Client,
  id: string,
  patch: TablesUpdate<'marketplace_listings'>
): Promise<void> {
  const { error } = await supabase.from('marketplace_listings').update(patch).eq('id', id);
  if (error) throw error;
}

// ---------- favourites ----------
export async function addFavorite(supabase: Client, userId: string, listingId: string) {
  const { error } = await supabase
    .from('listing_favorites')
    .upsert({ user_id: userId, listing_id: listingId }, { onConflict: 'user_id,listing_id' });
  if (error) throw error;
}

export async function removeFavorite(supabase: Client, userId: string, listingId: string) {
  const { error } = await supabase
    .from('listing_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);
  if (error) throw error;
}

export async function listFavoriteIds(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('listing_favorites')
    .select('listing_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.listing_id);
}

// ---------- wishlist ----------
export async function listWishlist(supabase: Client, userId: string): Promise<WishlistItemRow[]> {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WishlistItemRow[];
}

export async function insertWishlist(
  supabase: Client,
  row: TablesInsert<'wishlist_items'>
): Promise<WishlistItemRow> {
  const { data, error } = await supabase.from('wishlist_items').insert(row).select('*').single();
  if (error) throw error;
  return data as WishlistItemRow;
}

export async function updateWishlist(
  supabase: Client,
  id: string,
  patch: TablesUpdate<'wishlist_items'>
): Promise<void> {
  const { error } = await supabase.from('wishlist_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function removeWishlist(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
  if (error) throw error;
}
