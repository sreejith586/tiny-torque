import { describe, it, expect } from 'vitest';
import {
  createCashOffer,
  buyNow,
  proposeTrade,
  acceptOffer,
  completeOffer,
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
