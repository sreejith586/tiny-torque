// The ONLY file in this module that talks to Supabase (D-007). RLS is the real enforcement
// (insert only on a completed offer, by its real buyer, offer_id unique) — this just shapes calls.
import type { Client } from '@/lib/supabase/types';
import type { SellerReviewRow } from './types';

export async function createReview(
  supabase: Client,
  sellerId: string,
  buyerId: string,
  offerId: string,
  rating: number,
  comment: string | null
): Promise<SellerReviewRow> {
  const { data, error } = await supabase
    .from('seller_reviews')
    .insert({ seller_id: sellerId, buyer_id: buyerId, offer_id: offerId, rating, comment })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Which of these offers already have a review (F-10: one per completed deal). */
export async function listReviewedOfferIds(
  supabase: Client,
  offerIds: string[]
): Promise<Set<string>> {
  if (offerIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('seller_reviews')
    .select('offer_id')
    .in('offer_id', offerIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.offer_id));
}

export async function listReviewsForSeller(
  supabase: Client,
  sellerId: string
): Promise<SellerReviewRow[]> {
  const { data, error } = await supabase
    .from('seller_reviews')
    .select('*')
    .eq('seller_id', sellerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
