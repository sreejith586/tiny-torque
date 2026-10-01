import { describe, it, expect } from 'vitest';
import { browseListings, canPublishListing, publishListing, ListingLimitError } from './service';
import type { Client } from '@/lib/supabase/types';

type Call = [table: string, method: string, ...args: unknown[]];

/** A chainable, call-recording Supabase stub that dispatches per table. */
function mockClient(opts: {
  listings?: unknown[];
  count?: number;
  slots?: number;
  media?: unknown[];
  profile?: Record<string, unknown>;
}) {
  const calls: Call[] = [];
  function qb(table: string, result: unknown) {
    const rec =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push([table, method, ...args]);
        return builder;
      };
    const builder: Record<string, unknown> = {
      select: rec('select'),
      eq: rec('eq'),
      is: rec('is'),
      or: rec('or'),
      in: rec('in'),
      gte: rec('gte'),
      lte: rec('lte'),
      textSearch: rec('textSearch'),
      order: rec('order'),
      limit: rec('limit'),
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej),
    };
    return builder;
  }
  const client = {
    _calls: calls,
    from(table: string) {
      calls.push([table, 'from']);
      if (table === 'marketplace_listings')
        return qb(table, { data: opts.listings ?? [], count: opts.count ?? 0, error: null });
      if (table === 'media') return qb(table, { data: opts.media ?? [], error: null });
      if (table === 'profiles')
        return qb(table, { data: opts.profile ?? { country_code: 'AE' }, error: null });
      return qb(table, { data: [], error: null });
    },
    rpc() {
      return Promise.resolve({ data: opts.slots ?? 0, error: null });
    },
  };
  return client as unknown as Client & { _calls: Call[] };
}

function calls(c: Client): Call[] {
  return (c as unknown as { _calls: Call[] })._calls;
}
const marketCalls = (c: Client) => calls(c).filter(([t]) => t === 'marketplace_listings');

describe('browseListings filters (MV-S4-02)', () => {
  it('always scopes to active, non-deleted, unexpired, and paginates by limit+1', async () => {
    const c = mockClient({ listings: [] });
    await browseListings(c, { limit: 10 }, 'AE');
    const mc = marketCalls(c);
    expect(mc).toContainEqual(['marketplace_listings', 'eq', 'status', 'active']);
    expect(mc).toContainEqual(['marketplace_listings', 'is', 'deleted_at', null]);
    expect(mc.some(([, m, col]) => m === 'or' && String(col).includes('expires_at'))).toBe(true);
    expect(mc).toContainEqual(['marketplace_listings', 'limit', 11]);
    // two order() calls: sort column then id tiebreaker
    expect(mc.filter(([, m]) => m === 'order')).toHaveLength(2);
  });

  it("defaults the country filter to the viewer's", async () => {
    const c = mockClient({ listings: [] });
    await browseListings(c, {}, 'IN');
    expect(marketCalls(c)).toContainEqual(['marketplace_listings', 'eq', 'country_code', 'IN']);
  });

  it("'all' country drops the country filter", async () => {
    const c = mockClient({ listings: [] });
    await browseListings(c, { country: 'all' }, 'IN');
    expect(marketCalls(c).some(([, m, col]) => m === 'eq' && col === 'country_code')).toBe(false);
  });

  it('applies brand + price-range + listingType filters when set', async () => {
    const c = mockClient({ listings: [] });
    await browseListings(
      c,
      { brand: 'Hot Wheels', minPrice: 10, maxPrice: 50, listingType: 'trade' },
      'AE'
    );
    const mc = marketCalls(c);
    expect(mc).toContainEqual(['marketplace_listings', 'eq', 'brand', 'Hot Wheels']);
    expect(mc).toContainEqual(['marketplace_listings', 'gte', 'price', 10]);
    expect(mc).toContainEqual(['marketplace_listings', 'lte', 'price', 50]);
    expect(mc).toContainEqual(['marketplace_listings', 'eq', 'listing_type', 'trade']);
  });

  it('attaches media references by source item', async () => {
    const listing = { id: 'l1', source_item_id: 'it1', brand: 'HW' };
    const c = mockClient({ listings: [listing], media: [{ id: 'm1', entity_id: 'it1' }] });
    const { items } = await browseListings(c, {}, 'AE');
    expect(items[0].media).toEqual([{ id: 'm1' }]);
  });
});

describe('canPublishListing (D-021)', () => {
  it('allows when active listings are under the slot count', async () => {
    const c = mockClient({ count: 1, slots: 2 });
    expect(await canPublishListing(c, 'u1')).toEqual({ allowed: true, active: 1, slots: 2 });
  });
  it('blocks when at the limit', async () => {
    const c = mockClient({ count: 2, slots: 2 });
    expect((await canPublishListing(c, 'u1')).allowed).toBe(false);
  });
});

describe('publishListing', () => {
  it('throws ListingLimitError when the seller is at their cap', async () => {
    const c = mockClient({ count: 2, slots: 2 });
    await expect(
      publishListing(c, 'u1', { brand: 'Hot Wheels', price: 10 })
    ).rejects.toBeInstanceOf(ListingLimitError);
  });
});
