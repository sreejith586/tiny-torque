import { describe, it, expect } from 'vitest';
import {
  economyWeekRatios,
  jobHealth,
  jobResultSummary,
  jobRunSeconds,
  searchUsers,
  setEarnFreeze,
} from './service';
import type { JobRunRow } from './types';
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

describe('setEarnFreeze (MV-W05-06, F-26 earn freeze)', () => {
  it('routes through admin_set_earn_freeze with a trimmed note', async () => {
    const c = mockClient(true);
    await expect(setEarnFreeze(c, 'u1', true, '  bot pattern  ')).resolves.toBe(true);
    expect(c._rpcCalls[0]).toEqual([
      'admin_set_earn_freeze',
      { p_user: 'u1', p_frozen: true, p_note: 'bot pattern' },
    ]);
  });

  it('sends no note when it is blank and refuses an over-long one', async () => {
    const c = mockClient(false);
    await setEarnFreeze(c, 'u1', false, '   ');
    expect(c._rpcCalls[0]![1]).toEqual({ p_user: 'u1', p_frozen: false, p_note: undefined });
    await expect(setEarnFreeze(c, 'u1', true, 'x'.repeat(281))).rejects.toThrow('note_too_long');
  });
});

describe('economyWeekRatios (07 §3.4 — sinks ÷ sources, earned share of spend)', () => {
  const row = {
    week_start: '2026-11-02',
    earned: 14,
    purchased: 60,
    spent: 45,
    spent_from_earned: 9,
    world_spent: 45,
    expired: 0,
    refunded: 0,
    earners: 1,
    spenders: 1,
    buyers: 1,
  };
  it('derives the three ratios', () => {
    expect(economyWeekRatios(row)).toEqual({
      sinksOverSources: 3.21,
      earnedShareOfSpend: 0.2,
      worldShareOfSpend: 1,
    });
  });
  it('is null, never ∞ or a fake 0, when a denominator is 0', () => {
    expect(
      economyWeekRatios({ ...row, earned: 0, spent: 0, spent_from_earned: 0, world_spent: 0 })
    ).toEqual({
      sinksOverSources: null,
      earnedShareOfSpend: null,
      worldShareOfSpend: null,
    });
  });
});

describe('job runs helpers (MV-W04-04, 06 §5 job_runs)', () => {
  const run = (over: Partial<JobRunRow>): JobRunRow => ({
    id: 1,
    job: 'quest_reset',
    triggered_by: 'cron',
    run_at: '2026-11-10T00:05:00Z',
    started_at: '2026-11-10T00:05:00Z',
    finished_at: '2026-11-10T00:05:02Z',
    status: 'ok',
    result: {},
    error: null,
    ...over,
  });

  it('jobHealth: newest run per job, error count, dispatcher order then other jobs alphabetically', () => {
    const rows = jobHealth([
      run({ id: 1, job: 'season_rollover', started_at: '2026-11-10T01:00:00Z' }),
      run({ id: 2, job: 'expire_listings', started_at: '2026-11-10T00:30:00Z' }),
      run({
        id: 3,
        job: 'quest_reset',
        started_at: '2026-11-09T00:05:00Z',
        status: 'error',
        error: 'boom',
      }),
      run({ id: 4, job: 'quest_reset', started_at: '2026-11-10T00:05:00Z' }),
      run({
        id: 5,
        job: 'season_rollover',
        started_at: '2026-11-10T02:00:00Z',
        status: 'error',
        error: 'x',
      }),
    ]);
    expect(rows.map((r) => r.job)).toEqual(['quest_reset', 'season_rollover', 'expire_listings']);
    expect(rows[0]).toMatchObject({ runs: 2, errors: 1 });
    expect(rows[0]!.latest.id).toBe(4);
    expect(rows[1]).toMatchObject({ runs: 2, errors: 1 });
    expect(rows[1]!.latest.id).toBe(5);
    expect(jobHealth([])).toEqual([]);
  });

  it('jobRunSeconds: whole seconds, null while running', () => {
    expect(jobRunSeconds(run({}))).toBe(2);
    expect(jobRunSeconds(run({ finished_at: null }))).toBeNull();
    expect(jobRunSeconds(run({ finished_at: '2026-11-10T00:04:59Z' }))).toBe(0);
  });

  it('jobResultSummary: scalar keys only, in order', () => {
    expect(jobResultSummary({ expired: 3, users: 2, detail: { a: 1 } })).toBe(
      'expired 3 · users 2'
    );
    expect(jobResultSummary({ day: '2026-11-10', emitted: 2 })).toBe('day 2026-11-10 · emitted 2');
    expect(jobResultSummary(null)).toBe('');
  });
});
