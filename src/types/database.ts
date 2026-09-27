// Typed row shapes for every table in supabase/schema.sql.
// Keep these in sync field-for-field with the schema — they are the
// single source of truth for what the rest of the app treats as "the DB".

export type AccountType = 'individual' | 'shop';
export type Plan = 'free' | 'pro';
export type ListingStatus = 'active' | 'sold' | 'removed';
export type ReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface ProfileRow {
  id: string;
  display_name: string;
  account_type: AccountType;
  store_name: string | null;
  location: string | null;
  mobile: string | null;
  photo_url: string | null;
  plan: Plan;
  tokens: number;
  created_at: string;
}

export interface CollectionItemRow {
  id: string;
  owner_id: string;
  brand: string;
  model: string | null;
  series: string | null;
  scale: string | null;
  variant: string | null;
  card_type: string | null;
  rarity: string | null;
  condition: string | null;
  qty: number;
  price_paid: number;
  source: string | null;
  photo: string | null;
  photos: string[];
  is_public: boolean;
  for_sale: boolean;
  open_to_offers: boolean;
  open_to_trade: boolean;
  ask_price: number | null;
  created_at: string;
}

export interface MarketplaceListingRow {
  id: string;
  source_item_id: string | null;
  seller_id: string;
  seller_type: string | null;
  seller_photo: string | null;
  seller_name: string | null;
  seller_location: string | null;
  seller_mobile: string | null;
  brand: string;
  model: string | null;
  variant: string | null;
  rarity: string | null;
  condition: string | null;
  price: number;
  qty: number;
  open_to_offers: boolean;
  open_to_trade: boolean;
  photo: string | null;
  photos: string[];
  offers: unknown[];
  status: ListingStatus;
  created_at: string;
}

export interface SellerReviewRow {
  id: string;
  seller_id: string;
  offer_id: string | null;
  buyer_id: string | null;
  buyer_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface WishlistItemRow {
  id: string;
  owner_id: string;
  brand: string | null;
  model: string | null;
  notes: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  reason: string | null;
  notes: string | null;
  reporter_id: string;
  status: ReportStatus;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string; display_name: string; account_type: AccountType };
        Update: Partial<ProfileRow>;
      };
      collection_items: {
        Row: CollectionItemRow;
        Insert: Partial<CollectionItemRow> & { owner_id: string; brand: string };
        Update: Partial<CollectionItemRow>;
      };
      marketplace_listings: {
        Row: MarketplaceListingRow;
        Insert: Partial<MarketplaceListingRow> & { seller_id: string; brand: string };
        Update: Partial<MarketplaceListingRow>;
      };
      seller_reviews: {
        Row: SellerReviewRow;
        Insert: Partial<SellerReviewRow> & { seller_id: string; rating: number };
        Update: Partial<SellerReviewRow>;
      };
      wishlist_items: {
        Row: WishlistItemRow;
        Insert: Partial<WishlistItemRow> & { owner_id: string };
        Update: Partial<WishlistItemRow>;
      };
      reports: {
        Row: ReportRow;
        Insert: Partial<ReportRow> & { target_type: string; reporter_id: string };
        Update: Partial<ReportRow>;
      };
    };
  };
}
