// Clubs service (MV-W07-02, F-22). Components / routes / actions import from here, never from repo.
// The DB owns membership, roles, bans, blocks, eligibility and the club night (D-021 / D-071) and emits
// the club.* events itself (D-009); this layer adds zod (D-013), the clean-language check (MV-S6-04)
// and the public-identity joins (handles + display names only, never PII — rule 15).
import type { Client } from '@/lib/supabase/types';
import { listPublicProfilesByIds } from '@/domain/identity';
import { listMediaForEntities } from '@/domain/media';
import type { GarageItem } from '@/domain/garage';
import type { PublicIdentity } from '@/domain/meetups';
import { findBannedLanguage } from '@/lib/clean-language';
import * as repo from './repo';
import { ClubError, rethrowAsClubError } from './errors';
import {
  clubHandleSchema,
  clubIdSchema,
  clubNightSchema,
  clubSlugSchema,
  createClubSchema,
  memberRoleSchema,
  moderateMemberActionSchema,
  updateClubSchema,
  userIdSchema,
} from './schema';
import { isStaff, type HostIneligibleReason } from './state';
import type {
  ClubDetail,
  ClubFeaturedCar,
  ClubFeedItem,
  ClubListItem,
  ClubMember,
  ClubMemberRow,
  ClubNightRow,
  ClubRow,
  ClubViewerState,
  StaffClub,
} from './types';

export * from './state';
export * from './types';
export { ClubError, type ClubErrorCode } from './errors';
export {
  createClubSchema,
  updateClubSchema,
  clubNightSchema,
  type CreateClubInput,
  type UpdateClubInput,
  type ClubNightInput,
} from './schema';

async function identities(supabase: Client, ids: string[]): Promise<Map<string, PublicIdentity>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = await listPublicProfilesByIds(supabase, unique);
  return new Map(
    rows
      .filter((r) => r.id && r.handle)
      .map((r) => [
        r.id as string,
        {
          id: r.id as string,
          handle: r.handle as string,
          displayName: r.display_name ?? (r.handle as string),
        },
      ])
  );
}

const UNKNOWN = (id: string): PublicIdentity => ({
  id,
  handle: 'collector',
  displayName: 'Collector',
});

function viewerState(viewerId: string | null, mine: ClubMemberRow | null): ClubViewerState {
  const active = mine?.status === 'active';
  return {
    id: viewerId,
    role: active ? mine.role : null,
    status: mine?.status ?? null,
    invited: mine?.status === 'pending' && mine.invited_by !== null,
    isMember: active,
    isStaff: active && isStaff(mine.role),
    isOwner: active && mine.role === 'owner',
  };
}

// ---------- reads ----------

/** Clubs by id (public-read) — the admin hosting queue's previews. */
export const getClubsByIds = repo.listClubsByIds;

/** `/world/clubs`: every club (newest first) or the ones the viewer belongs to / applied to / was
 *  invited to, with member counts and the viewer's standing. */
export async function listClubs(
  supabase: Client,
  viewerId: string,
  tab: 'all' | 'mine'
): Promise<ClubListItem[]> {
  const memberships = await repo.listMyMemberships(supabase, viewerId);
  const mine = new Map(memberships.map((m) => [m.club_id, m]));
  const clubs =
    tab === 'all'
      ? await repo.listClubs(supabase)
      : await repo.listClubsByIds(
          supabase,
          memberships.filter((m) => m.status !== 'banned').map((m) => m.club_id)
        );
  const counts = await repo.memberCounts(
    supabase,
    clubs.map((c) => c.id)
  );
  return clubs
    .map((club) => {
      const m = mine.get(club.id) ?? null;
      return {
        club,
        memberCount: counts.get(club.id) ?? 0,
        myStatus: m?.status ?? null,
        myRole: m?.status === 'active' ? m.role : null,
        invited: m?.status === 'pending' && m.invited_by !== null,
      };
    })
    .sort((a, b) => a.club.name.localeCompare(b.club.name));
}

