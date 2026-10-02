import type { MarketplaceListingRow, WishlistItemRow } from '@/types/database';

export type { MarketplaceListingRow, WishlistItemRow };

/** A listing with its (referenced) item media attached for display. */
export interface Listing extends MarketplaceListingRow {
  media: { id: string }[];
}
