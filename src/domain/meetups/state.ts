// Meetup state machine — the client-side mirror of transition_meetup / rsvp_meetup (0015, F-23), the
// same role domain/deals/state.ts plays for transition_offer. The DB RPC is the source of truth and the
// enforcement; these pure helpers decide which buttons a viewer sees, what the pre-flight copy says and
// how the jobs runner's windows are explained — so they must stay in lock-step with the migration.
// Table-tested in state.test.ts.
import type { MeetupRsvpStatus, MeetupStatus } from './types';
import { CANCEL_REFUND_HOURS, HOST_EARLY_START_MINUTES, PRO_HOST_CAP_MULTIPLIER } from './types';

export type MeetupAction = 'schedule' | 'start' | 'end' | 'cancel';
/** Who is looking: the host, a co-host, anyone else (attendee / visitor), or the jobs runner. */
export type MeetupViewer = 'host' | 'cohost' | 'other' | 'backend';

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** The raw graph: status → action → next status (draft → scheduled → live → ended; cancel from the
 *  two pre-live states). Terminal states have no edges. */
export const MEETUP_TRANSITIONS: Record<
  MeetupStatus,
  Partial<Record<MeetupAction, MeetupStatus>>
> = {
  draft: { schedule: 'scheduled', cancel: 'cancelled' },
  scheduled: { start: 'live', cancel: 'cancelled' },
  live: { end: 'ended' },
  ended: {},
  cancelled: {},
};

export function nextStatus(status: MeetupStatus, action: MeetupAction): MeetupStatus | null {
  return MEETUP_TRANSITIONS[status][action] ?? null;
}

export interface TransitionContext {
  now: Date;
  startsAt: Date;
  endsAt: Date;
}

/** The actions `viewer` may take on a meetup in `status` right now. Mirrors transition_meetup's
 *  authorisation + timing rules: schedule / cancel are the host's alone; start is host or co-host from
 *  15 min before the start, or the backend once the start has passed; end is host / co-host any time
 *  while live, or the backend once the end has passed. */
export function allowedActions(
  status: MeetupStatus,
  viewer: MeetupViewer,
  ctx: TransitionContext
): MeetupAction[] {
  const out: MeetupAction[] = [];
  const edges = MEETUP_TRANSITIONS[status];
  if (edges.schedule && viewer === 'host') out.push('schedule');
  if (edges.start) {
    if (viewer === 'backend' && ctx.now.getTime() >= ctx.startsAt.getTime()) out.push('start');
    if (
      (viewer === 'host' || viewer === 'cohost') &&
      ctx.now.getTime() >= ctx.startsAt.getTime() - HOST_EARLY_START_MINUTES * MINUTE
    )
      out.push('start');
  }
  if (edges.end) {
    if (viewer === 'backend' && ctx.now.getTime() >= ctx.endsAt.getTime()) out.push('end');
    if (viewer === 'host' || viewer === 'cohost') out.push('end');
  }
  if (edges.cancel && viewer === 'host') out.push('cancel');
  return out;
}

export function canTransition(
  status: MeetupStatus,
  viewer: MeetupViewer,
  action: MeetupAction,
  ctx: TransitionContext
): boolean {
  return allowedActions(status, viewer, ctx).includes(action);
}

/** The live room is reachable only while the meetup is live (F-23 "room opens only in live"). */
export function isRoomOpen(status: MeetupStatus): boolean {
  return status === 'live';
}

/** Attendees may rsvp / change their showcase while scheduled or live. */
export function acceptsRsvps(status: MeetupStatus): boolean {
  return status === 'scheduled' || status === 'live';
}

/** The host may still edit the descriptive fields (title, time, capacity, visibility). */
export function isEditable(status: MeetupStatus): boolean {
  return status === 'draft' || status === 'scheduled';
}

/** Cancel refunds the host fee only for a scheduled meetup cancelled ≥ 24 h before its start. */
export function refundOnCancel(
  status: MeetupStatus,
  feePaid: number,
  startsAt: Date,
  now: Date
): boolean {
  return (
    status === 'scheduled' &&
    feePaid > 0 &&
    startsAt.getTime() - now.getTime() >= CANCEL_REFUND_HOURS * HOUR
  );
}

/** PLACEHOLDER host fee by capacity (07 §3.2: 5 / 10 / 20) — mirrors meetup_host_fee(). */
export function hostFee(capacity: number): number {
  if (capacity <= 10) return 5;
  if (capacity <= 25) return 10;
  return 20;
}

/** Capacity cap from the host's garage level, +50 % for Pro — mirrors meetup_host_cap(). */
export function hostCap(levelHostCap: number, isPro: boolean): number {
  return Math.floor(levelHostCap * (isPro ? PRO_HOST_CAP_MULTIPLIER : 1));
}

/** Where a new "going" rsvp lands — mirrors rsvp_meetup. */
export function rsvpOutcome(goingCount: number, capacity: number): MeetupRsvpStatus {
  return goingCount < capacity ? 'going' : 'waitlist';
}

/** Which reminder a scheduled meetup is due right now — mirrors world_job_meetup_reminders: '1h'
 *  inside the last hour, '24h' inside the last day (but not the last hour), nothing otherwise. */
export function reminderHorizon(startsAt: Date, now: Date): '24h' | '1h' | null {
  const delta = startsAt.getTime() - now.getTime();
  if (delta <= 0) return null;
  if (delta <= HOUR) return '1h';
  if (delta <= 24 * HOUR) return '24h';
  return null;
}
