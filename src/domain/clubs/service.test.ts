import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPublicProfilesByIds } from '@/domain/identity';
import { listMediaForEntities } from '@/domain/media';
import { ClubError } from './errors';
import {
  createClub,
  decideApplication,
  getClubDetail,
  getHostIneligibleReason,
  inviteToClub,
  joinClub,
  leaveClub,
  listClubs,
  listStaffClubs,
  moderateMember,
  setClubNight,
  setMemberRole,
  updateClub,
} from './service';
import type { ClubMemberRow, ClubRow } from './types';
import type { Client } from '@/lib/supabase/types';

const repo = vi.hoisted(() => ({
  getClubBySlug: vi.fn(),
  listClubs: vi.fn(),
  listClubsByIds: vi.fn(),
  listMyMemberships: vi.fn(),
  listMembers: vi.fn(),
  memberCounts: vi.fn(),
  feed: vi.fn(),
  listClubMeetups: vi.fn(),
  getNight: vi.fn(),
  listFeaturedItemIds: vi.fn(),
  listCollectionItemsByIds: vi.fn(),
  hostIneligibleReason: vi.fn(),
  createClub: vi.fn(),
  updateClub: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  invite: vi.fn(),
  decideApplication: vi.fn(),
  setRole: vi.fn(),
  moderate: vi.fn(),
  setNight: vi.fn(),
  stopNight: vi.fn(),
}));
vi.mock('./repo', () => repo);
vi.mock('@/domain/identity', () => ({ listPublicProfilesByIds: vi.fn() }));
vi.mock('@/domain/media', () => ({ listMediaForEntities: vi.fn() }));

const supabase = {} as Client;
const OWNER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const APPLICANT = '44444444-4444-4444-8444-444444444444';
const BANNED = '55555555-5555-4555-8555-555555555555';
const CLUB = '66666666-6666-4666-8666-666666666666';
const ITEM = '77777777-7777-4777-8777-777777777777';
const at = '2026-11-12T10:00:00.000Z';

const club = (over: Partial<ClubRow> = {}): ClubRow => ({
  id: CLUB,
  slug: 'jdm_club',
  name: 'JDM Club',
  owner_id: OWNER,
  join_mode: 'apply',
  country_code: 'AE',
  description: null,
  banner_media_id: null,
  created_at: at,
  updated_at: at,
  ...over,
});
const member = (user_id: string, over: Partial<ClubMemberRow> = {}): ClubMemberRow => ({
  club_id: CLUB,
  user_id,
  role: 'member',
  status: 'active',
  joined_at: at,
  invited_by: null,
  ...over,
});
const ROSTER = [
  member(MEMBER),
  member(OWNER, { role: 'owner' }),
  member(ADMIN, { role: 'admin' }),
  member(APPLICANT, { status: 'pending' }),
  member('88888888-8888-4888-8888-888888888888', { status: 'pending', invited_by: OWNER }),
  member(BANNED, { status: 'banned' }),
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listPublicProfilesByIds).mockImplementation(
    async (_s, ids) =>
      (ids as string[]).map((id) => ({
        id,
        handle: `h_${id.slice(0, 4)}`,
        display_name: null,
      })) as never
  );
  vi.mocked(listMediaForEntities).mockResolvedValue([]);
  repo.memberCounts.mockResolvedValue(new Map([[CLUB, 3]]));
  repo.feed.mockResolvedValue([]);
  repo.listClubMeetups.mockResolvedValue([]);
  repo.getNight.mockResolvedValue(null);
  repo.listFeaturedItemIds.mockResolvedValue([]);
  repo.listCollectionItemsByIds.mockResolvedValue([]);
});

