// Mini Vault — data access layer (Supabase).
//
// Ported from the prototype's js/api.js, typed against src/types/database.ts.
// Every function takes a SupabaseClient as its first argument so it works
// from both server components/actions (lib/supabase/server.ts) and client
// components (lib/supabase/client.ts) without duplicating logic.
//
// Device-only preferences (theme, view-mode toggles, etc.) are NOT handled
// here on purpose — see src/lib/theme.ts, which uses localStorage directly.
// Mixing the two would mean a network round-trip for things that don't need
// one.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  ProfileRow,
  CollectionItemRow,
  MarketplaceListingRow,
  SellerReviewRow,
  WishlistItemRow,
} from '@/types/database';

type Client = SupabaseClient<Database>;

/* ---------- Auth ---------- */

// Supabase expects E.164 format (e.g. +91XXXXXXXXXX). The login form
// collects a bare 10-digit number and prefixes the country code before
// calling this.
export async function sendOtp(supabase: Client, mobile: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone: mobile });
  if (error) throw error;
}

export async function verifyOtp(supabase: Client, mobile: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: mobile,
    token: code,
    type: 'sms',
  });
  if (error) throw error;
  return data.user; // data.user.id becomes profiles.id / owner_id everywhere below
}

export async function signOut(supabase: Client) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/* ---------- Profile ---------- */

export async function getProfile(supabase: Client, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface SaveProfileInput {
  displayName: string;
  accountType: 'individual' | 'shop';
  storeName?: string | null;
  location?: string | null;
  mobile?: string | null;
  photoUrl?: string | null;
}

// Called once right after verifyOtp(), with the fields the onboarding
// form collects. Also used by the profile-edit form for later updates.
export async function saveProfile(supabase: Client, userId: string, input: SaveProfileInput) {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    display_name: input.displayName,
    account_type: input.accountType,
    store_name: input.storeName ?? null,
    location: input.location ?? null,
    mobile: input.mobile ?? null,
    photo_url: input.photoUrl ?? null,
  });
  if (error) throw error;
}

/* ---------- Collection (My Garage) ---------- */

export async function listCollectionItems(supabase: Client, userId: string): Promise<CollectionItemRow[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCollectionItem(supabase: Client, itemId: string): Promise<CollectionItemRow | null> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Matches used for the non-blocking duplicate warning in the add form:
// same brand + model + variant, for this owner.
export async function findPossibleDuplicates(
  supabase: Client,
  userId: string,
  brand: string,
  model: string | null,
  variant: string | null
): Promise<CollectionItemRow[]> {
  let query = supabase
    .from('collection_items')
    .select('*')
    .eq('owner_id', userId)
    .ilike('brand', brand);

  if (model) query = query.ilike('model', model);
  if (variant) query = query.ilike('variant', variant);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface CollectionItemInput {
  brand: string;
  model?: string | null;
  series?: string | null;
  scale?: string | null;
  variant?: string | null;
  cardType?: string | null;
  rarity?: string | null;
  condition?: string | null;
  qty?: number;
  pricePaid?: number;
  source?: string | null;
  photo?: string | null;
  photos?: string[];
  isPublic?: boolean;
  forSale?: boolean;
  openToOffers?: boolean;
  openToTrade?: boolean;
  askPrice?: number | null;
}

export async function addCollectionItem(
  supabase: Client,
  userId: string,
  item: CollectionItemInput
): Promise<CollectionItemRow> {
  const { data, error } = await supabase
    .from('collection_items')
    .insert({
      owner_id: userId,
      brand: item.brand,
      model: item.model ?? null,
      series: item.series ?? null,
      scale: item.scale ?? null,
      variant: item.variant ?? null,
      card_type: item.cardType ?? null,
      rarity: item.rarity ?? null,
      condition: item.condition ?? null,
      qty: item.qty ?? 1,
      price_paid: item.pricePaid ?? 0,
      source: item.source ?? null,
      photo: item.photo ?? null,
      photos: item.photos ?? [],
      is_public: item.isPublic ?? false,
      for_sale: item.forSale ?? false,
      open_to_offers: item.openToOffers ?? false,
      open_to_trade: item.openToTrade ?? false,
      ask_price: item.askPrice ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCollectionItem(
  supabase: Client,
  itemId: string,
  patch: Partial<CollectionItemRow>
) {
  const { error } = await supabase.from('collection_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

export async function deleteCollectionItem(supabase: Client, itemId: string) {
  const { error } = await supabase.from('collection_items').delete().eq('id', itemId);
  if (error) throw error;
}

/* ---------- Marketplace (Phase 2 — kept for schema parity) ---------- */

export async function listMarketplaceListings(
  supabase: Client,
  status: 'active' | 'sold' | 'removed' = 'active'
): Promise<MarketplaceListingRow[]> {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ---------- Seller reviews (Phase 2 — kept for schema parity) ---------- */

export async function listSellerReviews(supabase: Client, sellerId: string): Promise<SellerReviewRow[]> {
  const { data, error } = await supabase
    .from('seller_reviews')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ---------- Wishlist (Phase 2 — kept for schema parity) ---------- */

export async function listWishlistItems(supabase: Client, userId: string): Promise<WishlistItemRow[]> {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ---------- Batch photo scan ---------- */

export interface ScanCandidate {
  brand: string;
  model: string | null;
  variant: string | null;
  series: string | null;
  scale: string | null;
  confidence: number; // 0-1
  notes: string | null;
}

// Sends one photo (which may contain several cars) to the scan-photo Edge
// Function (supabase/functions/scan-photo) and gets back a candidate per
// car it detected, for the user to review/edit before anything is saved.
// Nothing is written to the DB by this call.
export async function scanPhotoForCars(supabase: Client, file: File): Promise<ScanCandidate[]> {
  const base64 = await fileToBase64(file);
  const { data, error } = await supabase.functions.invoke('scan-photo', {
    body: { image: base64, mediaType: file.type || 'image/jpeg' },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.candidates ?? []) as ScanCandidate[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:image/jpeg;base64,AAAA..." — strip the prefix.
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Bulk-insert accepted candidates in one go (used by the review list's
// "Add N cars to garage" button). Each candidate becomes its own
// collection_items row; falls back to sensible defaults for fields the
// scan couldn't determine.
export async function addCollectionItems(
  supabase: Client,
  userId: string,
  items: CollectionItemInput[]
): Promise<CollectionItemRow[]> {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from('collection_items')
    .insert(
      items.map((item) => ({
        owner_id: userId,
        brand: item.brand,
        model: item.model ?? null,
        series: item.series ?? null,
        scale: item.scale ?? null,
        variant: item.variant ?? null,
        card_type: item.cardType ?? null,
        rarity: item.rarity ?? null,
        condition: item.condition ?? null,
        qty: item.qty ?? 1,
        price_paid: item.pricePaid ?? 0,
        source: item.source ?? null,
        photo: item.photo ?? null,
        photos: item.photos ?? [],
        is_public: item.isPublic ?? false,
        for_sale: item.forSale ?? false,
        open_to_offers: item.openToOffers ?? false,
        open_to_trade: item.openToTrade ?? false,
        ask_price: item.askPrice ?? 0,
      }))
    )
    .select();
  if (error) throw error;
  return data ?? [];
}

/* ---------- Photo upload ---------- */

// Uploads to the 'car-photos' bucket created in supabase/schema.sql and
// returns a public URL to store in collection_items.photo / .photos.
export async function uploadCarPhoto(supabase: Client, userId: string, file: File): Promise<string> {
  const path = `${userId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('car-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('car-photos').getPublicUrl(path);
  return data.publicUrl;
}