/** Clubs the user can host meetups for (active owner / admin) — the create form's options. */
export async function listStaffClubs(supabase: Client, userId: string): Promise<StaffClub[]> {
  const memberships = await repo.listMyMemberships(supabase, userId);
  const ids = memberships
    .filter((m) => m.status === 'active' && isStaff(m.role))
    .map((m) => m.club_id);
  const clubs = await repo.listClubsByIds(supabase, ids);
  return clubs
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toMember(row: ClubMemberRow, who: Map<string, PublicIdentity>): ClubMember {
  return {
    user: who.get(row.user_id) ?? UNKNOWN(row.user_id),
    role: row.role,
    status: row.status,
    invited: row.status === 'pending' && row.invited_by !== null,
    joinedAt: row.joined_at,
  };
}

const ROLE_ORDER = { owner: 0, admin: 1, member: 2 } as const;

/** Everything the clubhouse renders, or null for an unknown slug. What the viewer may not read (a
 *  closed club's roster and feed) simply comes back empty from RLS. */
export async function getClubDetail(
  supabase: Client,
  slugInput: unknown,
  viewerId: string | null
): Promise<ClubDetail | null> {
  const slug = clubSlugSchema.safeParse(slugInput);
  if (!slug.success) return null;
  const club = await repo.getClubBySlug(supabase, slug.data);
  if (!club) return null;

  const [rows, counts, feedRows, meetups, night] = await Promise.all([
    repo.listMembers(supabase, club.id),
    repo.memberCounts(supabase, [club.id]),
    repo.feed(supabase, club.id).catch(() => []),
    repo.listClubMeetups(supabase, club.id).catch(() => []),
    repo.getNight(supabase, club.id).catch((): ClubNightRow | null => null),
  ]);
  const mine = viewerId ? (rows.find((r) => r.user_id === viewerId) ?? null) : null;
  const viewer = viewerState(viewerId, mine);
  const active = rows.filter((r) => r.status === 'active');
  const featuredIds = await repo
    .listFeaturedItemIds(
      supabase,
      active.map((r) => r.user_id)
    )
    .catch(() => []);
  const who = await identities(supabase, [
    club.owner_id,
    ...rows.map((r) => r.user_id),
    ...feedRows.map((f) => f.actor_id ?? ''),
  ]);

  const items = await repo.listCollectionItemsByIds(
    supabase,
    featuredIds.map((f) => f.itemId)
  );
  const media = await listMediaForEntities(
    supabase,
    'item',
    items.map((i) => i.id)
  );
  const mediaByItem = new Map<string, { id: string }[]>();
  for (const m of media) {
    if (!m.entity_id) continue;
    const list = mediaByItem.get(m.entity_id) ?? [];
    list.push({ id: m.id });
    mediaByItem.set(m.entity_id, list);
  }
  const itemById = new Map<string, GarageItem>(
    items.map((i) => [i.id, { ...i, media: mediaByItem.get(i.id) ?? [] }])
  );
  const featured: ClubFeaturedCar[] = featuredIds.flatMap((f) => {
    const item = itemById.get(f.itemId);
    const owner = who.get(f.userId);
    return item && owner ? [{ owner, item }] : [];
  });

  const feed: ClubFeedItem[] = feedRows.map((f) => ({
    id: f.event_id,
    type: f.type,
    actor: f.actor_id ? (who.get(f.actor_id) ?? null) : null,
    payload: (f.payload ?? {}) as Record<string, unknown>,
    occurredAt: f.occurred_at,
  }));

  return {
    club,
    owner: who.get(club.owner_id) ?? UNKNOWN(club.owner_id),
    viewer,
    memberCount: counts.get(club.id) ?? active.length,
    members: active
      .map((r) => toMember(r, who))
      .sort(
        (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt.localeCompare(b.joinedAt)
      ),
    applications: viewer.isStaff
      ? rows
          .filter((r) => r.status === 'pending' && r.invited_by === null)
          .map((r) => toMember(r, who))
      : [],
    invitations: viewer.isStaff
      ? rows
          .filter((r) => r.status === 'pending' && r.invited_by !== null)
          .map((r) => toMember(r, who))
      : [],
    banned: viewer.isStaff
      ? rows.filter((r) => r.status === 'banned').map((r) => toMember(r, who))
      : [],
    featured,
    feed,
    meetups,
    night: viewer.isMember ? night : null,
  };
}

/** Why the caller cannot host a meetup / own a club right now, or null (F-28). */
export async function getHostIneligibleReason(
  supabase: Client
): Promise<HostIneligibleReason | null> {
  const reason = await repo.hostIneligibleReason(supabase);
  if (
    reason === 'hosting_suspended' ||
    reason === 'host_recent_report' ||
    reason === 'host_level_too_low'
  )
    return reason;
  return null;
}

// ---------- writes ----------

function assertClean(...texts: (string | null | undefined)[]): void {
  for (const text of texts) {
    if (text && findBannedLanguage(text)) throw new ClubError('language_not_allowed');
  }
}

/** Creates a club with the caller as its owner (create_club emits club.created). Throws ClubError:
 *  slug_taken / club_limit / host_level_too_low / host_recent_report / hosting_suspended /
 *  language_not_allowed. */
export async function createClub(supabase: Client, input: unknown): Promise<ClubRow> {
  const v = createClubSchema.parse(input);
  assertClean(v.slug.replace(/_/g, ' '), v.name, v.description);
  try {
    return await repo.createClub(supabase, {
      slug: v.slug,
      name: v.name,
      joinMode: v.joinMode,
      description: v.description || null,
      countryCode: v.countryCode || null,
    });
  } catch (e) {
    rethrowAsClubError(e);
  }
}

export async function updateClub(
  supabase: Client,
  clubIdInput: unknown,
  input: unknown
): Promise<ClubRow> {
  const clubId = clubIdSchema.parse(clubIdInput);
  const v = updateClubSchema.parse(input);
  assertClean(v.name, v.description);
  try {
    return await repo.updateClub(supabase, clubId, {
      name: v.name,
      joinMode: v.joinMode,
      description: v.description || null,
      countryCode: v.countryCode || null,
    });
  } catch (e) {
    rethrowAsClubError(e);
  }
}

/** Joins (open), applies (apply) or accepts an invitation. Returns where the caller stands now. */
export async function joinClub(
  supabase: Client,
  clubIdInput: unknown
): Promise<{ status: ClubMemberRow['status'] }> {
  const clubId = clubIdSchema.parse(clubIdInput);
  try {
    const row = await repo.join(supabase, clubId);
    return { status: row.status };
  } catch (e) {
    rethrowAsClubError(e);
  }
}

/** Leaves the club, withdraws an application or declines an invitation. */
export async function leaveClub(supabase: Client, clubIdInput: unknown): Promise<void> {
  const clubId = clubIdSchema.parse(clubIdInput);
  try {
    await repo.leave(supabase, clubId);
  } catch (e) {
    rethrowAsClubError(e);
  }
}

export async function inviteToClub(
  supabase: Client,
  clubIdInput: unknown,
  handleInput: unknown
): Promise<{ userId: string; status: ClubMemberRow['status'] }> {
  const clubId = clubIdSchema.parse(clubIdInput);
  const handle = clubHandleSchema.parse(handleInput);
  try {
    const row = await repo.invite(supabase, clubId, handle);
    return { userId: row.user_id, status: row.status };
  } catch (e) {
    rethrowAsClubError(e);
  }
}

export async function decideApplication(
  supabase: Client,
  clubIdInput: unknown,
  userIdInput: unknown,
  approve: boolean
): Promise<void> {
  const clubId = clubIdSchema.parse(clubIdInput);
  const userId = userIdSchema.parse(userIdInput);
  try {
    await repo.decideApplication(supabase, clubId, userId, approve);
  } catch (e) {
    rethrowAsClubError(e);
  }
}

/** Owner only: promote / demote, or hand the club over (role `owner`). */
export async function setMemberRole(
  supabase: Client,
  clubIdInput: unknown,
  userIdInput: unknown,
  roleInput: unknown
): Promise<{ role: ClubMemberRow['role'] }> {
  const clubId = clubIdSchema.parse(clubIdInput);
  const userId = userIdSchema.parse(userIdInput);
  const role = memberRoleSchema.parse(roleInput);
  try {
    const row = await repo.setRole(supabase, clubId, userId, role);
    return { role: row.role };
  } catch (e) {
    rethrowAsClubError(e);
  }
}

/** remove / ban / unban a member (owner and admins; only the owner acts on an admin). */
export async function moderateMember(
  supabase: Client,
  clubIdInput: unknown,
  userIdInput: unknown,
  actionInput: unknown
): Promise<void> {
  const clubId = clubIdSchema.parse(clubIdInput);
  const userId = userIdSchema.parse(userIdInput);
  const action = moderateMemberActionSchema.parse(actionInput);
  try {
    await repo.moderate(supabase, clubId, userId, action);
  } catch (e) {
    rethrowAsClubError(e);
  }
}

/** Sets (or replaces) the club's recurring night; the jobs runner spawns a draft per occurrence. */
export async function setClubNight(
  supabase: Client,
  clubIdInput: unknown,
  input: unknown
): Promise<ClubNightRow> {
  const clubId = clubIdSchema.parse(clubIdInput);
  const v = clubNightSchema.parse(input);
  assertClean(v.title, v.theme);
  try {
    return await repo.setNight(supabase, clubId, {
      title: v.title,
      theme: v.theme || null,
      cadence: v.cadence,
      firstStart: new Date(v.firstStart).toISOString(),
      durationMinutes: v.durationMinutes,
      capacity: v.capacity,
      visibility: v.visibility,
    });
  } catch (e) {
    rethrowAsClubError(e);
  }
}

export async function stopClubNight(supabase: Client, clubIdInput: unknown): Promise<void> {
  const clubId = clubIdSchema.parse(clubIdInput);
  try {
    await repo.stopNight(supabase, clubId);
  } catch (e) {
    rethrowAsClubError(e);
  }
}