describe('getClubDetail', () => {
  it('returns null for a bad or unknown slug without reading anything else', async () => {
    expect(await getClubDetail(supabase, 'No Such Club!', OWNER)).toBeNull();
    expect(repo.getClubBySlug).not.toHaveBeenCalled();
    repo.getClubBySlug.mockResolvedValue(null);
    expect(await getClubDetail(supabase, 'ghost_club', OWNER)).toBeNull();
    expect(repo.listMembers).not.toHaveBeenCalled();
  });

  it('the owner sees roster (owner first), applications, invitations and bans', async () => {
    repo.getClubBySlug.mockResolvedValue(club());
    repo.listMembers.mockResolvedValue(ROSTER);
    const d = await getClubDetail(supabase, 'JDM_Club', OWNER);
    expect(repo.getClubBySlug).toHaveBeenCalledWith(supabase, 'jdm_club');
    expect(d!.viewer).toMatchObject({
      role: 'owner',
      isOwner: true,
      isStaff: true,
      isMember: true,
    });
    expect(d!.members.map((m) => m.role)).toEqual(['owner', 'admin', 'member']);
    expect(d!.applications.map((m) => m.user.id)).toEqual([APPLICANT]);
    expect(d!.invitations).toHaveLength(1);
    expect(d!.banned.map((m) => m.user.id)).toEqual([BANNED]);
    expect(d!.memberCount).toBe(3);
  });

  it('a plain member sees the roster but none of the staff lists', async () => {
    repo.getClubBySlug.mockResolvedValue(club());
    repo.listMembers.mockResolvedValue(ROSTER);
    const d = await getClubDetail(supabase, 'jdm_club', MEMBER);
    expect(d!.viewer).toMatchObject({ role: 'member', isStaff: false, isMember: true });
    expect(d!.members).toHaveLength(3);
    expect(d!.applications).toEqual([]);
    expect(d!.invitations).toEqual([]);
    expect(d!.banned).toEqual([]);
  });

  it('an applicant of a closed club gets only what RLS returns: their own pending row', async () => {
    repo.getClubBySlug.mockResolvedValue(club());
    repo.listMembers.mockResolvedValue([member(APPLICANT, { status: 'pending' })]);
    repo.getNight.mockResolvedValue({ id: 'n' });
    const d = await getClubDetail(supabase, 'jdm_club', APPLICANT);
    expect(d!.viewer).toMatchObject({
      status: 'pending',
      invited: false,
      isMember: false,
      role: null,
    });
    expect(d!.members).toEqual([]);
    expect(d!.feed).toEqual([]);
    expect(d!.night).toBeNull();
    expect(d!.memberCount).toBe(3);
  });

  it('a banned collector is not a member and an invitee is flagged as invited', async () => {
    repo.getClubBySlug.mockResolvedValue(club());
    repo.listMembers.mockResolvedValue([member(BANNED, { status: 'banned' })]);
    expect((await getClubDetail(supabase, 'jdm_club', BANNED))!.viewer).toMatchObject({
      status: 'banned',
      isMember: false,
      role: null,
    });
    repo.listMembers.mockResolvedValue([member(MEMBER, { status: 'pending', invited_by: OWNER })]);
    expect((await getClubDetail(supabase, 'jdm_club', MEMBER))!.viewer.invited).toBe(true);
  });

  it('shows members’ featured public cars and maps the feed to public identities', async () => {
    repo.getClubBySlug.mockResolvedValue(club({ join_mode: 'open' }));
    repo.listMembers.mockResolvedValue([member(OWNER, { role: 'owner' }), member(MEMBER)]);
    repo.listFeaturedItemIds.mockResolvedValue([
      { userId: MEMBER, itemId: ITEM },
      { userId: OWNER, itemId: 'private-item' },
    ]);
    repo.listCollectionItemsByIds.mockResolvedValue([{ id: ITEM, owner_id: MEMBER, brand: 'HW' }]);
    repo.feed.mockResolvedValue([
      {
        event_id: 9,
        type: 'club.joined',
        actor_id: MEMBER,
        payload: { via: 'open' },
        occurred_at: at,
      },
      { event_id: 8, type: 'club.created', actor_id: null, payload: null, occurred_at: at },
    ]);
    const d = await getClubDetail(supabase, 'jdm_club', null);
    expect(repo.listFeaturedItemIds).toHaveBeenCalledWith(supabase, [OWNER, MEMBER]);
    expect(d!.featured.map((f) => [f.owner.id, f.item.id])).toEqual([[MEMBER, ITEM]]);
    expect(d!.feed.map((f) => [f.id, f.actor?.id ?? null, f.payload])).toEqual([
      [9, MEMBER, { via: 'open' }],
      [8, null, {}],
    ]);
    expect(d!.viewer).toMatchObject({ id: null, isMember: false, status: null });
  });
});

