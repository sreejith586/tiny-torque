// Deno unit tests for the H1 jobs helpers (MV-S9-01). Offline — no network, no Supabase.
// Run: deno test supabase/functions/jobs/h1.test.ts   (or npx -y deno@2.2.3 test …)
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  alertLine,
  edgeJobsFor,
  groupByBucket,
  H1_JOB_NAMES,
  isH1Request,
  parseH1JobRequest,
  sqlJobFor,
} from './h1.ts';

Deno.test('H1_JOB_NAMES: SQL dispatcher order (migration 0011) then the two Edge purges', () => {
  assertEquals(
    [...H1_JOB_NAMES],
    [
      'expire_listings',
      'expire_offers',
      'purge_trash',
      'ensure_event_partitions',
      'purge_media',
      'purge_accounts',
    ]
  );
});

Deno.test('isH1Request: track h1 or an H1 job name; World bodies and non-objects are not', () => {
  assert(isH1Request({ track: 'h1' }));
  assert(isH1Request({ job: 'purge_trash' }));
  assert(!isH1Request({ job: 'quest_reset' }));
  assert(!isH1Request({}));
  assert(!isH1Request(null));
  assert(!isH1Request([]));
});

Deno.test('parseH1JobRequest: defaults, normalised instant, bounds', () => {
  assertEquals(parseH1JobRequest({ track: 'h1' }), {
    ok: true,
    value: { job: 'all', at: null, graceDays: 7, limit: 200 },
  });
  assertEquals(
    parseH1JobRequest({
      job: 'expire_offers',
      at: '2026-12-01T00:15:00+00:00',
      grace_days: 0,
      limit: 5,
    }),
    {
      ok: true,
      value: { job: 'expire_offers', at: '2026-12-01T00:15:00.000Z', graceDays: 0, limit: 5 },
    }
  );
  const bad = parseH1JobRequest({ job: 'drop_tables' });
  assert(!bad.ok && bad.error.includes('job must be one of'));
  assert(!parseH1JobRequest({ at: 'soon' }).ok);
  assert(!parseH1JobRequest({ grace_days: -1 }).ok);
  assert(!parseH1JobRequest({ grace_days: 1.5 }).ok);
  assert(!parseH1JobRequest({ limit: 0 }).ok);
  assert(!parseH1JobRequest({ limit: 5000 }).ok);
  assert(!parseH1JobRequest('all').ok);
});

Deno.test(
  'sqlJobFor / edgeJobsFor split a request between the dispatcher and this function',
  () => {
    assertEquals(sqlJobFor('all'), 'all');
    assertEquals(sqlJobFor('purge_trash'), 'purge_trash');
    assertEquals(sqlJobFor('purge_media'), null);
    assertEquals(edgeJobsFor('all'), ['purge_media', 'purge_accounts']);
    assertEquals(edgeJobsFor('purge_accounts'), ['purge_accounts']);
    assertEquals(edgeJobsFor('expire_listings'), []);
  }
);

Deno.test(
  'groupByBucket: one Storage remove() per bucket, ids kept alongside, blanks skipped',
  () => {
    assertEquals(
      groupByBucket([
        { id: 'a', bucket: 'item-media', path: 'u1/a.jpg' },
        { id: 'b', bucket: 'profile-media', path: 'u1/avatar.jpg' },
        { id: 'c', bucket: 'item-media', path: 'u1/c.jpg' },
        { id: 'd', bucket: '', path: 'x' },
      ]),
      [
        { bucket: 'item-media', paths: ['u1/a.jpg', 'u1/c.jpg'], ids: ['a', 'c'] },
        { bucket: 'profile-media', paths: ['u1/avatar.jpg'], ids: ['b'] },
      ]
    );
    assertEquals(groupByBucket([]), []);
  }
);

Deno.test('alertLine: null when clean, one line naming the failed jobs otherwise', () => {
  assertEquals(alertLine([]), null);
  const line = alertLine([
    {
      job: 'purge_trash',
      status: 'error',
      error: '42883: function missing',
      started_at: '2026-11-09T03:35:00Z',
    },
    { job: 'earned_expiry', status: 'error', error: null, started_at: '2026-11-09T00:30:00Z' },
  ]);
  assert(line !== null);
  assert(line.startsWith('2 failed job run(s) in the last 24 h [earned_expiry, purge_trash]'));
  assert(line.includes('purge_trash @ 2026-11-09T03:35:00Z — 42883: function missing'));
});
