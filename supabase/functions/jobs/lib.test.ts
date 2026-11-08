// Deno unit tests for the jobs runner pure helpers (MV-W04-04). Offline — no network, no Supabase.
// Run: deno test supabase/functions/jobs/lib.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  JOB_NAMES,
  groupExpiringBatches,
  parseJobRequest,
  resetWindow,
  secretFromHeaders,
  summariseRuns,
  utcDay,
  verifySecret,
  type JobRunRow,
} from './lib.ts';

Deno.test(
  'parseJobRequest: empty body means all / now; a known job passes; at is normalised',
  () => {
    assertEquals(parseJobRequest(null), { ok: true, value: { job: 'all', at: null } });
    assertEquals(parseJobRequest({}), { ok: true, value: { job: 'all', at: null } });
    assertEquals(parseJobRequest({ job: 'quest_reset' }), {
      ok: true,
      value: { job: 'quest_reset', at: null },
    });
    assertEquals(parseJobRequest({ job: 'season_rollover', at: '2026-11-10T00:05:00+00:00' }), {
      ok: true,
      value: { job: 'season_rollover', at: '2026-11-10T00:05:00.000Z' },
    });
  }
);

Deno.test('parseJobRequest: refuses an unknown job, a non-object body and a bad instant', () => {
  const bad = parseJobRequest({ job: 'drop_tables' });
  assert(!bad.ok && bad.error.includes('job must be one of'));
  assert(!parseJobRequest([]).ok);
  assert(!parseJobRequest('all').ok);
  assert(!parseJobRequest({ at: 'yesterday' }).ok);
  assert(!parseJobRequest({ job: 42 }).ok);
});

Deno.test('JOB_NAMES is the dispatcher order from migration 0014d', () => {
  assertEquals(
    [...JOB_NAMES],
    ['quest_reset', 'earned_expiry_notice', 'earned_expiry', 'season_rollover', 'score_recompute']
  );
});

Deno.test('verifySecret: exact match only, missing values never pass', () => {
  assert(verifySecret('s3cret-value', 's3cret-value'));
  assert(!verifySecret('s3cret-valuf', 's3cret-value'));
  assert(!verifySecret('s3cret', 's3cret-value'));
  assert(!verifySecret(null, 's3cret-value'));
  assert(!verifySecret('s3cret-value', undefined));
  assert(!verifySecret('', ''));
});

Deno.test('secretFromHeaders: x-jobs-secret wins, Bearer is accepted, nothing else is', () => {
  assertEquals(secretFromHeaders(new Headers({ 'x-jobs-secret': ' abc ' })), 'abc');
  assertEquals(secretFromHeaders(new Headers({ authorization: 'Bearer abc' })), 'abc');
  assertEquals(secretFromHeaders(new Headers({ authorization: 'Basic abc' })), null);
  assertEquals(secretFromHeaders(new Headers()), null);
});

function run(job: string, status: JobRunRow['status'], error: string | null = null): JobRunRow {
  return {
    id: 1,
    job,
    triggered_by: 'edge',
    run_at: '2026-11-10T00:05:00Z',
    started_at: '2026-11-10T00:05:00Z',
    finished_at: '2026-11-10T00:05:01Z',
    status,
    result: {},
    error,
  };
}

Deno.test('summariseRuns: counts ok / error and keeps the first failure message', () => {
  const s = summariseRuns([
    run('quest_reset', 'ok'),
    run('earned_expiry', 'error', '42883: function missing'),
    run('season_rollover', 'error', 'second'),
    run('score_recompute', 'ok'),
  ]);
  assertEquals(s.ok, 2);
  assertEquals(s.error, 2);
  assertEquals(s.firstError, 'earned_expiry: 42883: function missing');
  assertEquals(s.jobs, {
    quest_reset: 'ok',
    earned_expiry: 'error',
    season_rollover: 'error',
    score_recompute: 'ok',
  });
  assertEquals(summariseRuns([]), { ok: 0, error: 0, jobs: {}, firstError: null });
});

Deno.test(
  'resetWindow: daily = the UTC day, weekly = its Monday, parity from the 2026-01-05 epoch',
  () => {
    const tue = new Date('2026-01-06T23:30:00Z');
    assertEquals(resetWindow('daily', tue), {
      periodStart: '2026-01-06',
      periodEnd: '2026-01-07',
      setIndex: 1,
    });
    assertEquals(resetWindow('weekly', tue), {
      periodStart: '2026-01-05',
      periodEnd: '2026-01-12',
      setIndex: 0,
    });
    // Sunday still belongs to the Monday-started week; the next week flips the weekly half.
    assertEquals(resetWindow('weekly', new Date('2026-01-11T12:00:00Z')).periodStart, '2026-01-05');
    assertEquals(resetWindow('weekly', new Date('2026-01-12T00:00:00Z')), {
      periodStart: '2026-01-12',
      periodEnd: '2026-01-19',
      setIndex: 1,
    });
    // The founders season start: 309 days after the epoch (odd) → the second half of the daily pool.
    assertEquals(resetWindow('daily', new Date('2026-11-10T00:05:00Z')).setIndex, 1);
    assertEquals(utcDay(new Date('2026-11-09T23:59:59Z')), '2026-11-09');
  }
);

Deno.test(
  'groupExpiringBatches: earned credits with something left, inside [at, at + 14 d), grouped per user + expiry day',
  () => {
    const at = new Date('2026-11-10T00:20:00Z');
    const day = (n: number) => new Date(Date.UTC(2026, 10, 10) + n * 86_400_000).toISOString();
    const rows = [
      // expires in 10 d (created 170 d ago), two rows on the same day → one batch of 7
      { user_id: 'a', created_at: day(-170), remaining: 5, source: 'earned', delta: 5 },
      { user_id: 'a', created_at: day(-170), remaining: 2, source: 'earned', delta: 2 },
      // same user, expires in 13 d → its own batch
      { user_id: 'a', created_at: day(-167), remaining: 1, source: 'earned', delta: 1 },
      // too far out (expires in 80 d), spent out, purchased, already past: all ignored
      { user_id: 'a', created_at: day(-100), remaining: 3, source: 'earned', delta: 3 },
      { user_id: 'a', created_at: day(-171), remaining: 0, source: 'earned', delta: 4 },
      { user_id: 'a', created_at: day(-170), remaining: 50, source: 'purchased', delta: 50 },
      { user_id: 'b', created_at: day(-200), remaining: 4, source: 'earned', delta: 4 },
      // a second user: exactly 14 d out is OUTSIDE the half-open window; 13.9 d is inside
      {
        user_id: 'b',
        created_at: new Date(at.getTime() - 166 * 86_400_000).toISOString(),
        remaining: 6,
        source: 'earned',
        delta: 6,
      },
      {
        user_id: 'b',
        created_at: new Date(at.getTime() - 166.1 * 86_400_000).toISOString(),
        remaining: 8,
        source: 'earned',
        delta: 8,
      },
    ];
    assertEquals(groupExpiringBatches(rows, at), [
      { userId: 'a', expiresOn: '2026-11-20', amount: 7, daysLeft: 10 },
      { userId: 'a', expiresOn: '2026-11-23', amount: 1, daysLeft: 13 },
      { userId: 'b', expiresOn: '2026-11-23', amount: 8, daysLeft: 13 },
    ]);
    assertEquals(groupExpiringBatches([], at), []);
  }
);
