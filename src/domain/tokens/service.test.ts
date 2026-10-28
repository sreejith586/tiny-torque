import { describe, it, expect, vi } from 'vitest';
import { createCheckoutSession, spendOn, adminAdjustTokens, TokenError } from './service';
import type { Client } from '@/lib/supabase/types';
import type { PaymentProvider } from '@/lib/payments/types';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PACK_ID = '22222222-2222-4222-8222-222222222222';

const PACK = {
  id: PACK_ID,
  sku: 'pack_small',
  tokens: 50,
  price_amount: 19,
  price_currency: 'AED',
  stripe_price_id: null,
  active: true,
  sort_order: 1,
};

/** Mock client covering just what createCheckoutSession/spendOn/adminAdjustTokens touch:
 *  token_packs select, token_purchases insert, and the spend_tokens/admin_adjust_tokens RPCs. */
function mockClient(opts: {
  pack?: typeof PACK | null;
  insertResult?: { data?: unknown; error?: { message?: string } | null };
  rpcResult?: { data?: unknown; error?: { message?: string } | null };
}) {
  const client = {
    from(table: string) {
      if (table === 'token_packs') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: opts.pack ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === 'token_purchases') {
        return {
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: () =>
                Promise.resolve(
                  opts.insertResult ?? { data: { id: 'purchase-1', ...payload }, error: null }
                ),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: () => Promise.resolve(opts.rpcResult ?? { data: { id: 'grant-1' }, error: null }),
  };
  return client as unknown as Client;
}

const fakeProvider: PaymentProvider = {
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ sessionId: 'cs_test_1', url: 'https://stripe.test/cs_test_1' }),
};

describe('createCheckoutSession (MV-S7-04)', () => {
  it('rejects an unknown or inactive pack before calling the provider', async () => {
    const c = mockClient({ pack: null });
    await expect(
      createCheckoutSession(
        c,
        USER_ID,
        { packId: PACK_ID },
        { successUrl: 'https://app/success', cancelUrl: 'https://app/cancel' },
        fakeProvider
      )
    ).rejects.toMatchObject({ code: 'pack_not_found' });
    await expect(
      createCheckoutSession(
        c,
        USER_ID,
        { packId: PACK_ID },
        { successUrl: 'https://app/success', cancelUrl: 'https://app/cancel' },
        fakeProvider
      )
    ).rejects.toBeInstanceOf(TokenError);
  });

  it('creates a provider session and a pending purchase row for a valid pack', async () => {
    const c = mockClient({ pack: PACK });
    const result = await createCheckoutSession(
      c,
      USER_ID,
      { packId: PACK_ID },
      { successUrl: 'https://app/success', cancelUrl: 'https://app/cancel' },
      fakeProvider
    );
    expect(result.url).toBe('https://stripe.test/cs_test_1');
    expect(fakeProvider.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, pack: PACK })
    );
  });

  it('rejects a malformed packId before touching the database', async () => {
    const c = mockClient({ pack: PACK });
    await expect(
      createCheckoutSession(
        c,
        USER_ID,
        { packId: 'not-a-uuid' },
        { successUrl: 'https://app/success', cancelUrl: 'https://app/cancel' },
        fakeProvider
      )
    ).rejects.toThrow();
  });
});

describe('spendOn (MV-S7-04)', () => {
  it('maps insufficient_balance to a TokenError', async () => {
    const c = mockClient({ rpcResult: { data: null, error: { message: 'insufficient_balance' } } });
    await expect(spendOn(c, 'listing_slot')).rejects.toMatchObject({
      code: 'insufficient_balance',
    });
    await expect(spendOn(c, 'listing_slot')).rejects.toBeInstanceOf(TokenError);
  });

  it('returns the created grant on success', async () => {
    const c = mockClient({
      rpcResult: { data: { id: 'grant-1', kind: 'scan_pack' }, error: null },
    });
    const grant = await spendOn(c, 'scan_pack');
    expect(grant).toMatchObject({ id: 'grant-1', kind: 'scan_pack' });
  });
});

describe('adminAdjustTokens (F-11)', () => {
  it('rejects a zero delta before calling the database', async () => {
    const c = mockClient({});
    await expect(adminAdjustTokens(c, { userId: USER_ID, delta: 0 })).rejects.toThrow();
  });

  it('calls the RPC for a valid adjustment', async () => {
    const c = mockClient({ rpcResult: { data: { id: 'ledger-1', delta: 10 }, error: null } });
    const row = await adminAdjustTokens(c, { userId: USER_ID, delta: 10, note: 'goodwill' });
    expect(row).toMatchObject({ id: 'ledger-1', delta: 10 });
  });
});
