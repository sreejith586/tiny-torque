import { describe, it, expect } from 'vitest';
import { searchUsers } from './service';
import type { Client } from '@/lib/supabase/types';

function mockClient(data: unknown) {
  const calls: [string, Record<string, unknown>][] = [];
  const client = {
    _rpcCalls: calls,
    rpc(name: string, args: Record<string, unknown>) {
      calls.push([name, args]);
      return Promise.resolve({ data, error: null });
    },
  };
  return client as unknown as Client & { _rpcCalls: [string, Record<string, unknown>][] };
}

describe('searchUsers (MV-S6-07)', () => {
  it('trims the query and routes through admin_search_users', async () => {
    const c = mockClient([{ id: 'u1' }]);
    const users = await searchUsers(c, '  varun  ', 10);
    expect(users).toEqual([{ id: 'u1' }]);
    const [name, args] = c._rpcCalls[0]!;
    expect(name).toBe('admin_search_users');
    expect(args).toEqual({ p_query: 'varun', p_limit: 10 });
  });
});
