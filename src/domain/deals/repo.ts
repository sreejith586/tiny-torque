// The ONLY file in this module that talks to Supabase (D-007). All offer writes go through
// definer RPCs (create_offer / buy_now / transition_offer) — no direct offers writes (D-021).
import type { Client } from '@/lib/supabase/types';
import type { OfferRow, OfferStatus, OfferType } from './types';

type OfferAction = 'accept' | 'decline' | 'withdraw' | 'complete' | 'cancel';

export interface CreateOfferArgs {
  listingId: string;
  type: OfferType;
  amount?: number | null;
  tradeItemIds?: string[];
  message?: string | null;
}

/** create_offer RPC — validates terms server-side + inserts a pending offer + emits offer.created. */
export async function createOffer(supabase: Client, args: CreateOfferArgs): Promise<OfferRow> {
  const { data, error } = await supabase.rpc('create_offer', {
    p_listing_id: args.listingId,
    p_type: args.type,
    p_amount: args.amount ?? undefined,
    p_trade_item_ids: args.tradeItemIds ?? [],
    p_message: args.message ?? undefined,
  });
  if (error) throw error;
  return data as unknown as OfferRow;
}

/** Buy Now: definer RPC creates an accepted offer at price + reserves the listing. */
export async function buyNow(supabase: Client, listingId: string): Promise<OfferRow> {
  const { data, error } = await supabase.rpc('buy_now', { p_listing_id: listingId });
  if (error) throw error;
  return data as unknown as OfferRow;
}

/** The ONLY path for status changes (rule 8). */
export async function transition(
  supabase: Client,
  offerId: string,
  action: OfferAction
): Promise<OfferRow> {
  const { data, error } = await supabase.rpc('transition_offer', {
    p_offer_id: offerId,
    p_action: action,
  });
  if (error) throw error;
  return data as unknown as OfferRow;
}

export async function getOffer(supabase: Client, id: string): Promise<OfferRow | null> {
  const { data, error } = await supabase.from('offers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as OfferRow) ?? null;
}

export async function listReceived(
  supabase: Client,
  sellerId: string,
  status?: OfferStatus
): Promise<OfferRow[]> {
  let qb = supabase.from('offers').select('*').eq('seller_id', sellerId);
  if (status) qb = qb.eq('status', status);
  const { data, error } = await qb.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OfferRow[];
}

export async function listSent(
  supabase: Client,
  buyerId: string,
  status?: OfferStatus
): Promise<OfferRow[]> {
  let qb = supabase.from('offers').select('*').eq('buyer_id', buyerId);
  if (status) qb = qb.eq('status', status);
  const { data, error } = await qb.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OfferRow[];
}
