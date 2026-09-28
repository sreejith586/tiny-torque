// Identity service — auth + profile. Components import from here, never from repo.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { profileCreateSchema, profilePatchSchema } from './schema';
import type { ProfileCreateInput, ProfilePatch, ProfileRow } from './types';

export const sendOtp = repo.sendOtp;
export const verifyOtp = repo.verifyOtp;
export const sendEmailOtp = repo.sendEmailOtp;
export const verifyEmailOtp = repo.verifyEmailOtp;
export const signOut = repo.signOut;
export const getProfile = repo.getProfile;

/**
 * Stopgap handle generator so `createProfile` satisfies the DB's NOT NULL/format
 * constraint (identity_v2, MV-S1-01). Real handle rules (regex, reserved words,
 * user-editable, uniqueness check via server action) land in MV-S1-05.
 */
function provisionalHandle(displayName: string): string {
  const base =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 19) || 'collector';
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}_${suffix}`;
}

/** First-login onboarding: creates the profiles row (id = auth user id). */
export async function createProfile(supabase: Client, userId: string, input: ProfileCreateInput) {
  const v = profileCreateSchema.parse(input);
  const row = {
    id: userId,
    display_name: v.displayName,
    account_type: v.accountType,
    store_name: v.storeName ?? null,
    location: v.location ?? null,
    mobile: v.mobile ?? null,
    photo_url: v.photoUrl ?? null,
  };
  // provisionalHandle's random suffix can collide (low probability, non-zero); retry a few
  // times with a fresh suffix on a unique-constraint violation rather than failing onboarding.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await repo.insertProfile(supabase, { ...row, handle: provisionalHandle(v.displayName) });
      return;
    } catch (err) {
      const isHandleCollision =
        typeof err === 'object' && err !== null && 'code' in err && err.code === '23505';
      if (!isHandleCollision || attempt === 4) throw err;
    }
  }
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
  if (Object.keys(row).length === 0) return;
  await repo.updateProfile(supabase, userId, row);
}

export type { ProfileRow, ProfileCreateInput, ProfilePatch };
