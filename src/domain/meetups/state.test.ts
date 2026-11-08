import { describe, it, expect } from 'vitest';
import {
  MEETUP_TRANSITIONS,
  acceptsRsvps,
  allowedActions,
  canTransition,
  hostCap,
  hostFee,
  isEditable,
  isRoomOpen,
  nextStatus,
  refundOnCancel,
  reminderHorizon,
  rsvpOutcome,
  type MeetupAction,
  type MeetupViewer,
} from './state';
import { MEETUP_STATUSES, type MeetupStatus } from './types';

const T0 = new Date('2026-11-20T18:00:00.000Z'); // starts_at
const T1 = new Date('2026-11-20T20:00:00.000Z'); // ends_at
const ctxAt = (now: string) => ({ now: new Date(now), startsAt: T0, endsAt: T1 });
const ACTIONS: MeetupAction[] = ['schedule', 'start', 'end', 'cancel'];
const VIEWERS: MeetupViewer[] = ['host', 'cohost', 'other', 'backend'];

describe('meetup state machine (MV-W06-02, mirrors transition_meetup)', () => {
  it('has exactly the draft → scheduled → live → ended graph with cancel from the two pre-live states', () => {
    const edges = Object.entries(MEETUP_TRANSITIONS).flatMap(([from, map]) =>
      Object.entries(map).map(([action, to]) => `${from} -${action}-> ${to}`)
    );
    expect(edges.sort()).toEqual(
      [
        'draft -schedule-> scheduled',
        'draft -cancel-> cancelled',
        'scheduled -start-> live',
        'scheduled -cancel-> cancelled',
        'live -end-> ended',
      ].sort()
    );
    expect(nextStatus('live', 'cancel')).toBeNull();
    expect(nextStatus('ended', 'start')).toBeNull();
    expect(nextStatus('cancelled', 'schedule')).toBeNull();
  });

  it('terminal states allow nothing to anyone, ever', () => {
    for (const status of ['ended', 'cancelled'] as MeetupStatus[]) {
      for (const viewer of VIEWERS) {
        for (const now of [
          '2026-11-01T00:00:00Z',
          '2026-11-20T18:00:00Z',
          '2026-12-01T00:00:00Z',
        ]) {
          expect(allowedActions(status, viewer, ctxAt(now))).toEqual([]);
        }
      }
    }
  });

  // one row per (status, viewer, now) — the full table the detail page's buttons come from
  const table: [MeetupStatus, MeetupViewer, string, MeetupAction[]][] = [
    ['draft', 'host', '2026-11-10T00:00:00Z', ['schedule', 'cancel']],
    ['draft', 'cohost', '2026-11-10T00:00:00Z', []],
    ['draft', 'other', '2026-11-10T00:00:00Z', []],
    ['draft', 'backend', '2026-11-20T18:00:00Z', []],
    // scheduled, a day before: only cancel for the host; nobody can start yet
    ['scheduled', 'host', '2026-11-19T18:00:00Z', ['cancel']],
    ['scheduled', 'cohost', '2026-11-19T18:00:00Z', []],
    ['scheduled', 'backend', '2026-11-19T18:00:00Z', []],
    // 15 min before: host / co-host may open the room, the backend not yet
    ['scheduled', 'host', '2026-11-20T17:45:00Z', ['start', 'cancel']],
    ['scheduled', 'cohost', '2026-11-20T17:45:00Z', ['start']],
    ['scheduled', 'backend', '2026-11-20T17:45:00Z', []],
    ['scheduled', 'other', '2026-11-20T17:45:00Z', []],
    // 16 min before: too early for humans too
    ['scheduled', 'host', '2026-11-20T17:44:00Z', ['cancel']],
    // at the start: everyone who may start can
    ['scheduled', 'backend', '2026-11-20T18:00:00Z', ['start']],
    ['scheduled', 'host', '2026-11-20T18:00:00Z', ['start', 'cancel']],
    // live: host / co-host end any time, the backend only once the end has passed
    ['live', 'host', '2026-11-20T18:30:00Z', ['end']],
    ['live', 'cohost', '2026-11-20T18:30:00Z', ['end']],
    ['live', 'other', '2026-11-20T18:30:00Z', []],
    ['live', 'backend', '2026-11-20T19:59:00Z', []],
    ['live', 'backend', '2026-11-20T20:00:00Z', ['end']],
  ];
  it.each(table)('%s as %s at %s → %j', (status, viewer, now, expected) => {
    expect(allowedActions(status, viewer, ctxAt(now))).toEqual(expected);
    for (const action of ACTIONS) {
      expect(canTransition(status, viewer, action, ctxAt(now))).toBe(expected.includes(action));
    }
  });

  it('every allowed action leads somewhere in the graph', () => {
    for (const status of MEETUP_STATUSES) {
      for (const viewer of VIEWERS) {
        for (const action of allowedActions(status, viewer, ctxAt('2026-11-20T18:00:00Z'))) {
          expect(nextStatus(status, action)).not.toBeNull();
        }
      }
    }
  });

  it('room / rsvp / edit windows follow the status', () => {
    expect(MEETUP_STATUSES.filter(isRoomOpen)).toEqual(['live']);
    expect(MEETUP_STATUSES.filter(acceptsRsvps)).toEqual(['scheduled', 'live']);
    expect(MEETUP_STATUSES.filter(isEditable)).toEqual(['draft', 'scheduled']);
  });

  it('refunds the fee only for a scheduled meetup cancelled ≥ 24 h before start', () => {
    expect(refundOnCancel('scheduled', 5, T0, new Date('2026-11-19T18:00:00Z'))).toBe(true);
    expect(refundOnCancel('scheduled', 5, T0, new Date('2026-11-19T18:00:01Z'))).toBe(false);
    expect(refundOnCancel('scheduled', 0, T0, new Date('2026-11-01T00:00:00Z'))).toBe(false);
    expect(refundOnCancel('draft', 5, T0, new Date('2026-11-01T00:00:00Z'))).toBe(false);
  });

  it('fee tiers and the host cap mirror meetup_host_fee / meetup_host_cap', () => {
    expect([hostFee(2), hostFee(10), hostFee(11), hostFee(25), hostFee(26), hostFee(500)]).toEqual([
      5, 5, 10, 10, 20, 20,
    ]);
    expect(hostCap(10, false)).toBe(10);
    expect(hostCap(10, true)).toBe(15);
    expect(hostCap(25, true)).toBe(37);
    expect(hostCap(0, true)).toBe(0);
  });

  it('rsvp lands on the waitlist once capacity is reached', () => {
    expect(rsvpOutcome(0, 3)).toBe('going');
    expect(rsvpOutcome(2, 3)).toBe('going');
    expect(rsvpOutcome(3, 3)).toBe('waitlist');
  });

  it('reminder horizons mirror the jobs runner (24h outside the last hour, 1h inside, none otherwise)', () => {
    expect(reminderHorizon(T0, new Date('2026-11-19T17:59:00Z'))).toBeNull();
    expect(reminderHorizon(T0, new Date('2026-11-19T18:00:00Z'))).toBe('24h');
    expect(reminderHorizon(T0, new Date('2026-11-20T16:59:59Z'))).toBe('24h');
    expect(reminderHorizon(T0, new Date('2026-11-20T17:00:00Z'))).toBe('1h');
    expect(reminderHorizon(T0, new Date('2026-11-20T17:59:59Z'))).toBe('1h');
    expect(reminderHorizon(T0, new Date('2026-11-20T18:00:00Z'))).toBeNull();
  });
});
