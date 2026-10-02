import { describe, it, expect } from 'vitest';
import {
  allowedActions,
  canTransition,
  validateCashOffer,
  validateTradeOffer,
  type OfferAction,
  type Viewer,
  type ListingTerms,
} from './state';
import type { OfferStatus } from './types';

const terms = (over: Partial<ListingTerms> = {}): ListingTerms => ({
  price: 100,
  minOffer: 50,
  openToOffers: true,
  listingType: 'both',
  status: 'active',
  ...over,
});

describe('allowedActions (F-08 state machine)', () => {
  const cases: [OfferStatus, Viewer, OfferAction[]][] = [
    ['pending', 'seller', ['accept', 'decline']],
    ['pending', 'buyer', ['withdraw']],
    ['accepted', 'seller', ['complete', 'cancel']],
    ['accepted', 'buyer', ['cancel']],
    ['declined', 'seller', []],
    ['withdrawn', 'buyer', []],
    ['completed', 'seller', []],
    ['cancelled', 'buyer', []],
    ['expired', 'seller', []],
  ];
  it.each(cases)('%s / %s → %j', (status, viewer, expected) => {
    expect(allowedActions(status, viewer)).toEqual(expected);
  });

  it('canTransition agrees with allowedActions', () => {
    expect(canTransition('pending', 'seller', 'accept')).toBe(true);
    expect(canTransition('pending', 'buyer', 'accept')).toBe(false);
    expect(canTransition('accepted', 'buyer', 'complete')).toBe(false);
    expect(canTransition('completed', 'seller', 'cancel')).toBe(false);
  });
});

describe('validateCashOffer', () => {
  it('accepts an amount between min_offer and 3× price', () => {
    expect(validateCashOffer(60, terms())).toEqual({ ok: true });
    expect(validateCashOffer(300, terms())).toEqual({ ok: true }); // exactly 3×
  });
  it('rejects below the floor and above the sanity cap', () => {
    expect(validateCashOffer(40, terms())).toEqual({ ok: false, error: 'below_min_offer' });
    expect(validateCashOffer(301, terms())).toEqual({ ok: false, error: 'above_sanity_cap' });
  });
  it('floor falls back to price when min_offer is null', () => {
    expect(validateCashOffer(90, terms({ minOffer: null }))).toEqual({
      ok: false,
      error: 'below_min_offer',
    });
    expect(validateCashOffer(100, terms({ minOffer: null }))).toEqual({ ok: true });
  });
  it('requires open_to_offers, an active listing, and a sellable type', () => {
    expect(validateCashOffer(60, terms({ openToOffers: false }))).toEqual({
      ok: false,
      error: 'not_open_to_offers',
    });
    expect(validateCashOffer(60, terms({ status: 'reserved' }))).toEqual({
      ok: false,
      error: 'listing_not_available',
    });
    expect(validateCashOffer(60, terms({ listingType: 'trade' }))).toEqual({
      ok: false,
      error: 'not_for_sale',
    });
    expect(validateCashOffer(0, terms())).toEqual({ ok: false, error: 'amount_required' });
  });
});

describe('validateTradeOffer', () => {
  it('accepts 1–3 items on a trade-capable active listing', () => {
    expect(validateTradeOffer(1, terms())).toEqual({ ok: true });
    expect(validateTradeOffer(3, terms({ listingType: 'trade' }))).toEqual({ ok: true });
  });
  it('rejects wrong counts, sale-only listings, and inactive listings', () => {
    expect(validateTradeOffer(0, terms())).toEqual({ ok: false, error: 'trade_items_1_to_3' });
    expect(validateTradeOffer(4, terms())).toEqual({ ok: false, error: 'trade_items_1_to_3' });
    expect(validateTradeOffer(1, terms({ listingType: 'sale' }))).toEqual({
      ok: false,
      error: 'not_open_to_trade',
    });
    expect(validateTradeOffer(1, terms({ status: 'sold' }))).toEqual({
      ok: false,
      error: 'listing_not_available',
    });
  });
});
