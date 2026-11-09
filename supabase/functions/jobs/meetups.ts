// Mini Vault — meetup jobs helpers (F-23, MV-W06-05, 07 §6.4). Pure, network-free, Deno-tested
// (meetups.test.ts), same split as lib.ts. The job logic is SQL (migration 0015: `run_meetup_jobs`
// dispatches `meetup_transitions` + `meetup_reminders`); this file names the jobs for the HTTP
// entry's request parser and mirrors the reminder-window arithmetic so an operator can predict a run.
// Kept in its own file (not lib.ts) so the H1 S9 jobs work and this World work merge without touching
// the same lines.

/** The meetup dispatcher's job names, in the order `run_meetup_jobs('all')` runs them. */
export const MEETUP_JOB_NAMES = ['meetup_transitions', 'meetup_reminders'] as const;
export type MeetupJobName = (typeof MEETUP_JOB_NAMES)[number];

export function isMeetupJobName(value: string): value is MeetupJobName {
  return (MEETUP_JOB_NAMES as readonly string[]).includes(value);
}

/** Which RPC a job name belongs to: the World dispatcher (0014d) or the meetup one (0015). */
export function dispatcherFor(job: string): 'run_world_job' | 'run_meetup_jobs' {
  return isMeetupJobName(job) ? 'run_meetup_jobs' : 'run_world_job';
}

export type ReminderHorizon = '24h' | '1h';

const HOUR = 3_600_000;

/** The reminder a scheduled meetup is due at `at` (= world_job_meetup_reminders): '1h' inside the
 *  last hour before the start, '24h' inside the last day but not the last hour, null otherwise
 *  (already started, or more than a day away). */
export function reminderHorizon(startsAt: Date, at: Date): ReminderHorizon | null {
  const delta = startsAt.getTime() - at.getTime();
  if (delta <= 0) return null;
  if (delta <= HOUR) return '1h';
  if (delta <= 24 * HOUR) return '24h';
  return null;
}

export interface ScheduledMeetup {
  id: string;
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';
  starts_at: string;
  ends_at: string;
}

export interface TransitionPlan {
  start: string[];
  end: string[];
}

/** Which meetups `meetup_transitions` would move at `at`: scheduled with a passed start → live, live
 *  with a passed end → ended. Order = starts_at / ends_at ascending, like the SQL. */
export function planTransitions(rows: ScheduledMeetup[], at: Date): TransitionPlan {
  const t = at.getTime();
  const start = rows
    .filter((r) => r.status === 'scheduled' && Date.parse(r.starts_at) <= t)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((r) => r.id);
  const end = rows
    .filter((r) => r.status === 'live' && Date.parse(r.ends_at) <= t)
    .sort((a, b) => a.ends_at.localeCompare(b.ends_at))
    .map((r) => r.id);
  return { start, end };
}

/** Which (meetup, horizon) reminders `meetup_reminders` would send at `at`, given the horizons already
 *  sent (one `meetup.reminder` event per pair is the SQL's idempotency record). */
export function planReminders(
  rows: ScheduledMeetup[],
  at: Date,
  alreadySent: { id: string; horizon: ReminderHorizon }[]
): { id: string; horizon: ReminderHorizon }[] {
  const sent = new Set(alreadySent.map((s) => `${s.id}|${s.horizon}`));
  return rows
    .filter((r) => r.status === 'scheduled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .flatMap((r) => {
      const horizon = reminderHorizon(new Date(r.starts_at), at);
      if (!horizon || sent.has(`${r.id}|${horizon}`)) return [];
      return [{ id: r.id, horizon }];
    });
}
