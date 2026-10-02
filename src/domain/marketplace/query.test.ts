import { describe, it, expect } from 'vitest';
import { defaultMinOffer, listingExpiry, SORT_CONFIG, LISTING_TTL_DAYS } from './query';
import { listingPublishSchema } from './schema';

describe('defaultMinOffer', () => {
  it('equals price when not open to offers', () => {
    expect(defaultMinOffer(100, false, 10)).toBe(100);
  });
  it('honours a sane supplied floor when open to offers', () => {
    expect(defaultMinOffer(100, true, 60)).toBe(60);
  });
  it('falls back to price for an out-of-range or missing floor', () => {
    expect(defaultMinOffer(100, true, 150)).toBe(100); // above price
    expect(defaultMinOffer(100, true, 0)).toBe(100); // non-positive
    expect(defaultMinOffer(100, true, null)).toBe(100); // not supplied
  });
});

describe('listingExpiry', () => {
  it('is LISTING_TTL_DAYS ahead of the given instant', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const expiry = new Date(listingExpiry(from));
    const days = (expiry.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(LISTING_TTL_DAYS);
  });
});

describe('SORT_CONFIG', () => {
  it('maps each sort to a column + direction with price asc/desc distinct', () => {
    expect(SORT_CONFIG.newest).toEqual({ column: 'created_at', ascending: false });
    expect(SORT_CONFIG.price_asc).toEqual({ column: 'price', ascending: true });
    expect(SORT_CONFIG.price_desc).toEqual({ column: 'price', ascending: false });
    expect(SORT_CONFIG.offers).toEqual({ column: 'offer_count', ascending: false });
  });
});

describe('listingPublishSchema (D-013)', () => {
  it('rejects a minimum offer above the price', () => {
    const r = listingPublishSchema.safeParse({ brand: 'Hot Wheels', price: 50, minOffer: 80 });
    expect(r.success).toBe(false);
  });
  it('accepts a valid listing and applies defaults', () => {
    const r = listingPublishSchema.safeParse({ brand: 'Hot Wheels', price: 50 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.listingType).toBe('sale');
      expect(r.data.currency).toBe('AED');
      expect(r.data.qty).toBe(1);
    }
  });
  it('requires a brand', () => {
    expect(listingPublishSchema.safeParse({ brand: '', price: 1 }).success).toBe(false);
  });
});
