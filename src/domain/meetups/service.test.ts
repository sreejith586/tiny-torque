import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitEvent } from '@/domain/events';
import { listPublicProfilesByIds } from '@/domain/identity';
import { listMediaForEntities, listMediaForEntity, uploadMeetupPhoto } from '@/domain/media';
import { MeetupError } from './errors';
import {
  addMeetupPhoto,
  createMeetup,
  getMeetupDetail,
  inviteToMeetup,
  listMeetups,
  moderateAttendee,
  pingRoom,
  removeMeetupPhoto,
  rsvpMeetup,
  setShowcase,
  transitionMeetup,
  updateMeetup,
  voteBestInShow,
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
  getMyVote: vi.fn(),
  getClub: vi.fn(),
  vote: vi.fn(),
  pingRoom: vi.fn(),
  removePhoto: vi.fn(),
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
vi.mock('@/domain/media', () => ({
  listMediaForEntities: vi.fn(),
  listMediaForEntity: vi.fn(),
  uploadMeetupPhoto: vi.fn(),
}));
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
  best_in_show_id: null,
  best_in_show_votes: null,
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
  room_joined_at: null,
  room_seen_at: null,
  room_seconds: 0,
  attended_at: null,
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
  vi.mocked(listMediaForEntity).mockResolvedValue([]);
  repo.getMyVote.mockResolvedValue(null);
  repo.getClub.mockResolvedValue(null);
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

describe('meetups service — best-in-show, attendance, photo wall (MV-W07-01)', () => {
  const SC1 = '55555555-5555-4555-8555-555555555551';
  const SC2 = '55555555-5555-4555-8555-555555555552';
  const CLUB = '66666666-6666-4666-8666-666666666666';
  const PHOTO = '77777777-7777-4777-8777-777777777777';
  const showcaseRow = (id: string, user_id: string, votes: number) => ({
    id,
    meetup_id: M1,
    user_id,
    item_id: ITEM,
    votes,
    position: 0,
    created_at: future,
  });

  it('the detail carries the tally, the viewer’s ballot, the frozen winner, the wall and the club', async () => {
    repo.getMeetup.mockResolvedValue(
      meetup({ status: 'ended', best_in_show_id: SC2, best_in_show_votes: 3, club_id: CLUB })
    );
    repo.listRsvps.mockResolvedValue([rsvp({ attended_at: future })]);
    repo.listShowcase.mockResolvedValue([showcaseRow(SC1, GUEST, 1), showcaseRow(SC2, HOST, 3)]);
    repo.getMyVote.mockResolvedValue(SC2);
    repo.getClub.mockResolvedValue({ id: CLUB, slug: 'jdm_club', name: 'JDM Club' });
    vi.mocked(listMediaForEntity).mockResolvedValue([
      { id: 'old', owner_id: GUEST, status: 'ready', created_at: '2026-11-01T00:00:00.000Z' },
      { id: 'gone', owner_id: GUEST, status: 'uploading', created_at: '2026-11-03T00:00:00.000Z' },
      { id: 'new', owner_id: HOST, status: 'ready', created_at: '2026-11-02T00:00:00.000Z' },
    ] as never);

    const d = await getMeetupDetail(supabase, M1, GUEST);
    expect(listMediaForEntity).toHaveBeenCalledWith(supabase, 'meetup_photo', M1);
    expect(d!.showcase.map((s) => [s.id, s.votes])).toEqual([
      [SC1, 1],
      [SC2, 3],
    ]);
    expect(d!.myVoteShowcaseId).toBe(SC2);
    expect(d!.bestInShow).toMatchObject({ showcaseId: SC2, votes: 3, entry: { id: SC2 } });
    expect(d!.wallPhotos.map((p) => [p.id, p.owner?.handle])).toEqual([
      ['new', 'host'],
      ['old', 'guest'],
    ]);
    expect(d!.club).toEqual({ id: CLUB, slug: 'jdm_club', name: 'JDM Club' });
    expect(d!.viewer.attended).toBe(true);
  });

  it('no winner while running or when nobody voted; a signed-out viewer has no ballot lookup', async () => {
    repo.getMeetup.mockResolvedValue(meetup({ status: 'live' }));
    repo.listRsvps.mockResolvedValue([]);
    const d = await getMeetupDetail(supabase, M1, null);
    expect(d!.bestInShow).toBeNull();
    expect(d!.myVoteShowcaseId).toBeNull();
    expect(d!.club).toBeNull();
    expect(d!.viewer.attended).toBe(false);
    expect(repo.getMyVote).not.toHaveBeenCalled();
    expect(repo.getClub).not.toHaveBeenCalled();
  });

  it('createMeetup keeps the club for any visibility (hosted by the club)', async () => {
    repo.createMeetup.mockResolvedValue(meetup({ status: 'draft', club_id: CLUB }));
    await createMeetup(supabase, {
      title: 'Club open night',
      startsAt: future,
      durationMinutes: 60,
      capacity: 3,
      visibility: 'public',
      clubId: CLUB,
    });
    expect(repo.createMeetup).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ visibility: 'public', clubId: CLUB })
    );
    repo.createMeetup.mockRejectedValue({ message: 'not_club_staff' });
    await expect(
      createMeetup(supabase, {
        title: 'Not mine',
        startsAt: future,
        durationMinutes: 60,
        capacity: 3,
        visibility: 'club',
        clubId: CLUB,
      })
    ).rejects.toThrow(new MeetupError('not_club_staff'));
  });

  it.each(['host_level_too_low', 'host_recent_report', 'hosting_suspended'] as const)(
    'scheduling maps the hosting rule %s',
    async (code) => {
      repo.transition.mockRejectedValue({ message: code, code: 'P0001' });
      await expect(transitionMeetup(supabase, M1, 'schedule')).rejects.toThrow(
        new MeetupError(code)
      );
    }
  );

  it('voteBestInShow returns the new tally and maps the refusals', async () => {
    repo.vote.mockResolvedValue(showcaseRow(SC1, GUEST, 4));
    expect(await voteBestInShow(supabase, M1, SC1)).toEqual({ showcaseId: SC1, votes: 4 });
    expect(repo.vote).toHaveBeenCalledWith(supabase, M1, SC1);
    await expect(voteBestInShow(supabase, M1, 'nope')).rejects.toHaveProperty('issues');
    for (const code of [
      'voting_closed',
      'own_entry',
      'not_attending',
      'entry_not_found',
    ] as const) {
      repo.vote.mockRejectedValue({ message: code });
      await expect(voteBestInShow(supabase, M1, SC1)).rejects.toThrow(new MeetupError(code));
    }
  });

  it('pingRoom reports attendance and never throws', async () => {
    repo.pingRoom.mockResolvedValue(true);
    expect(await pingRoom(supabase, M1)).toBe(true);
    repo.pingRoom.mockRejectedValue(new Error('network'));
    expect(await pingRoom(supabase, M1)).toBe(false);
    expect(await pingRoom(supabase, 'nope')).toBe(false);
  });

  it('addMeetupPhoto uploads, emits meetup.photo_added, and maps the wall’s refusals without an event', async () => {
    const blob = new Blob(['x']);
    vi.mocked(uploadMeetupPhoto).mockResolvedValue({ id: PHOTO, created_at: future } as never);
    const photo = await addMeetupPhoto(supabase, GUEST, M1, blob);
    expect(uploadMeetupPhoto).toHaveBeenCalledWith(supabase, GUEST, M1, blob, { bytes: 1 });
    expect(photo).toMatchObject({ id: PHOTO, ownerId: GUEST });
    expect(emitEvent).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        type: 'meetup.photo_added',
        entityId: M1,
        payload: { media_id: PHOTO },
      })
    );
    vi.mocked(emitEvent).mockClear();
    for (const code of ['photo_limit', 'photo_wall_closed', 'not_attending'] as const) {
      vi.mocked(uploadMeetupPhoto).mockRejectedValue({ message: code });
      await expect(addMeetupPhoto(supabase, GUEST, M1, blob)).rejects.toThrow(
        new MeetupError(code)
      );
    }
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('removeMeetupPhoto goes through the RPC', async () => {
    await removeMeetupPhoto(supabase, PHOTO);
    expect(repo.removePhoto).toHaveBeenCalledWith(supabase, PHOTO);
    repo.removePhoto.mockRejectedValue({ message: 'photo_not_found' });
    await expect(removeMeetupPhoto(supabase, PHOTO)).rejects.toThrow(
      new MeetupError('photo_not_found')
    );
  });
});
