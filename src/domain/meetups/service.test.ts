import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitEvent } from '@/domain/events';
import { listPublicProfilesByIds } from '@/domain/identity';
import { listMediaForEntities } from '@/domain/media';
import { MeetupError } from './errors';
import {
  createMeetup,
  getMeetupDetail,
  inviteToMeetup,
  listMeetups,
  moderateAttendee,
  rsvpMeetup,
  setShowcase,
  transitionMeetup,
  updateMeetup,
} from './service';
import type { MeetupRow, MeetupRsvpRow } from './types';
import type { Client } from '@/lib/supabase/types';

const repo = vi.hoisted(() => ({
  getMeetup: vi.fn(),
  listUpcoming: vi.fn(),
  listHosted: vi.fn(),
  listMyRsvps: vi.fn(),
  listMeetupsByIds: vi.fn(),
  listRsvps: vi.fn(),
  listGoingRsvps: vi.fn(),
  listShowcase: vi.fn(),
  listInvites: vi.fn(),
  listCollectionItemsByIds: vi.fn(),
  hostCap: vi.fn(),
  createMeetup: vi.fn(),
  transition: vi.fn(),
  updateMeetup: vi.fn(),
  rsvp: vi.fn(),
  setShowcase: vi.fn(),
  invite: vi.fn(),
  setCohost: vi.fn(),
  moderate: vi.fn(),
}));
vi.mock('./repo', () => repo);
vi.mock('@/domain/identity', () => ({
  listPublicProfilesByIds: vi.fn(),
  getProfile: vi.fn(),
}));
vi.mock('@/domain/media', () => ({ listMediaForEntities: vi.fn() }));
vi.mock('@/domain/world', () => ({ getOwnGarage: vi.fn() }));
vi.mock('@/domain/entitlements', () => ({ isProActive: vi.fn() }));
vi.mock('@/domain/events', () => ({ emitEvent: vi.fn() }));

const supabase = {} as Client;
const HOST = '11111111-1111-4111-8111-111111111111';
const GUEST = '22222222-2222-4222-8222-222222222222';
const M1 = '33333333-3333-4333-8333-333333333333';
const ITEM = '44444444-4444-4444-8444-444444444444';

const future = new Date(Date.now() + 2 * 86_400_000).toISOString();
const meetup = (over: Partial<MeetupRow> = {}): MeetupRow => ({
  id: M1,
  host_id: HOST,
  club_id: null,
  garage_user_id: HOST,
  kind: 'virtual',
  title: 'JDM night',
  theme: null,
  description: null,
  starts_at: future,
  ends_at: new Date(Date.parse(future) + 7_200_000).toISOString(),
  capacity: 3,
  showcase_limit: 3,
  visibility: 'public',
  status: 'scheduled',
  fee_paid: 5,
  fee_ledger_id: null,
  refund_ledger_id: null,
  scheduled_at: future,
  started_at: null,
  ended_at: null,
  cancelled_at: null,
  created_at: future,
  updated_at: future,
  ...over,
});
const rsvp = (over: Partial<MeetupRsvpRow> = {}): MeetupRsvpRow => ({
  meetup_id: M1,
  user_id: GUEST,
  status: 'going',
  role: 'attendee',
  muted_at: null,
  removed_at: null,
  checked_in_at: null,
  created_at: future,
  updated_at: future,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listPublicProfilesByIds).mockResolvedValue([
    { id: HOST, handle: 'host', display_name: 'The Host' },
    { id: GUEST, handle: 'guest', display_name: null },
  ] as never);
  vi.mocked(listMediaForEntities).mockResolvedValue([]);
  repo.listInvites.mockResolvedValue([]);
  repo.listShowcase.mockResolvedValue([]);
  repo.listCollectionItemsByIds.mockResolvedValue([]);
});

