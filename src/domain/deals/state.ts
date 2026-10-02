// Offer state machine — client-side mirror of the DB's transition_offer (F-08). The DB RPC is the
// source of truth + enforcement; this pure helper drives which action buttons a viewer sees, so it
// must stay in lock-step with the migration. Table-tested in state.test.ts.
import type { OfferStatus } from './types';

export type OfferAction = 'accept' | 'decline' | 'withdraw' | 'complete' | 'cancel';
export type Viewer = 'buyer' | 'seller';

/** The actions `viewer` may take on an offer in `status`. Empty for terminal/other states. */
export function allowedActions(status: OfferStatus, viewer: Viewer): OfferAction[] {
  if (status === 'pending') return viewer === 'seller' ? ['accept', 'decline'] : ['withdraw'];
  if (status === 'accepted') return viewer === 'seller' ? ['complete', 'cancel'] : ['cancel'];
  return [];
}

export function canTransition(status: OfferStatus, viewer: Viewer, action: OfferAction): boolean {
  return allowedActions(status, viewer).includes(action);
}

// ---------- cash-offer validation (F-08: open_to_offers, >= min_offer, <= 3x price sanity) ----------
export interface ListingTerms {
  price: number;
  minOffer: number | null;
  openToOffers: boolean;
  listingType: 'sale' | 'trade' | 'both';
  status: string;
}

export type OfferValidation = { ok: true } | { ok: false; error: string };

export function validateCashOffer(amount: number, l: ListingTerms): OfferValidation {
  if (l.status !== 'active') return { ok: false, error: 'listing_not_available' };
  if (l.listingType === 'trade') return { ok: false, error: 'not_for_sale' };
  if (!l.openToOffers) return { ok: false, error: 'not_open_to_offers' };
  if (!(amount > 0)) return { ok: false, error: 'amount_required' };
  const floor = l.minOffer ?? l.price;
  if (amount < floor) return { ok: false, error: 'below_min_offer' };
  if (amount > l.price * 3) return { ok: false, error: 'above_sanity_cap' }; // ≤ 3× price
  return { ok: true };
}

export function validateTradeOffer(itemCount: number, l: ListingTerms): OfferValidation {
  if (l.status !== 'active') return { ok: false, error: 'listing_not_available' };
  if (l.listingType === 'sale') return { ok: false, error: 'not_open_to_trade' };
  if (itemCount < 1 || itemCount > 3) return { ok: false, error: 'trade_items_1_to_3' };
  return { ok: true };
}
