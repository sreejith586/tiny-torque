// Virtual meetups service (MV-W06-02, F-23). Components / routes / actions import from here, never from
// repo. The DB owns the lifecycle (transition_meetup), capacity, visibility, blocks, moderation and the
// fee (D-021 / D-071) and emits the meetup.* events itself (D-009); this layer adds zod (D-013), the
// clean-language check (MV-S6-04), the one app-side mutation's event (host edits → meetup.updated) and
// the public-identity joins (handles + display names only, never PII — rule 15).
import type { Client } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import { listPublicProfilesByIds } from '@/domain/identity';
import { listMediaForEntities } from '@/domain/media';
import type { GarageItem } from '@/domain/garage';
import { getOwnGarage } from '@/domain/world';
import { isProActive } from '@/domain/entitlements';
import { getProfile } from '@/domain/identity';
import { findBannedLanguage } from '@/lib/clean-language';
import * as repo from './repo';
import { MeetupError, rethrowAsMeetupError } from './errors';
import {
  createMeetupSchema,
  handleSchema,
  meetupIdSchema,
  moderateActionSchema,
  rsvpStatusSchema,
  showcaseSchema,
  transitionActionSchema,
  updateMeetupSchema,
} from './schema';
import { hostFee, isEditable } from './state';
import type {
  HostCapacity,
  MeetupAttendee,
  MeetupDetail,
  MeetupInviteRow,
  MeetupListItem,
  MeetupRow,
  MeetupRsvpRow,
  MeetupShowcaseEntry,
  MeetupShowcaseRow,
  PublicIdentity,
} from './types';

