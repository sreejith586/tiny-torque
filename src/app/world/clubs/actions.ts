'use server';

// Club server actions (MV-W07-03/04). Each one: session → `world` + `world_clubs` flags →
// domain/clubs service → a plain result the client view renders inline. Membership, roles, bans,
// eligibility and the club night live in the RPCs (07 P4 / D-071); nothing here asserts a role.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import {
  ClubError,
  createClub,
  decideApplication,
  inviteToClub,
  joinClub,
  leaveClub,
  moderateMember,
  setClubNight,
  setMemberRole,
  stopClubNight,
  updateClub,
  type ClubErrorCode,
  type ClubMemberStatus,
  type ClubRole,
} from '@/domain/clubs';
import { CLUB_ERROR_COPY } from '@/components/world/clubs/copy';
import type { Client } from '@/lib/supabase/types';

export type ClubActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ClubErrorCode | 'invalid' | 'unavailable'; error: string };

async function gate(): Promise<
  { ok: true; supabase: Client; userId: string } | { ok: false; code: 'unavailable'; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unavailable', error: 'Sign in to join clubs.' };
  const ctx = { userId: user.id };
  if (
    !(await isFlagEnabled(supabase, 'world', ctx)) ||
    !(await isFlagEnabled(supabase, 'world_clubs', ctx))
  )
    return { ok: false, code: 'unavailable', error: 'Clubs are not open for you yet.' };
  return { ok: true, supabase, userId: user.id };
}

function fail(e: unknown): ClubActionResult<never> {
  if (e instanceof ClubError) return { ok: false, code: e.code, error: CLUB_ERROR_COPY[e.code] };
  if (e && typeof e === 'object' && 'issues' in e) {
    const first = (e as { issues: { message?: string }[] }).issues[0]?.message;
    return { ok: false, code: 'invalid', error: first ?? CLUB_ERROR_COPY.invalid_input };
  }
  throw e;
}

function done(slug?: string) {
  revalidatePath('/world/clubs', 'layout');
  if (slug) revalidatePath(`/world/clubs/${slug}`, 'layout');
}

export async function createClubAction(
  input: unknown
): Promise<ClubActionResult<{ slug: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await createClub(g.supabase, input);
    done(row.slug);
    return { ok: true, data: { slug: row.slug } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateClubAction(
  clubId: string,
  slug: string,
  input: unknown
): Promise<ClubActionResult<{ name: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await updateClub(g.supabase, clubId, input);
    done(slug);
    return { ok: true, data: { name: row.name } };
  } catch (e) {
    return fail(e);
  }
}

export async function joinClubAction(
  clubId: string,
  slug: string
): Promise<ClubActionResult<{ status: ClubMemberStatus }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const r = await joinClub(g.supabase, clubId);
    done(slug);
    return { ok: true, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function leaveClubAction(clubId: string, slug: string): Promise<ClubActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await leaveClub(g.supabase, clubId);
    done(slug);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function inviteToClubAction(
  clubId: string,
  slug: string,
  handle: string
): Promise<ClubActionResult<{ status: ClubMemberStatus }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const r = await inviteToClub(g.supabase, clubId, handle);
    done(slug);
    return { ok: true, data: { status: r.status } };
  } catch (e) {
    return fail(e);
  }
}

export async function decideApplicationAction(
  clubId: string,
  slug: string,
  userId: string,
  approve: boolean
): Promise<ClubActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await decideApplication(g.supabase, clubId, userId, approve);
    done(slug);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function setMemberRoleAction(
  clubId: string,
  slug: string,
  userId: string,
  role: ClubRole
): Promise<ClubActionResult<{ role: ClubRole }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const r = await setMemberRole(g.supabase, clubId, userId, role);
    done(slug);
    return { ok: true, data: r };
  } catch (e) {
    return fail(e);
  }
}

export async function moderateMemberAction(
  clubId: string,
  slug: string,
  userId: string,
  action: 'remove' | 'ban' | 'unban'
): Promise<ClubActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await moderateMember(g.supabase, clubId, userId, action);
    done(slug);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function setClubNightAction(
  clubId: string,
  slug: string,
  input: unknown
): Promise<ClubActionResult<{ nextStartsAt: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await setClubNight(g.supabase, clubId, input);
    done(slug);
    return { ok: true, data: { nextStartsAt: row.next_starts_at } };
  } catch (e) {
    return fail(e);
  }
}

export async function stopClubNightAction(clubId: string, slug: string): Promise<ClubActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await stopClubNight(g.supabase, clubId);
    done(slug);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
