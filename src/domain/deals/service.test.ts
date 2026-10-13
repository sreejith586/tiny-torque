import { describe, it, expect } from 'vitest';
import {
  createCashOffer,
  buyNow,
  proposeTrade,
  acceptOffer,
  completeOffer,
  getReceivedInbox,
  getSentInbox,
  OfferError,
} from './service';
import type { Client } from '@/lib/supabase/types';

type RpcCall = [name: string, args: Record<string, unknown>];

/** Mock client whose rpc() records calls and returns a per-name result (data or error). */
function mockClient(results: Record<string, { data?: unknown; error?: unknown }>) {
  const calls: RpcCall[] = [];
  const client = {
    _rpc: calls,
    rpc(name: string, args: Record<string, unknown>) {
      calls.push([name, args]);
      return Promise.resolve(
        results[name] ?? { data: { id: 'o1', status: 'pending' }, error: null }
      );
    },
  };
  return client as unknown as Client & { _rpc: RpcCall[] };
}
const rpcs = (c: Client) => (c as unknown as { _rpc: RpcCall[] })._rpc;
const L1 = '11111111-1111-4111-8111-111111111111';
const I1 = '22222222-2222-4222-8222-222222222222';
const I2 = '33333333-3333-4333-8333-333333333333';

describe('createCashOffer (MV-S5-02)', () => {
  it('routes through create_offer with type cash + amount', async () => {
    const c = mockClient({ create_offer: { data: { id: 'o9', status: 'pending' } } });
    const offer = await createCashOffer(c, { listingId: L1, amount: 60 });
    expect(offer).toMatchObject({ id: 'o9' });
    const [, args] = rpcs(c).find(([n]) => n === 'create_offer')!;
    expect(args).toMatchObject({ p_listing_id: L1, p_type: 'cash', p_amount: 60 });
  });

  it('maps a server validation error to a coded OfferError', async () => {
    const c = mockClient({ create_offer: { error: { message: 'below_min_offer' } } });
    await expect(createCashOffer(c, { listingId: L1, amount: 40 })).rejects.toMatchObject({
      code: 'below_min_offer',
    });
  });

  it('rejects a non-uuid listing id at the zod boundary', async () => {
    const c = mockClient({});
    await expect(createCashOffer(c, { listingId: 'nope', amount: 60 })).rejects.toBeTruthy();
    expect(rpcs(c).length).toBe(0); // never reached the RPC
  });
});

describe('proposeTrade', () => {
  it('routes through create_offer with type trade + item ids', async () => {
    const c = mockClient({ create_offer: { data: { id: 'ot', status: 'pending' } } });
    await proposeTrade(c, { listingId: L1, tradeItemIds: [I1, I2] });
    const [, args] = rpcs(c).find(([n]) => n === 'create_offer')!;
    expect(args).toMatchObject({ p_type: 'trade', p_trade_item_ids: [I1, I2] });
  });

  it('maps trade_item_invalid from the server', async () => {
    const c = mockClient({ create_offer: { error: { message: 'trade_item_invalid' } } });
    await expect(proposeTrade(c, { listingId: L1, tradeItemIds: [I1] })).rejects.toMatchObject({
      code: 'trade_item_invalid',
    });
  });

  it('enforces the 1–3 item count at the zod boundary', async () => {
    const c = mockClient({});
    await expect(proposeTrade(c, { listingId: L1, tradeItemIds: [] })).rejects.toBeTruthy();
    await expect(
      proposeTrade(c, { listingId: L1, tradeItemIds: [I1, I2, I1, I2] })
    ).rejects.toBeTruthy();
  });
});

describe('buyNow', () => {
  it('delegates to the buy_now RPC', async () => {
    const c = mockClient({ buy_now: { data: { id: 'o1', status: 'accepted' } } });
    const offer = await buyNow(c, L1);
    expect(offer).toMatchObject({ status: 'accepted' });
    expect(rpcs(c).some(([n, a]) => n === 'buy_now' && a.p_listing_id === L1)).toBe(true);
  });

  it('maps a not_for_sale error', async () => {
    const c = mockClient({ buy_now: { error: { message: 'not_for_sale' } } });
    await expect(buyNow(c, L1)).rejects.toBeInstanceOf(OfferError);
  });
});

