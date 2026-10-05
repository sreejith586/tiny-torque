import type { MarketplaceListingRow, WishlistItemRow } from '@/types/database';

export type { MarketplaceListingRow, WishlistItemRow };

/** A listing with its (referenced) item media attached for display. `url` is an optional
 * data-URI/preview for the visual harness; in production MediaImage resolves it from `id`. */
export interface Listing extends MarketplaceListingRow {
  media: { id: string; url?: string | null }[];
}
