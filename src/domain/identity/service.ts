// Identity service — auth + profile. Components import from here, never from repo.
import type { Client } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import * as repo from './repo';
import { profileCreateSchema, profilePatchSchema, RESERVED_HANDLES } from './schema';
import type { ProfileCreateInput, ProfilePatch, ProfileRow, CountryRow } from './types';

export const sendOtp = repo.sendOtp;
export const verifyOtp = repo.verifyOtp;
export const sendEmailOtp = repo.sendEmailOtp;
export const verifyEmailOtp = repo.verifyEmailOtp;
export const signOut = repo.signOut;
export const getProfile = repo.getProfile;
export const redeemInvite = repo.redeemInvite;
export const listEnabledCountries = repo.listEnabledCountries;
export const isHandleAvailable = repo.isHandleAvailable;
export { CITIES_BY_COUNTRY } from './cities';

/**
 * Onboarding's country prefill (F-01): match the signed-in phone's E.164 dial code against the
 * pilot's enabled countries; email sign-ins (no phone) default to AE.
 */
export function defaultCountryCode(
  contact: { phone?: string | null; email?: string | null },
  countries: Pick<CountryRow, 'code' | 'dial_code'>[]
): string {
  if (contact.phone) {
    const match = countries.find((c) => contact.phone!.startsWith(c.dial_code));
    if (match) return match.code;
  }
  return 'AE';
}

export const HANDLE_COOLDOWN_DAYS = 30;

/** Deterministic slug from a display name; falls back to 'collector' when nothing usable is left. */
export function slugifyHandle(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 19);
  return base.length >= 3 ? base : 'collector';
}

/** True while a handle change made at `handleChangedAt` is still inside the 30-day cooldown (F-01). */
export function isHandleCooldownActive(
  handleChangedAt: string | null,
  now: Date = new Date()
): boolean {
  if (!handleChangedAt) return false;
  const cooldownEndsAt =
    new Date(handleChangedAt).getTime() + HANDLE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() < cooldownEndsAt;
}

/** Auto-suggested handle for onboarding: slug, then slug_1, slug_2, ... until one's free. */
export async function suggestAvailableHandle(
  supabase: Client,
  displayName: string
): Promise<string> {
  const base = slugifyHandle(displayName);
  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix === 0 ? base : `${base}_${suffix}`;
    if (RESERVED_HANDLES.has(candidate)) continue;
    if (await repo.isHandleAvailable(supabase, candidate)) return candidate;
  }
  // 50 deterministic collisions on the same base is not realistic at pilot scale; if it ever
  // happens, a random tail beats failing onboarding outright.
  return `${base}_${Math.random().toString(36).slice(2, 6)}`;
}

/** First-login onboarding: creates the profiles row (id = auth user id). */
export async function createProfile(supabase: Client, userId: string, input: ProfileCreateInput) {
  const v = profileCreateSchema.parse(input);

  let handle: string;
  if (v.handle) {
    if (!(await repo.isHandleAvailable(supabase, v.handle))) {
      throw new Error('That handle is already taken.');
    }
    handle = v.handle;
  } else {
    handle = await suggestAvailableHandle(supabase, v.displayName);
  }

  await repo.insertProfile(supabase, {
    id: userId,
    display_name: v.displayName,
    account_type: v.accountType,
    store_name: v.storeName ?? null,
    location: v.location ?? null,
    mobile: v.mobile ?? null,
    photo_url: v.photoUrl ?? null,
    handle,
    country_code: v.countryCode,
    city: v.city ?? null,
    onboarding_completed_at: new Date().toISOString(),
  });

  await emitEvent(supabase, {
    actorId: userId,
    type: 'user.onboarded',
    entity: 'profile',
    entityId: userId,
  });
}

/** Profile edit with PATCH semantics — untouched fields are never nulled (MV-S0-09). */
export async function patchProfile(supabase: Client, userId: string, patch: ProfilePatch) {
  const v = profilePatchSchema.parse(patch);
  const row: Record<string, unknown> = {};
  if (v.displayName !== undefined) row.display_name = v.displayName;
  if (v.accountType !== undefined) row.account_type = v.accountType;
  if (v.storeName !== undefined) row.store_name = v.storeName;
  if (v.location !== undefined) row.location = v.location;
  if (v.mobile !== undefined) row.mobile = v.mobile;
  if (v.photoUrl !== undefined) row.photo_url = v.photoUrl;

  if (v.handle !== undefined) {
    const current = await repo.getProfile(supabase, userId);
    if (!current) throw new Error('Profile not found.');
    if (v.handle !== current.handle) {
      if (isHandleCooldownActive(current.handle_changed_at)) {
        throw new Error(`You can change your handle again 30 days after your last change.`);
      }
      if (!(await repo.isHandleAvailable(supabase, v.handle, userId))) {
        throw new Error('That handle is already taken.');
      }
      row.handle = v.handle;
      row.handle_changed_at = new Date().toISOString();
    }
  }

  if (Object.keys(row).length === 0) return;
  await repo.updateProfile(supabase, userId, row);
  await emitEvent(supabase, {
    actorId: userId,
    type: 'profile.updated',
    entity: 'profile',
    entityId: userId,
  });
}

export type { ProfileRow, ProfileCreateInput, ProfilePatch, CountryRow };