describe('transition wrappers', () => {
  it('route through transition_offer with the right action', async () => {
    const c = mockClient({});
    await acceptOffer(c, 'o1');
    await completeOffer(c, 'o1');
    const actions = rpcs(c)
      .filter(([n]) => n === 'transition_offer')
      .map(([, a]) => a.p_action);
    expect(actions).toEqual(['accept', 'complete']);
  });
});

// ---------- inbox grouping (MV-S5-04) ----------
// A mock whose .from(table) returns a thenable, chainable query builder resolving to a canned
// {data, error} per table — good enough for testing the service's grouping/enrichment, which is
// the only logic that lives in TS; row-level filtering is the real repo + RLS's job (pgTAP).
function mockTables(tables: Record<string, { data: unknown; error?: unknown }>) {
  return {
    from(table: string) {
      const result = tables[table] ?? { data: [], error: null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        is: () => chain,
        order: () => chain,
        then: (res: (v: unknown) => void) => res(result),
      };
      return chain;
    },
  } as unknown as Client;
}

const SELLER = 'aaaaaaaa-0000-4000-8000-000000000001';
const BUYER1 = 'aaaaaaaa-0000-4000-8000-000000000002';
const BUYER2 = 'aaaaaaaa-0000-4000-8000-000000000003';
const LISTING1 = 'bbbbbbbb-0000-4000-8000-000000000001';
const LISTING2 = 'bbbbbbbb-0000-4000-8000-000000000002';

describe('getReceivedInbox (MV-S5-04)', () => {
  it('groups offers by listing, newest group first, with the buyer name attached', async () => {
    const c = mockTables({
      offers: {
        data: [
          {
            id: 'o1',
            listing_id: LISTING2,
            buyer_id: BUYER1,
            seller_id: SELLER,
            type: 'cash',
            amount: 50,
            status: 'pending',
            trade_item_ids: [],
            created_at: '2026-10-12T10:00:00Z',
          },
          {
            id: 'o2',
            listing_id: LISTING1,
            buyer_id: BUYER1,
            seller_id: SELLER,
            type: 'cash',
            amount: 80,
            status: 'pending',
            trade_item_ids: [],
            created_at: '2026-10-11T10:00:00Z',
          },
          {
            id: 'o3',
            listing_id: LISTING1,
            buyer_id: BUYER2,
            seller_id: SELLER,
            type: 'cash',
            amount: 70,
            status: 'declined',
            decline_reason: 'auto_declined',
            trade_item_ids: [],
            created_at: '2026-10-10T10:00:00Z',
          },
        ],
      },
      marketplace_listings: {
        data: [
          { id: LISTING1, brand: 'Hot Wheels', seller_name: 'Seller One', source_item_id: null },
          { id: LISTING2, brand: 'Matchbox', seller_name: 'Seller One', source_item_id: null },
        ],
      },
      public_profiles: {
        data: [
          { id: BUYER1, display_name: 'Buyer One' },
          { id: BUYER2, display_name: 'Buyer Two' },
        ],
      },
    });

    const groups = await getReceivedInbox(c, SELLER);
    expect(groups).toHaveLength(2);
    // LISTING2's only offer (10:00) is newer than LISTING1's newest offer (o2, also 10:00 the day
    // before) — group order follows each group's first (newest) offer.
    expect(groups[0]!.listing?.id).toBe(LISTING2);
    expect(groups[1]!.listing?.id).toBe(LISTING1);
    expect(groups[1]!.offers).toHaveLength(2);
    expect(groups[1]!.offers.map((o) => o.counterpartyName)).toEqual(['Buyer One', 'Buyer Two']);
  });
});

describe('getSentInbox (MV-S5-04)', () => {
  it('does not attach a counterparty name (the viewer is already the buyer)', async () => {
    const c = mockTables({
      offers: {
        data: [
          {
            id: 'o1',
            listing_id: LISTING1,
            buyer_id: BUYER1,
            seller_id: SELLER,
            type: 'cash',
            amount: 80,
            status: 'pending',
            trade_item_ids: [],
            created_at: '2026-10-11T10:00:00Z',
          },
        ],
      },
      marketplace_listings: {
        data: [
          { id: LISTING1, brand: 'Hot Wheels', seller_name: 'Seller One', source_item_id: null },
        ],
      },
    });

    const groups = await getSentInbox(c, BUYER1);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.offers[0]!.counterpartyName).toBeNull();
    expect(groups[0]!.listing?.seller_name).toBe('Seller One');
  });
});
