// Marketplace service (MV-S4-02, F-06/F-07). Components/routes import from here, never from repo.
// Every mutation emits a domain_events row (rule 9) and asks domain/entitlements for limits (D-021).
import type { Client } from '@/lib/supabase/types';
import type { ListingStatus } from '@/types/database';
import { emitEvent } from '@/domain/events';
import { listingSlots } from '@/domain/entitlements';
import { listMediaForEntities } from '@/domain/media';
import * as repo from './repo';
import { defaultMinOffer, listingExpiry, type MarketBrowseQuery } from './query';
import { listingPublishSchema, listingUpdateSchema, wishlistSchema } from './schema';
import type { Listing, MarketplaceListingRow, WishlistItemRow } from './types';

/** Attach each listing's (referenced, not copied) item media for display. */
async function attachMedia(supabase: Client, rows: MarketplaceListingRow[]): Promise<Listing[]> {
  const itemIds = rows.map((r) => r.source_item_id).filter((v): v is string => !!v);
  if (itemIds.length === 0) return rows.map((r) => ({ ...r, media: [] }));
  const media = await listMediaForEntities(supabase, 'item', itemIds);
  const byItem = new Map<string, { id: string }[]>();
  for (const m of media) {
    if (!m.entity_id) continue;
    const list = byItem.get(m.entity_id) ?? [];
    list.push({ id: m.id });
    byItem.set(m.entity_id, list);
  }
  return rows.map((r) => ({
    ...r,
    media: r.source_item_id ? (byItem.get(r.source_item_id) ?? []) : [],
  }));
}

/** Public browse (anon-friendly). `country` defaults to the viewer's; pass 'all' for every country. */
export async function browseListings(
  supabase: Client,
  query: MarketBrowseQuery = {},
  viewerCountry?: string
): Promise<{ items: Listing[]; nextCursor: string | null }> {
  const country = query.country ?? viewerCountry ?? 'all';
  let onlyIds: string[] | undefined;
  if (query.favoritesOf) onlyIds = await repo.listFavoriteIds(supabase, query.favoritesOf);
  const { items, nextCursor } = await repo.browsePage(supabase, { ...query, country }, onlyIds);
  return { items: await attachMedia(supabase, items), nextCursor };
}

export async function getListing(supabase: Client, id: string): Promise<Listing | null> {
  const row = await repo.getById(supabase, id);
  if (!row) return null;
  return (await attachMedia(supabase, [row]))[0] ?? null;
}

/** Bump a listing's view counter (F-06); callers debounce to once per view. */
export const incrementListingView = repo.incrementView;

export async function listMyListings(
  supabase: Client,
  sellerId: string,
  status?: ListingStatus
): Promise<Listing[]> {
  return attachMedia(supabase, await repo.listBySeller(supabase, sellerId, status));
}

/** The seller's active listing for a garage item, if any (F-06 publish entry point). */
export async function findActiveListingForItem(
  supabase: Client,
  sellerId: string,
  sourceItemId: string
): Promise<Listing | null> {
  const rows = await repo.listBySeller(supabase, sellerId, 'active');
  const row = rows.find((r) => r.source_item_id === sourceItemId);
  if (!row) return null;
  return (await attachMedia(supabase, [row]))[0] ?? null;
}

/** Active-listing allowance check (UI asks first; the DB trigger is the backstop, D-021). */
export async function canPublishListing(
  supabase: Client,
  sellerId: string
): Promise<{ allowed: boolean; active: number; slots: number }> {
  const [active, slots] = await Promise.all([
    repo.countActiveBySeller(supabase, sellerId),
    listingSlots(supabase, sellerId),
  ]);
  return { allowed: active < slots, active, slots };
}

export class ListingLimitError extends Error {
  readonly code = 'listing_limit_reached';
  constructor() {
    super('You have reached your active-listing limit.');
    this.name = 'ListingLimitError';
  }
}
export class PhotoRequiredError extends Error {
  readonly code = 'photo_required';
  constructor() {
    super('A listing needs at least one photo.');
    this.name = 'PhotoRequiredError';
  }
}

