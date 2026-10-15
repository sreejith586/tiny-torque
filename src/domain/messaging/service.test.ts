import { describe, it, expect } from 'vitest';
import { sendMessage } from './service';
import type { Client } from '@/lib/supabase/types';

const OFFER_ID = '11111111-1111-4111-8111-111111111111';
const SENDER_ID = '22222222-2222-4222-8222-222222222222';

/** Mock client: records the deal_messages insert payload. message.sent is emitted by a real DB
 * trigger now (20261013020000_notifications_v2.sql), not a second app-level call — nothing to
 * mock or assert here, that side effect is covered at the SQL level (supabase/tests/0017). */
function mockClient(insertResult: { data?: unknown; error?: unknown }) {
  let insertPayload: Record<string, unknown> | undefined;
  const client = {
    _insertPayload: () => insertPayload,
    from(table: string) {
      if (table !== 'deal_messages') throw new Error(`unexpected table ${table}`);
      return {
        insert(payload: Record<string, unknown>) {
          insertPayload = payload;
          return {
            select() {
              return { single: () => Promise.resolve(insertResult) };
            },
          };
        },
      };
    },
  };
  return client as unknown as Client & {
    _insertPayload: () => Record<string, unknown> | undefined;
  };
}

describe('sendMessage (MV-S6-02)', () => {
  it('inserts the trimmed body', async () => {
    const c = mockClient({ data: { id: 'm1', offer_id: OFFER_ID, body: 'hi' }, error: null });
    const message = await sendMessage(c, SENDER_ID, { offerId: OFFER_ID, body: '  hi  ' });
    expect(message).toMatchObject({ id: 'm1' });
    expect(c._insertPayload()).toMatchObject({
      offer_id: OFFER_ID,
      sender_id: SENDER_ID,
      body: 'hi',
    });
  });

  it('rejects an empty body at the zod boundary', async () => {
    const c = mockClient({});
    await expect(sendMessage(c, SENDER_ID, { offerId: OFFER_ID, body: '   ' })).rejects.toThrow();
  });

  it('rejects a body over 2000 chars', async () => {
    const c = mockClient({});
    await expect(
      sendMessage(c, SENDER_ID, { offerId: OFFER_ID, body: 'x'.repeat(2001) })
    ).rejects.toThrow();
  });

  it('rejects a non-uuid offer id', async () => {
    const c = mockClient({});
    await expect(
      sendMessage(c, SENDER_ID, { offerId: 'not-a-uuid', body: 'hi' })
    ).rejects.toThrow();
  });

  it('propagates an insert error (e.g. RLS denial on a declined offer)', async () => {
    const c = mockClient({ data: null, error: { message: 'new row violates row-level security' } });
    await expect(sendMessage(c, SENDER_ID, { offerId: OFFER_ID, body: 'hi' })).rejects.toBeTruthy();
  });
});