describe('listClubs / listStaffClubs', () => {
  it('all: every club with counts and the viewer’s standing; mine: without the bans', async () => {
    const other = club({ id: 'other', slug: 'a_club', name: 'A Club' });
    repo.listMyMemberships.mockResolvedValue([
      member(MEMBER),
      member(MEMBER, { club_id: 'other', status: 'banned' }),
    ]);
    repo.listClubs.mockResolvedValue([club(), other]);
    const all = await listClubs(supabase, MEMBER, 'all');
    expect(all.map((c) => [c.club.slug, c.myStatus, c.myRole, c.memberCount])).toEqual([
      ['a_club', 'banned', null, 0],
      ['jdm_club', 'active', 'member', 3],
    ]);
    repo.listClubsByIds.mockResolvedValue([club()]);
    await listClubs(supabase, MEMBER, 'mine');
    expect(repo.listClubsByIds).toHaveBeenCalledWith(supabase, [CLUB]);
  });

  it('staff clubs = active owner / admin memberships only', async () => {
    repo.listMyMemberships.mockResolvedValue([
      member(ADMIN, { role: 'admin' }),
      member(ADMIN, { club_id: 'b', role: 'member' }),
      member(ADMIN, { club_id: 'c', role: 'admin', status: 'pending' }),
    ]);
    repo.listClubsByIds.mockResolvedValue([club()]);
    expect(await listStaffClubs(supabase, ADMIN)).toEqual([
      { id: CLUB, slug: 'jdm_club', name: 'JDM Club' },
    ]);
    expect(repo.listClubsByIds).toHaveBeenCalledWith(supabase, [CLUB]);
  });
});

