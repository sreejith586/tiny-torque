import { describe, it, expect } from 'vitest';
import { submitReport, blockUser, ReportError } from './service';
import type { Client } from '@/lib/supabase/types';

const TARGET_ID = '11111111-1111-4111-8111-111111111111';
const BLOCKER_ID = '22222222-2222-4222-8222-222222222222';
const BLOCKED_ID = '33333333-3333-4333-8333-333333333333';

type RpcCall = [string, Record<string, unknown>];

function mockClient(rpcResult: { data?: unknown; error?: { message?: string } | null }) {
  const calls: RpcCall[] = [];
  let insertPayload: Record<string, unknown> | undefined;
  const client = {
    _rpcCalls: calls,
    _insertPayload: () => insertPayload,
    rpc(name: string, args: Record<string, unknown>) {
      calls.push([name, args]);
      return Promise.resolve(rpcResult);
    },
    from(table: string) {
      if (table !== 'blocks') throw new Error(`unexpected table ${table}`);
      return {
        insert(payload: Record<string, unknown>) {
          insertPayload = payload;
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return client as unknown as Client & {
    _rpcCalls: RpcCall[];
    _insertPayload: () => Record<string, unknown> | undefined;
  };
}

describe('submitReport (MV-S6-05)', () => {
  it('routes through create_report with the right args', async () => {
    const c = mockClient({ data: { id: 'r1' }, error: null });
    const report = await submitReport(c, {
      targetType: 'listing',
      targetId: TARGET_ID,
      targetName: 'Hot Wheels Supra',
      reason: 'scam_or_fraud',
      notes: 'price too good',
    });
    expect(report).toMatchObject({ id: 'r1' });
    const [name, args] = c._rpcCalls[0]!;
    expect(name).toBe('create_report');
    expect(args).toMatchObject({
      p_target_type: 'listing',
      p_target_id: TARGET_ID,
      p_target_name: 'Hot Wheels Supra',
      p_reason: 'scam_or_fraud',
      p_notes: 'price too good',
    });
  });

  it('rejects an unknown reason', async () => {
    const c = mockClient({});
    await expect(
      submitReport(c, { targetType: 'user', targetId: TARGET_ID, reason: 'because' })
    ).rejects.toThrow();
  });

  it('maps a server error (e.g. rate_limited) to a coded ReportError', async () => {
    const c = mockClient({ error: { message: 'rate_limited' } });
    await expect(
      submitReport(c, { targetType: 'user', targetId: TARGET_ID, reason: 'spam' })
    ).rejects.toMatchObject({ code: 'rate_limited' });
    const c2 = mockClient({ error: { message: 'rate_limited' } });
    await expect(
      submitReport(c2, { targetType: 'user', targetId: TARGET_ID, reason: 'spam' })
    ).rejects.toBeInstanceOf(ReportError);
  });
});

describe('blockUser (MV-S6-05)', () => {
  it('inserts a blocker_id/blocked_id row', async () => {
    const c = mockClient({});
    await blockUser(c, BLOCKER_ID, BLOCKED_ID);
    expect(c._insertPayload()).toEqual({ blocker_id: BLOCKER_ID, blocked_id: BLOCKED_ID });
  });
});
