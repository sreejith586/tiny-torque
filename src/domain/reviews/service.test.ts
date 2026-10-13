import { describe, it, expect } from 'vitest';
import { submitReview, ReviewError } from './service';
import type { Client } from '@/lib/supabase/types';

const SELLER_ID = '11111111-1111-4111-8111-111111111111';
const BUYER_ID = '22222222-2222-4222-8222-222222222222';
const OFFER_ID = '33333333-3333-4333-8333-333333333333';

/** Mock client: records the seller_reviews insert payload, or returns a canned Postgres error. */
function mockClient(result: {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}) {
  let insertPayload: Record<string, unknown> | undefined;
  const client = {
    _insertPayload: () => insertPayload,
    from(table: string) {
      if (table !== 'seller_reviews') throw new Error(`unexpected table ${table}`);
      return {
        insert(payload: Record<string, unknown>) {
          insertPayload = payload;
          return { select: () => ({ single: () => Promise.resolve(result) }) };
        },
      };
    },
  };
  return client as unknown as Client & {
    _insertPayload: () => Record<string, unknown> | undefined;
  };
}

describe('submitReview (MV-S6-03)', () => {
  it('inserts seller_id/buyer_id/offer_id/rating/comment', async () => {
    const c = mockClient({ data: { id: 'r1' }, error: null });
    const review = await submitReview(c, SELLER_ID, BUYER_ID, {
      offerId: OFFER_ID,
      rating: 4,
      comment: '  Great deal  ',
    });
    expect(review).toMatchObject({ id: 'r1' });
    expect(c._insertPayload()).toEqual({
      seller_id: SELLER_ID,
      buyer_id: BUYER_ID,
      offer_id: OFFER_ID,
      rating: 4,
      comment: 'Great deal',
    });
  });

  it('rejects a rating outside 1-5', async () => {
    const c = mockClient({});
    await expect(
      submitReview(c, SELLER_ID, BUYER_ID, { offerId: OFFER_ID, rating: 6 })
    ).rejects.toThrow();
  });

  it('rejects a comment over 500 chars', async () => {
    const c = mockClient({});
    await expect(
      submitReview(c, SELLER_ID, BUYER_ID, {
        offerId: OFFER_ID,
        rating: 5,
        comment: 'x'.repeat(501),
      })
    ).rejects.toThrow();
  });

  it('maps a unique-violation to ReviewError("already_reviewed")', async () => {
    const c = mockClient({ data: null, error: { code: '23505' } });
    await expect(
      submitReview(c, SELLER_ID, BUYER_ID, { offerId: OFFER_ID, rating: 5 })
    ).rejects.toMatchObject({ code: 'already_reviewed' });
    await expect(
      submitReview(c, SELLER_ID, BUYER_ID, { offerId: OFFER_ID, rating: 5 })
    ).rejects.toBeInstanceOf(ReviewError);
  });

  it('maps an RLS denial to ReviewError("not_allowed")', async () => {
    const c = mockClient({ data: null, error: { code: '42501' } });
    await expect(
      submitReview(c, SELLER_ID, BUYER_ID, { offerId: OFFER_ID, rating: 5 })
    ).rejects.toMatchObject({ code: 'not_allowed' });
  });
});