describe('writes', () => {
  const input = {
    slug: ' JDM_Club ',
    name: ' JDM Club ',
    joinMode: 'open',
    description: '',
    countryCode: 'ae',
  };

  it('createClub normalises the slug / country and passes nulls for blanks', async () => {
    repo.createClub.mockResolvedValue(club());
    await createClub(supabase, input);
    expect(repo.createClub).toHaveBeenCalledWith(supabase, {
      slug: 'jdm_club',
      name: 'JDM Club',
      joinMode: 'open',
      description: null,
      countryCode: 'AE',
    });
  });

  it('createClub rejects a bad slug at the boundary and banned language before the RPC', async () => {
    await expect(createClub(supabase, { ...input, slug: 'no spaces!' })).rejects.toHaveProperty(
      'issues'
    );
    await expect(createClub(supabase, { ...input, name: 'Fuck Club' })).rejects.toMatchObject({
      code: 'language_not_allowed',
    });
    await expect(createClub(supabase, { ...input, slug: 'fuck_club' })).rejects.toBeInstanceOf(
      ClubError
    );
    expect(repo.createClub).not.toHaveBeenCalled();
  });

  it.each([
    'slug_taken',
    'club_limit',
    'host_level_too_low',
    'host_recent_report',
    'hosting_suspended',
  ] as const)('createClub maps the RPC’s %s', async (code) => {
    repo.createClub.mockRejectedValue({ message: code, code: 'P0001' });
    await expect(createClub(supabase, input)).rejects.toMatchObject({ code });
  });

  it('updateClub checks language and maps a refusal', async () => {
    await expect(
      updateClub(supabase, CLUB, { name: 'Ok', joinMode: 'open', description: 'shit talk' })
    ).rejects.toMatchObject({ code: 'language_not_allowed' });
    repo.updateClub.mockRejectedValue({ message: 'permission denied', code: '42501' });
    await expect(
      updateClub(supabase, CLUB, { name: 'Ok', joinMode: 'open' })
    ).rejects.toMatchObject({
      code: 'not_authorized',
    });
  });

  it('joinClub returns where the caller stands and maps bans / invite-only', async () => {
    repo.join.mockResolvedValue(member(MEMBER, { status: 'pending' }));
    expect(await joinClub(supabase, CLUB)).toEqual({ status: 'pending' });
    repo.join.mockRejectedValue({ message: 'banned_from_club' });
    await expect(joinClub(supabase, CLUB)).rejects.toMatchObject({ code: 'banned_from_club' });
    repo.join.mockRejectedValue({ message: 'invite_required' });
    await expect(joinClub(supabase, CLUB)).rejects.toMatchObject({ code: 'invite_required' });
    await expect(joinClub(supabase, 'not-a-uuid')).rejects.toHaveProperty('issues');
  });

  it('leaveClub maps owner_cannot_leave', async () => {
    repo.leave.mockRejectedValue({ message: 'owner_cannot_leave' });
    await expect(leaveClub(supabase, CLUB)).rejects.toMatchObject({ code: 'owner_cannot_leave' });
  });

  it('inviteToClub strips the @ and lower-cases the handle', async () => {
    repo.invite.mockResolvedValue(member(MEMBER, { status: 'pending', invited_by: OWNER }));
    expect(await inviteToClub(supabase, CLUB, ' @Some_One ')).toEqual({
      userId: MEMBER,
      status: 'pending',
    });
    expect(repo.invite).toHaveBeenCalledWith(supabase, CLUB, 'some_one');
    repo.invite.mockRejectedValue({ message: 'invitee_not_found' });
    await expect(inviteToClub(supabase, CLUB, 'ghost')).rejects.toMatchObject({
      code: 'invitee_not_found',
    });
  });

  it('decideApplication / setMemberRole / moderateMember validate ids, roles and actions', async () => {
    await decideApplication(supabase, CLUB, APPLICANT, true);
    expect(repo.decideApplication).toHaveBeenCalledWith(supabase, CLUB, APPLICANT, true);
    repo.setRole.mockResolvedValue(member(MEMBER, { role: 'admin' }));
    expect(await setMemberRole(supabase, CLUB, MEMBER, 'admin')).toEqual({ role: 'admin' });
    await expect(setMemberRole(supabase, CLUB, MEMBER, 'president')).rejects.toHaveProperty(
      'issues'
    );
    await moderateMember(supabase, CLUB, MEMBER, 'ban');
    expect(repo.moderate).toHaveBeenCalledWith(supabase, CLUB, MEMBER, 'ban');
    await expect(moderateMember(supabase, CLUB, MEMBER, 'promote')).rejects.toHaveProperty(
      'issues'
    );
    repo.moderate.mockRejectedValue({ message: 'not_authorized', code: '42501' });
    await expect(moderateMember(supabase, CLUB, OWNER, 'remove')).rejects.toMatchObject({
      code: 'not_authorized',
    });
  });

  it('setClubNight sends an ISO first start and refuses one in the past', async () => {
    const firstStart = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const night = {
      title: 'Club night',
      theme: '',
      cadence: 'weekly',
      firstStart,
      durationMinutes: 120,
      capacity: 8,
      visibility: 'club',
    };
    repo.setNight.mockResolvedValue({ id: 'n' });
    await setClubNight(supabase, CLUB, night);
    expect(repo.setNight).toHaveBeenCalledWith(supabase, CLUB, {
      title: 'Club night',
      theme: null,
      cadence: 'weekly',
      firstStart,
      durationMinutes: 120,
      capacity: 8,
      visibility: 'club',
    });
    await expect(
      setClubNight(supabase, CLUB, { ...night, firstStart: '2020-01-01T00:00:00.000Z' })
    ).rejects.toHaveProperty('issues');
    repo.setNight.mockRejectedValue({ message: 'not_club_staff' });
    await expect(setClubNight(supabase, CLUB, night)).rejects.toMatchObject({
      code: 'not_club_staff',
    });
  });

  it('getHostIneligibleReason passes the three reasons through and nothing else', async () => {
    repo.hostIneligibleReason.mockResolvedValue('host_recent_report');
    expect(await getHostIneligibleReason(supabase)).toBe('host_recent_report');
    repo.hostIneligibleReason.mockResolvedValue(null);
    expect(await getHostIneligibleReason(supabase)).toBeNull();
    repo.hostIneligibleReason.mockResolvedValue('not_authorized');
    expect(await getHostIneligibleReason(supabase)).toBeNull();
  });
});
