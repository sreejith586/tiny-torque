'use server';

// Virtual meetup server actions (MV-W06-03/04). Each one: session → `world` + `world_meetups` flags →
// domain/meetups service → a plain result the client view renders inline. Nothing here asserts an
// amount or a seat: the fee, the cap, visibility and moderation live in the RPCs (07 P4 / D-071).
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import {
  MeetupError,
  createMeetup,
  inviteToMeetup,
  moderateAttendee,
  removeMeetupPhoto,
  rsvpMeetup,
  setCohost,
  setShowcase,
  transitionMeetup,
  updateMeetup,
  voteBestInShow,
  type MeetupErrorCode,
  type MeetupRow,
  type MeetupRsvpRow,
} from '@/domain/meetups';
import { MEETUP_ERROR_COPY } from '@/components/world/meetups/copy';
import type { Client } from '@/lib/supabase/types';

export type MeetupActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: MeetupErrorCode | 'invalid' | 'unavailable'; error: string };

async function gate(): Promise<
  { ok: true; supabase: Client; userId: string } | { ok: false; code: 'unavailable'; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unavailable', error: MEETUP_ERROR_COPY.not_authorized };
  const ctx = { userId: user.id };
  if (
    !(await isFlagEnabled(supabase, 'world', ctx)) ||
    !(await isFlagEnabled(supabase, 'world_meetups', ctx))
  )
    return { ok: false, code: 'unavailable', error: 'Meetups are not open for you yet.' };
  return { ok: true, supabase, userId: user.id };
}

function fail(e: unknown): MeetupActionResult<never> {
  if (e instanceof MeetupError)
    return { ok: false, code: e.code, error: MEETUP_ERROR_COPY[e.code] };
  if (e && typeof e === 'object' && 'issues' in e) {
    const first = (e as { issues: { message?: string }[] }).issues[0]?.message;
    return { ok: false, code: 'invalid', error: first ?? MEETUP_ERROR_COPY.invalid_input };
  }
  throw e;
}

function done(id?: string) {
  revalidatePath('/world/meetups', 'layout');
  if (id) revalidatePath(`/world/meetups/${id}`, 'layout');
}

export async function createMeetupAction(
  input: unknown
): Promise<MeetupActionResult<{ id: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await createMeetup(g.supabase, input);
    done(row.id);
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMeetupAction(
  id: string,
  input: unknown
): Promise<
  MeetupActionResult<Pick<MeetupRow, 'title' | 'starts_at' | 'ends_at' | 'capacity' | 'visibility'>>
> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await updateMeetup(g.supabase, g.userId, id, input);
    done(id);
    return {
      ok: true,
      data: {
        title: row.title,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        capacity: row.capacity,
        visibility: row.visibility,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function transitionMeetupAction(
  id: string,
  action: 'schedule' | 'start' | 'end' | 'cancel'
): Promise<MeetupActionResult<{ status: MeetupRow['status']; feePaid: number }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await transitionMeetup(g.supabase, id, action);
    done(id);
    return { ok: true, data: { status: row.status, feePaid: row.fee_paid } };
  } catch (e) {
    return fail(e);
  }
}

export async function rsvpMeetupAction(
  id: string,
  status: 'going' | 'declined'
): Promise<MeetupActionResult<{ status: MeetupRsvpRow['status'] }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await rsvpMeetup(g.supabase, id, status);
    done(id);
    return { ok: true, data: { status: row.status } };
  } catch (e) {
    return fail(e);
  }
}

export async function setShowcaseAction(
  id: string,
  itemIds: string[]
): Promise<MeetupActionResult<{ itemIds: string[] }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const rows = await setShowcase(g.supabase, id, itemIds);
    done(id);
    return { ok: true, data: { itemIds: rows.map((r) => r.item_id) } };
  } catch (e) {
    return fail(e);
  }
}

export async function inviteToMeetupAction(
  id: string,
  handle: string
): Promise<MeetupActionResult<{ userId: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await inviteToMeetup(g.supabase, id, handle);
    done(id);
    return { ok: true, data: { userId: row.user_id } };
  } catch (e) {
    return fail(e);
  }
}

export async function setCohostAction(
  id: string,
  handle: string,
  on: boolean
): Promise<MeetupActionResult<{ userId: string; role: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await setCohost(g.supabase, id, handle, on);
    done(id);
    return { ok: true, data: { userId: row.user_id, role: row.role } };
  } catch (e) {
    return fail(e);
  }
}

export async function moderateAttendeeAction(
  id: string,
  userId: string,
  action: 'mute' | 'unmute' | 'kick'
): Promise<MeetupActionResult<{ muted: boolean; removed: boolean }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await moderateAttendee(g.supabase, id, userId, action);
    done(id);
    return { ok: true, data: { muted: row.muted_at !== null, removed: row.removed_at !== null } };
  } catch (e) {
    return fail(e);
  }
}

// ---------- W07 (MV-W07-01): best-in-show + photo wall ----------

export async function voteBestInShowAction(
  id: string,
  showcaseId: string
): Promise<MeetupActionResult<{ showcaseId: string; votes: number }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const r = await voteBestInShow(g.supabase, id, showcaseId);
    done(id);
    return { ok: true, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function removeMeetupPhotoAction(
  id: string,
  mediaId: string
): Promise<MeetupActionResult<{ mediaId: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await removeMeetupPhoto(g.supabase, mediaId);
    done(id);
    return { ok: true, data: { mediaId } };
  } catch (e) {
    return fail(e);
  }
}