describe('meetups service (MV-W06-02)', () => {
  it('createMeetup validates, runs the clean-language check before any RPC, and derives ends_at', async () => {
    await expect(createMeetup(supabase, { title: 'x' })).rejects.toThrow();
    await expect(
      createMeetup(supabase, {
        title: 'sh1t show',
        startsAt: future,
        durationMinutes: 60,
        capacity: 3,
        visibility: 'public',
      })
    ).rejects.toThrow(new MeetupError('language_not_allowed'));
    await expect(
      createMeetup(supabase, {
        title: 'Yesterday',
        startsAt: new Date(Date.now() - 1000).toISOString(),
        durationMinutes: 60,
        capacity: 3,
        visibility: 'public',
      })
    ).rejects.toThrow(/future/);
    await expect(
      createMeetup(supabase, {
        title: 'Club night',
        startsAt: future,
        durationMinutes: 60,
        capacity: 3,
        visibility: 'club',
      })
    ).rejects.toThrow(/club/);
    expect(repo.createMeetup).not.toHaveBeenCalled();

    repo.createMeetup.mockResolvedValue(meetup({ status: 'draft' }));
    await createMeetup(supabase, {
      title: '  JDM night ',
      theme: '',
      startsAt: future,
      durationMinutes: 90,
      capacity: 3,
      visibility: 'public',
    });
    expect(repo.createMeetup).toHaveBeenCalledWith(supabase, {
      title: 'JDM night',
      theme: null,
      description: null,
      startsAt: future,
      endsAt: new Date(Date.parse(future) + 90 * 60_000).toISOString(),
      capacity: 3,
      visibility: 'public',
      clubId: null,
    });
  });

  it('maps RPC codes to MeetupError and leaves unknown errors alone', async () => {
    repo.createMeetup.mockRejectedValue({ message: 'host_not_eligible' });
    await expect(
      createMeetup(supabase, {
        title: 'JDM night',
        startsAt: future,
        durationMinutes: 60,
        capacity: 3,
        visibility: 'public',
      })
    ).rejects.toThrow(new MeetupError('host_not_eligible'));
    repo.transition.mockRejectedValue({ message: 'insufficient_balance' });
    await expect(transitionMeetup(supabase, M1, 'schedule')).rejects.toThrow(
      new MeetupError('insufficient_balance')
    );
    repo.transition.mockRejectedValue(new Error('network down'));
    await expect(transitionMeetup(supabase, M1, 'cancel')).rejects.toThrow('network down');
    await expect(transitionMeetup(supabase, M1, 'explode')).rejects.toThrow();
    await expect(transitionMeetup(supabase, 'not-a-uuid', 'start')).rejects.toThrow();
  });

  it('rsvp / showcase / invite / moderate pass validated input through to the RPCs', async () => {
    repo.rsvp.mockResolvedValue(rsvp());
    await rsvpMeetup(supabase, M1);
    expect(repo.rsvp).toHaveBeenCalledWith(supabase, M1, 'going');
    await expect(rsvpMeetup(supabase, M1, 'maybe')).rejects.toThrow();

    repo.setShowcase.mockResolvedValue([]);
    await setShowcase(supabase, M1, [ITEM, ITEM]);
    expect(repo.setShowcase).toHaveBeenCalledWith(supabase, M1, [ITEM]); // de-duplicated
    repo.setShowcase.mockRejectedValue({ message: 'too_many_items' });
    await expect(setShowcase(supabase, M1, [ITEM])).rejects.toThrow(
      new MeetupError('too_many_items')
    );

    repo.invite.mockResolvedValue({ meetup_id: M1, user_id: GUEST } as never);
    await inviteToMeetup(supabase, M1, ' @Guest ');
    expect(repo.invite).toHaveBeenCalledWith(supabase, M1, 'guest');
    await expect(inviteToMeetup(supabase, M1, 'no spaces allowed')).rejects.toThrow();

    repo.moderate.mockResolvedValue(rsvp({ muted_at: future }));
    await moderateAttendee(supabase, M1, GUEST, 'mute');
    expect(repo.moderate).toHaveBeenCalledWith(supabase, M1, GUEST, 'mute');
    await expect(moderateAttendee(supabase, M1, GUEST, 'ban')).rejects.toThrow();
  });

  it('updateMeetup only lets the host edit an editable meetup, recomputes ends_at and emits meetup.updated', async () => {
    repo.getMeetup.mockResolvedValue(meetup());
    await expect(updateMeetup(supabase, GUEST, M1, { title: 'Hijack' })).rejects.toThrow(
      new MeetupError('meetup_not_found')
    );
    repo.getMeetup.mockResolvedValue(meetup({ status: 'ended' }));
    await expect(updateMeetup(supabase, HOST, M1, { title: 'Late' })).rejects.toThrow(
      new MeetupError('meetup_closed')
    );
    repo.getMeetup.mockResolvedValue(meetup());
    repo.updateMeetup.mockResolvedValue(meetup({ title: 'JDM night II' }));
    await updateMeetup(supabase, HOST, M1, { title: 'JDM night II', durationMinutes: 60 });
    expect(repo.updateMeetup).toHaveBeenCalledWith(supabase, M1, {
      title: 'JDM night II',
      starts_at: future,
      ends_at: new Date(Date.parse(future) + 3_600_000).toISOString(),
    });
    expect(emitEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ type: 'meetup.updated', entityId: M1, actorId: HOST })
    );
    // nothing to change → no write, no event
    vi.mocked(emitEvent).mockClear();
    repo.updateMeetup.mockClear();
    await updateMeetup(supabase, HOST, M1, {});
    expect(repo.updateMeetup).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('getMeetupDetail composes viewer state, counts and identities (no PII)', async () => {
    repo.getMeetup.mockResolvedValue(meetup());
    repo.listRsvps.mockResolvedValue([
      rsvp(),
      rsvp({ user_id: HOST, role: 'cohost' }), // (a co-host row for someone else, say)
      rsvp({ user_id: '55555555-5555-4555-8555-555555555555', status: 'waitlist' }),
      rsvp({
        user_id: '66666666-6666-4666-8666-666666666666',
        status: 'declined',
        removed_at: future,
      }),
    ]);
    const asGuest = await getMeetupDetail(supabase, M1, GUEST);
    expect(asGuest).not.toBeNull();
    expect(asGuest!.host).toEqual({ id: HOST, handle: 'host', displayName: 'The Host' });
    expect(asGuest!.viewer).toMatchObject({
      isHost: false,
      isStaff: false,
      isMember: true,
      muted: false,
    });
    expect(asGuest!.goingCount).toBe(2);
    expect(asGuest!.waitlistCount).toBe(1);
    expect(asGuest!.attendees.map((a) => a.user.handle)).toEqual(['guest', 'host', 'collector']);
    expect(asGuest!.attendees[1]!.role).toBe('cohost');

    const asHost = await getMeetupDetail(supabase, M1, HOST);
    expect(asHost!.viewer).toMatchObject({ isHost: true, isStaff: true, isMember: true });

    const asAnon = await getMeetupDetail(supabase, M1, null);
    expect(asAnon!.viewer).toMatchObject({ id: null, isMember: false, rsvp: null });

    repo.getMeetup.mockResolvedValue(null);
    expect(await getMeetupDetail(supabase, M1, GUEST)).toBeNull();
    expect(await getMeetupDetail(supabase, 'nope', GUEST)).toBeNull();
  });

  it('listMeetups: upcoming carries going counts + my rsvp; mine = hosted ∪ joined, latest first', async () => {
    repo.listUpcoming.mockResolvedValue([meetup()]);
    repo.listMyRsvps.mockResolvedValue([rsvp({ status: 'waitlist' })]);
    repo.listGoingRsvps.mockResolvedValue([rsvp(), rsvp({ user_id: HOST })]);
    const upcoming = await listMeetups(supabase, GUEST, 'upcoming');
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]).toMatchObject({ goingCount: 2, myRsvp: 'waitlist', isHost: false });
    expect(upcoming[0]!.host.handle).toBe('host');

    const M2 = '77777777-7777-4777-8777-777777777777';
    repo.listHosted.mockResolvedValue([
      meetup({ id: M2, host_id: GUEST, starts_at: '2026-01-01T00:00:00Z' }),
    ]);
    repo.listMyRsvps.mockResolvedValue([rsvp(), rsvp({ meetup_id: M2 })]);
    repo.listMeetupsByIds.mockResolvedValue([meetup()]);
    repo.listGoingRsvps.mockResolvedValue([]);
    const mine = await listMeetups(supabase, GUEST, 'mine');
    expect(repo.listMeetupsByIds).toHaveBeenCalledWith(supabase, [M1]); // hosted ids excluded
    expect(mine.map((m) => m.meetup.id)).toEqual([M1, M2]);
    expect(mine.map((m) => m.isHost)).toEqual([false, true]);
  });
});
