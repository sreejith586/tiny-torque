// Deno unit tests for the meetup jobs helpers (MV-W06-05). Offline — no network, no Supabase.
// Run: npx -y deno@2.2.3 test supabase/functions/jobs/meetups.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  MEETUP_JOB_NAMES,
  dispatcherFor,
  isMeetupJobName,
  planReminders,
  planTransitions,
  reminderHorizon,
  type ScheduledMeetup,
} from './meetups.ts';
import { parseJobRequest } from './lib.ts';

const START = new Date('2026-11-21T18:00:00Z');

Deno.test(
  'MEETUP_JOB_NAMES is the dispatcher order from migration 0015 and routes to run_meetup_jobs',
  () => {
    assertEquals([...MEETUP_JOB_NAMES], ['meetup_transitions', 'meetup_reminders']);
    assert(isMeetupJobName('meetup_reminders'));
    assert(!isMeetupJobName('quest_reset'));
    assertEquals(dispatcherFor('meetup_transitions'), 'run_meetup_jobs');
    assertEquals(dispatcherFor('quest_reset'), 'run_world_job');
    assertEquals(dispatcherFor('all'), 'run_world_job');
  }
);

Deno.test('parseJobRequest accepts the meetup job names', () => {
  assertEquals(parseJobRequest({ job: 'meetup_reminders' }), {
    ok: true,
    value: { job: 'meetup_reminders', at: null },
  });
  assert(!parseJobRequest({ job: 'meetup_party' }).ok);
});

Deno.test(
  'reminderHorizon: 24h inside the last day (not the last hour), 1h inside the last hour, else none',
  () => {
    assertEquals(reminderHorizon(START, new Date('2026-11-20T17:59:59Z')), null);
    assertEquals(reminderHorizon(START, new Date('2026-11-20T18:00:00Z')), '24h');
    assertEquals(reminderHorizon(START, new Date('2026-11-21T16:59:59Z')), '24h');
    assertEquals(reminderHorizon(START, new Date('2026-11-21T17:00:00Z')), '1h');
    assertEquals(reminderHorizon(START, new Date('2026-11-21T17:59:59Z')), '1h');
    assertEquals(reminderHorizon(START, new Date('2026-11-21T18:00:00Z')), null);
  }
);

const rows: ScheduledMeetup[] = [
  {
    id: 'a',
    status: 'scheduled',
    starts_at: '2026-11-21T18:00:00Z',
    ends_at: '2026-11-21T20:00:00Z',
  },
  {
    id: 'b',
    status: 'scheduled',
    starts_at: '2026-11-21T17:30:00Z',
    ends_at: '2026-11-21T18:30:00Z',
  },
  { id: 'c', status: 'live', starts_at: '2026-11-21T15:00:00Z', ends_at: '2026-11-21T17:00:00Z' },
  { id: 'd', status: 'live', starts_at: '2026-11-21T16:00:00Z', ends_at: '2026-11-21T19:00:00Z' },
  { id: 'e', status: 'ended', starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T17:00:00Z' },
  { id: 'f', status: 'draft', starts_at: '2026-11-21T17:00:00Z', ends_at: '2026-11-21T18:00:00Z' },
];

Deno.test(
  'planTransitions: starts the due scheduled rows (earliest first) and ends the due live rows',
  () => {
    assertEquals(planTransitions(rows, new Date('2026-11-21T17:00:00Z')), {
      start: [],
      end: ['c'],
    });
    assertEquals(planTransitions(rows, new Date('2026-11-21T18:00:00Z')), {
      start: ['b', 'a'],
      end: ['c'],
    });
    assertEquals(planTransitions(rows, new Date('2026-11-21T19:00:00Z')), {
      start: ['b', 'a'],
      end: ['c', 'd'],
    });
    assertEquals(planTransitions([], new Date()), { start: [], end: [] });
  }
);

Deno.test('planReminders: one pair per meetup and horizon, skipping what was already sent', () => {
  // 23 h before a / 22.5 h before b → both get the 24h reminder, b first
  assertEquals(planReminders(rows, new Date('2026-11-20T19:00:00Z'), []), [
    { id: 'b', horizon: '24h' },
    { id: 'a', horizon: '24h' },
  ]);
  // already sent → nothing
  assertEquals(
    planReminders(rows, new Date('2026-11-20T19:00:00Z'), [
      { id: 'a', horizon: '24h' },
      { id: 'b', horizon: '24h' },
    ]),
    []
  );
  // 45 min before a, 15 min before b: both are inside the last hour → both get the 1h reminder
  assertEquals(
    planReminders(rows, new Date('2026-11-21T17:15:00Z'), [
      { id: 'a', horizon: '24h' },
      { id: 'b', horizon: '24h' },
    ]),
    [
      { id: 'b', horizon: '1h' },
      { id: 'a', horizon: '1h' },
    ]
  );
  // 90 min before a (60 min before b): b crosses into its last hour, a stays on its sent 24h
  assertEquals(
    planReminders(rows, new Date('2026-11-21T16:30:00Z'), [
      { id: 'a', horizon: '24h' },
      { id: 'b', horizon: '24h' },
    ]),
    [{ id: 'b', horizon: '1h' }]
  );
  // live / ended / draft rows never get reminders
  assertEquals(
    planReminders(
      rows.filter((r) => r.status !== 'scheduled'),
      new Date('2026-11-21T17:15:00Z'),
      []
    ),
    []
  );
});
