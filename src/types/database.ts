// Row/enum aliases derived from the GENERATED src/types/supabase.ts (D-006).
// Never hand-edit shapes here — run `pnpm gen:types` after a migration.
import type { Tables, Enums } from '@/types/supabase';

export type ProfileRow = Tables<'profiles'>;
export type CollectionItemRow = Omit<Tables<'collection_items'>, 'photos'> & { photos: string[] };
export type MarketplaceListingRow = Tables<'marketplace_listings'>;
export type SellerReviewRow = Tables<'seller_reviews'>;
export type WishlistItemRow = Tables<'wishlist_items'>;
export type ReportRow = Tables<'reports'>;
export type CountryRow = Tables<'countries'>;

export type AccountType = Enums<'account_type'>;
export type Plan = Enums<'plan_tier'>;
export type ListingStatus = Enums<'listing_status'>;
export type ReportStatus = Enums<'report_status'>;
export type UserRole = Enums<'user_role'>;