export async function publishListing(
  supabase: Client,
  sellerId: string,
  input: unknown
): Promise<Listing> {
  const v = listingPublishSchema.parse(input);

  const { allowed } = await canPublishListing(supabase, sellerId);
  if (!allowed) throw new ListingLimitError();

  // Publishing requires ≥1 photo (F-06); listings reference the source item's media.
  if (v.sourceItemId) {
    const media = await listMediaForEntities(supabase, 'item', [v.sourceItemId]);
    if (media.length === 0) throw new PhotoRequiredError();
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('country_code, account_type, display_name')
    .eq('id', sellerId)
    .maybeSingle();

  const row = await repo.insert(supabase, {
    seller_id: sellerId,
    source_item_id: v.sourceItemId ?? null,
    catalog_model_id: v.catalogModelId ?? null,
    brand: v.brand,
    model: v.model ?? null,
    variant: v.variant ?? null,
    rarity: v.rarity ?? null,
    condition: v.condition ?? null,
    listing_type: v.listingType,
    price: v.price,
    currency: v.currency,
    country_code: profile?.country_code ?? null,
    min_offer: defaultMinOffer(v.price, v.openToOffers, v.minOffer),
    open_to_offers: v.openToOffers,
    open_to_trade: v.listingType !== 'sale',
    description: v.description ?? null,
    qty: v.qty,
    status: 'active',
    expires_at: listingExpiry(),
    seller_type: profile?.account_type ?? null,
    seller_name: profile?.display_name ?? null,
  });

  await emitEvent(supabase, {
    actorId: sellerId,
    type: 'listing.published',
    entity: 'listing',
    entityId: row.id,
    payload: { listing_type: v.listingType, price: v.price },
  });
  const [listing] = await attachMedia(supabase, [row]);
  return listing!;
}

export async function updateListing(
  supabase: Client,
  sellerId: string,
  id: string,
  input: unknown
): Promise<void> {
  const v = listingUpdateSchema.parse(input);
  const patch: Record<string, unknown> = {};
  if (v.price !== undefined) patch.price = v.price;
  if (v.currency !== undefined) patch.currency = v.currency;
  if (v.listingType !== undefined) {
    patch.listing_type = v.listingType;
    patch.open_to_trade = v.listingType !== 'sale';
  }
  if (v.openToOffers !== undefined) patch.open_to_offers = v.openToOffers;
  if (v.minOffer !== undefined) patch.min_offer = v.minOffer;
  if (v.qty !== undefined) patch.qty = v.qty;
  if (v.description !== undefined) patch.description = v.description ?? null;

  await repo.update(supabase, id, patch);
  await emitEvent(supabase, {
    actorId: sellerId,
    type: 'listing.updated',
    entity: 'listing',
    entityId: id,
  });
}

/** Reset the 60-day clock and reactivate (F-06, renewable one tap). */
export async function renewListing(supabase: Client, sellerId: string, id: string): Promise<void> {
  await repo.update(supabase, id, { status: 'active', expires_at: listingExpiry() });
  await emitEvent(supabase, {
    actorId: sellerId,
    type: 'listing.renewed',
    entity: 'listing',
    entityId: id,
  });
}

export async function removeListing(supabase: Client, sellerId: string, id: string): Promise<void> {
  await repo.update(supabase, id, { status: 'removed', deleted_at: new Date().toISOString() });
  await emitEvent(supabase, {
    actorId: sellerId,
    type: 'listing.removed',
    entity: 'listing',
    entityId: id,
  });
}

// ---------- favourites (F-07) ----------
export async function favoriteListing(supabase: Client, userId: string, listingId: string) {
  await repo.addFavorite(supabase, userId, listingId);
}
export async function unfavoriteListing(supabase: Client, userId: string, listingId: string) {
  await repo.removeFavorite(supabase, userId, listingId);
}
export const listFavoriteIds = repo.listFavoriteIds;

// ---------- wishlist (F-07) ----------
export async function listWishlist(supabase: Client, userId: string): Promise<WishlistItemRow[]> {
  return repo.listWishlist(supabase, userId);
}
export async function addWishlistItem(
  supabase: Client,
  userId: string,
  input: unknown
): Promise<WishlistItemRow> {
  const v = wishlistSchema.parse(input);
  return repo.insertWishlist(supabase, {
    owner_id: userId,
    brand: v.brand ?? null,
    model: v.model ?? null,
    catalog_model_id: v.catalogModelId ?? null,
    max_price: v.maxPrice ?? null,
    currency: v.currency ?? null,
    notify: v.notify,
  });
}
export async function updateWishlistItem(
  supabase: Client,
  id: string,
  input: unknown
): Promise<void> {
  const v = wishlistSchema.partial().parse(input);
  const patch: Record<string, unknown> = {};
  if (v.brand !== undefined) patch.brand = v.brand ?? null;
  if (v.model !== undefined) patch.model = v.model ?? null;
  if (v.catalogModelId !== undefined) patch.catalog_model_id = v.catalogModelId ?? null;
  if (v.maxPrice !== undefined) patch.max_price = v.maxPrice ?? null;
  if (v.currency !== undefined) patch.currency = v.currency ?? null;
  if (v.notify !== undefined) patch.notify = v.notify;
  await repo.updateWishlist(supabase, id, patch);
}
export async function removeWishlistItem(supabase: Client, id: string): Promise<void> {
  await repo.removeWishlist(supabase, id);
}
