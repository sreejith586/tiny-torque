// Marketplace browse: query shape + sort config (MV-S4-02, F-06). Keyset-cursor helpers are the
// shared ones in '@/lib/keyset'. Pure config/helpers here are unit-tested; the DB query lives in
// repo.ts.
export const MARKET_PAGE_SIZE = 24;

export type MarketSort = 'newest' | 'price_asc' | 'price_desc' | 'offers';

export interface MarketBrowseQuery {
  q?: string;
  brand?: string;
  listingType?: 'sale' | 'trade' | 'both';
  condition?: string;
  sellerType?: string;
  minPrice?: number;
  maxPrice?: number;
  /** A country code (e.g. 'AE') to scope to, or 'all' for every country. Default = viewer's. */
  country?: string | 'all';
  /** When set, restrict to listings this user has favourited (their "Favourites" filter). */
  favoritesOf?: string;
  sort?: MarketSort;
  cursor?: string;
  limit?: number;
}

/** DB column + direction each sort maps to; `id` is always the tiebreaker (same direction). */
export const SORT_CONFIG: Record<MarketSort, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  price_asc: { column: 'price', ascending: true },
  price_desc: { column: 'price', ascending: false },
  offers: { column: 'offer_count', ascending: false }, // "most offers" (true Trending is a stretch)
};

/**
 * Minimum acceptable cash offer. "Open to offers" lets a seller invite offers below the sticker
 * price down to their floor; otherwise the floor is the price itself. A caller-supplied floor is
 * honoured only when it is a sane fraction of price (0 < min <= price).
 */
export function defaultMinOffer(
  price: number,
  openToOffers: boolean,
  supplied?: number | null
): number {
  if (!openToOffers) return price;
  if (supplied != null && supplied > 0 && supplied <= price) return supplied;
  return price;
}

/** Pilot listing lifetime (F-06): 60 days, renewable. */
export const LISTING_TTL_DAYS = 60;

export function listingExpiry(from: Date = new Date()): string {
  return new Date(from.getTime() + LISTING_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
