// Deals service (MV-S5-02, F-08). Components/routes import from here, never from repo.
// Offer creation + status changes go only through definer RPCs (create_offer / buy_now /
// transition_offer, rule 8 / D-021); each RPC validates server-side and emits its own
// domain_events row (rule 9). The buyer is resolved from auth.uid() inside the RPCs.
//
// NOTE: the block check (a blocked user cannot offer) belongs in create_offer / buy_now and wires
// in when the `blocks` table lands in S6-01 (migration 0008). Harmless until the `offers` flag is
// enabled. The pure validateCashOffer/validateTradeOffer helpers mirror create_offer's checks for
// client-side pre-submit UX; the RPC is authoritative.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { cashOfferSchema, tradeOfferSchema } from './schema';
import type { OfferRow, OfferStatus } from './types';

export class OfferError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'OfferError';
  }
}

/** Map a Postgres/RPC error (its raise message is the error code) to a typed OfferError. */
function toOfferError(e: unknown): never {
  const msg = (e as { message?: string } | null)?.message;
  throw new OfferError(msg && msg.length ? msg : 'offer_failed');
}

export async function createCashOffer(supabase: Client, input: unknown): Promise<OfferRow> {
  const v = cashOfferSchema.parse(input);
  try {
    return await repo.createOffer(supabase, {
      listingId: v.listingId,
      type: 'cash',
      amount: v.amount,
      message: v.message ?? null,
    });
  } catch (e) {
    toOfferError(e);
  }
}

export async function proposeTrade(supabase: Client, input: unknown): Promise<OfferRow> {
  const v = tradeOfferSchema.parse(input);
  try {
    return await repo.createOffer(supabase, {
      listingId: v.listingId,
      type: 'trade',
      amount: v.cashTopUp ?? null,
      tradeItemIds: v.tradeItemIds,
      message: v.message ?? null,
    });
  } catch (e) {
    toOfferError(e);
  }
}

export async function buyNow(supabase: Client, listingId: string): Promise<OfferRow> {
  try {
    return await repo.buyNow(supabase, listingId);
  } catch (e) {
    toOfferError(e);
  }
}

// ---------- transitions (RPC enforces role + state; events emitted in the RPC) ----------
export const acceptOffer = (s: Client, offerId: string) => repo.transition(s, offerId, 'accept');
export const declineOffer = (s: Client, offerId: string) => repo.transition(s, offerId, 'decline');
export const withdrawOffer = (s: Client, offerId: string) =>
  repo.transition(s, offerId, 'withdraw');
export const completeOffer = (s: Client, offerId: string) =>
  repo.transition(s, offerId, 'complete');
export const cancelOffer = (s: Client, offerId: string) => repo.transition(s, offerId, 'cancel');

// ---------- inbox ----------
export const listReceivedOffers = (s: Client, sellerId: string, status?: OfferStatus) =>
  repo.listReceived(s, sellerId, status);
export const listSentOffers = (s: Client, buyerId: string, status?: OfferStatus) =>
  repo.listSent(s, buyerId, status);
export const getOffer = repo.getOffer;