export type { MeetupAction, MeetupViewer, TransitionContext } from './state';
export * from './state';
export * from './types';
export { MeetupError, type MeetupErrorCode } from './errors';
export {
  createMeetupSchema,
  updateMeetupSchema,
  roomMessageSchema,
  roomReactionSchema,
  type CreateMeetupInput,
  type UpdateMeetupInput,
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

function isActiveSeat(r: MeetupRsvpRow): boolean {
  return r.removed_at === null && (r.status === 'going' || r.status === 'checked_in');
}

// ---------- reads ----------

/** `/world/meetups`: upcoming (scheduled / live, soonest first) or mine (hosted ∪ rsvp'd, latest first). */
export async function listMeetups(
  supabase: Client,
  viewerId: string,
  tab: 'upcoming' | 'mine'
): Promise<MeetupListItem[]> {
  let rows: MeetupRow[];
  let myRsvps: MeetupRsvpRow[] = [];
  if (tab === 'upcoming') {
    rows = await repo.listUpcoming(supabase);
    myRsvps = await repo.listMyRsvps(supabase, viewerId);
  } else {
    const [hosted, rsvps] = await Promise.all([
      repo.listHosted(supabase, viewerId),
      repo.listMyRsvps(supabase, viewerId),
    ]);
    myRsvps = rsvps;
    const hostedIds = new Set(hosted.map((m) => m.id));
    const joined = await repo.listMeetupsByIds(
      supabase,
      rsvps.map((r) => r.meetup_id).filter((id) => !hostedIds.has(id))
    );
    rows = [...hosted, ...joined].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  }
  const [going, hosts] = await Promise.all([
    repo.listGoingRsvps(
      supabase,
      rows.map((m) => m.id)
    ),
    identities(
      supabase,
      rows.map((m) => m.host_id)
    ),
  ]);
  const goingCount = new Map<string, number>();
  for (const r of going) goingCount.set(r.meetup_id, (goingCount.get(r.meetup_id) ?? 0) + 1);
  const mine = new Map(myRsvps.map((r) => [r.meetup_id, r]));
  return rows.map((m) => ({
    meetup: m,
    host: hosts.get(m.host_id) ?? UNKNOWN(m.host_id),
    goingCount: goingCount.get(m.id) ?? 0,
    myRsvp: mine.get(m.id)?.status ?? null,
    isHost: m.host_id === viewerId,
  }));
}

async function attachItems(
  supabase: Client,
  showcase: MeetupShowcaseRow[],
  who: Map<string, PublicIdentity>
): Promise<MeetupShowcaseEntry[]> {
  const ids = showcase.map((s) => s.item_id);
  const items = await repo.listCollectionItemsByIds(supabase, ids);
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
  const byId = new Map<string, GarageItem>(
    items.map((i) => [i.id, { ...i, media: mediaByItem.get(i.id) ?? [] }])
  );
  return showcase.map((s) => ({
    id: s.id,
    userId: s.user_id,
    itemId: s.item_id,
    position: s.position,
    item: byId.get(s.item_id) ?? null,
    owner: who.get(s.user_id) ?? null,
  }));
}

/** Everything the detail page and the room need, or null when the viewer may not see the meetup
 *  (unknown id, draft of someone else, hidden visibility, block — all via RLS). */
export async function getMeetupDetail(
  supabase: Client,
  idInput: unknown,
  viewerId: string | null
): Promise<MeetupDetail | null> {
  const parsed = meetupIdSchema.safeParse(idInput);
  if (!parsed.success) return null;
  const meetup = await repo.getMeetup(supabase, parsed.data);
  if (!meetup) return null;

  const [rsvps, showcase, invites] = await Promise.all([
    repo.listRsvps(supabase, meetup.id),
    repo.listShowcase(supabase, meetup.id),
    repo.listInvites(supabase, meetup.id).catch((): MeetupInviteRow[] => []),
  ]);
  const who = await identities(supabase, [
    meetup.host_id,
    ...rsvps.map((r) => r.user_id),
    ...showcase.map((s) => s.user_id),
    ...invites.map((i) => i.user_id),
  ]);

  const attendees: MeetupAttendee[] = rsvps
    .filter((r) => r.removed_at === null && r.status !== 'declined')
    .map((r) => ({
      user: who.get(r.user_id) ?? UNKNOWN(r.user_id),
      status: r.status,
      role: r.role === 'cohost' ? 'cohost' : 'attendee',
      muted: r.muted_at !== null,
      removed: r.removed_at !== null,
    }));
  const mine = viewerId ? (rsvps.find((r) => r.user_id === viewerId) ?? null) : null;
  const isHost = viewerId !== null && viewerId === meetup.host_id;
  const isCohost = mine !== null && mine.role === 'cohost' && mine.removed_at === null;
  const isMember = isHost || isCohost || (mine !== null && isActiveSeat(mine));

  return {
    meetup,
    host: who.get(meetup.host_id) ?? UNKNOWN(meetup.host_id),
    viewer: {
      id: viewerId,
      isHost,
      isCohost,
      isStaff: isHost || isCohost,
      rsvp: mine,
      isMember,
      muted: mine?.muted_at != null,
    },
    attendees,
    goingCount: rsvps.filter(isActiveSeat).length,
    waitlistCount: rsvps.filter((r) => r.removed_at === null && r.status === 'waitlist').length,
    showcase: await attachItems(supabase, showcase, who),
    invites: invites.map((i) => ({
      user: who.get(i.user_id) ?? UNKNOWN(i.user_id),
      createdAt: i.created_at,
    })),
  };
}

/** What the create form needs: the caller's cap (level host_cap, +50 % Pro) and the fee table. */
export async function getHostCapacity(supabase: Client, userId: string): Promise<HostCapacity> {
  const [own, profile, cap] = await Promise.all([
    getOwnGarage(supabase),
    getProfile(supabase, userId),
    repo.hostCap(supabase, userId),
  ]);
  return {
    cap,
    level: own.level.level,
    levelName: own.level.name,
    isPro: profile ? isProActive(profile) : false,
    fee: hostFee,
  };
}

// ---------- writes ----------

function endFrom(startsAt: string, durationMinutes: number): string {
  return new Date(Date.parse(startsAt) + durationMinutes * 60_000).toISOString();
}

/** Creates a draft at the caller's garage (create_meetup emits meetup.created). Throws MeetupError:
 *  host_not_eligible / capacity_too_high / starts_in_past / not_club_member / language_not_allowed. */
export async function createMeetup(supabase: Client, input: unknown): Promise<MeetupRow> {
  const v = createMeetupSchema.parse(input);
  for (const text of [v.title, v.theme ?? '', v.description ?? '']) {
    if (text && findBannedLanguage(text)) throw new MeetupError('language_not_allowed');
  }
  try {
    return await repo.createMeetup(supabase, {
      title: v.title,
      theme: v.theme || null,
      description: v.description || null,
      startsAt: new Date(v.startsAt).toISOString(),
      endsAt: endFrom(v.startsAt, v.durationMinutes),
      capacity: v.capacity,
      visibility: v.visibility,
      clubId: v.visibility === 'club' ? (v.clubId ?? null) : null,
    });
  } catch (e) {
    rethrowAsMeetupError(e);
  }
}

/** Host edits (title / theme / description / time / capacity / visibility) while draft or scheduled.
 *  The DB guard re-checks capacity, start time and visibility; this emits meetup.updated (D-009). */
export async function updateMeetup(
  supabase: Client,
  userId: string,
  idInput: unknown,
  input: unknown
): Promise<MeetupRow> {
  const id = meetupIdSchema.parse(idInput);
  const v = updateMeetupSchema.parse(input);
  for (const text of [v.title ?? '', v.theme ?? '', v.description ?? '']) {
    if (text && findBannedLanguage(text)) throw new MeetupError('language_not_allowed');
  }
  const current = await repo.getMeetup(supabase, id);
  if (!current || current.host_id !== userId) throw new MeetupError('meetup_not_found');
  if (!isEditable(current.status)) throw new MeetupError('meetup_closed');

  const patch: Parameters<typeof repo.updateMeetup>[2] = {};
  if (v.title !== undefined) patch.title = v.title;
  if (v.theme !== undefined) patch.theme = v.theme || null;
  if (v.description !== undefined) patch.description = v.description || null;
  if (v.capacity !== undefined) patch.capacity = v.capacity;
  if (v.visibility !== undefined) patch.visibility = v.visibility;
  if (v.startsAt !== undefined || v.durationMinutes !== undefined) {
    const startsAt = v.startsAt ? new Date(v.startsAt).toISOString() : current.starts_at;
    const minutes =
      v.durationMinutes ??
      Math.round((Date.parse(current.ends_at) - Date.parse(current.starts_at)) / 60_000);
    patch.starts_at = startsAt;
    patch.ends_at = endFrom(startsAt, minutes);
  }
  if (Object.keys(patch).length === 0) return current;

  let row: MeetupRow;
  try {
    row = await repo.updateMeetup(supabase, id, patch);
  } catch (e) {
    rethrowAsMeetupError(e);
  }
  await emitEvent(supabase, {
    actorId: userId,
    type: 'meetup.updated',
    entity: 'meetup',
    entityId: id,
    payload: { fields: Object.keys(patch) },
  });
  return row;
}

/** schedule / start / end / cancel through transition_meetup (fee, refund, notifications and events all
 *  happen inside the RPC). Throws MeetupError with the RPC's code. */
export async function transitionMeetup(
  supabase: Client,
  idInput: unknown,
  actionInput: unknown
): Promise<MeetupRow> {
  const id = meetupIdSchema.parse(idInput);
  const action = transitionActionSchema.parse(actionInput);
  try {
    return await repo.transition(supabase, id, action);
  } catch (e) {
    rethrowAsMeetupError(e);
  }
}

export async function rsvpMeetup(
  supabase: Client,
  idInput: unknown,
  statusInput: unknown = 'going'
): Promise<MeetupRsvpRow> {
  const id = meetupIdSchema.parse(idInput);
  const status = rsvpStatusSchema.parse(statusInput);
  try {
    return await repo.rsvp(supabase, id, status);
  } catch (e) {
    rethrowAsMeetupError(e);
  }
}

/** Replaces the caller's showcase picks (≤ showcase_limit own public cars). */
export async function setShowcase(
  supabase: Client,
  idInput: unknown,
  itemIdsInput: unknown
): Promise<MeetupShowcaseRow[]> {
  const id = meetupIdSchema.parse(idInput);
  const itemIds = showcaseSchema.parse(itemIdsInput);
  try {
    return await repo.setShowcase(supabase, id, Array.from(new Set(itemIds)));
  } catch (e) {
    rethrowAsMeetupError(e);
  }
}

export async function inviteToMeetup(
  supabase: Client,
  idInput: unknown,
  handleInput: unknown
): Promise<MeetupInviteRow> {
  const id = meetupIdSchema.parse(idInput);
  const handle = handleSchema.parse(handleInput);
  try {
    return await repo.invite(supabase, id, handle);
  } catch (e) {
    rethrowAsMeetupError(e);
  }
}

export async function setCohost(
  supabase: Client,
  idInput: unknown,
  handleInput: unknown,
  on: boolean
): Promise<MeetupRsvpRow> {
  const id = meetupIdSchema.parse(idInput);
  const handle = handleSchema.parse(handleInput);
  try {
    return await repo.setCohost(supabase, id, handle, on);
  } catch (e) {
    rethrowAsMeetupError(e);
  }
}

export async function moderateAttendee(
  supabase: Client,
  idInput: unknown,
  userIdInput: unknown,
  actionInput: unknown
): Promise<MeetupRsvpRow> {
  const id = meetupIdSchema.parse(idInput);
  const userId = meetupIdSchema.parse(userIdInput); // any uuid
  const action = moderateActionSchema.parse(actionInput);
  try {
    return await repo.moderate(supabase, id, userId, action);
  } catch (e) {
    rethrowAsMeetupError(e);
  }
}
