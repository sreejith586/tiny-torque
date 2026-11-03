// The ONLY file in this module that talks to Supabase (D-007).
import type { Client, TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import type { ProfileRow } from './types';

export async function sendOtp(supabase: Client, phoneE164: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
  if (error) throw error;
}

export async function verifyOtp(supabase: Client, phoneE164: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneE164,
    token: code,
    type: 'sms',
  });
  if (error) throw error;
  return data.user;
}

export async function sendEmailOtp(supabase: Client, email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(supabase: Client, email: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw error;
  return data.user;
}

export async function signOut(supabase: Client) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(supabase: Client, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertProfile(supabase: Client, row: TablesInsert<'profiles'>) {
  const { error } = await supabase.from('profiles').insert(row);
  if (error) throw error;
}

export async function updateProfile(
  supabase: Client,
  userId: string,
  patch: TablesUpdate<'profiles'>
) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

// public_profiles, not profiles: the base table's SELECT policy is owner-or-admin only (D-015),
// so checking another user's handle has to go through the public view.
export async function isHandleAvailable(
  supabase: Client,
  handle: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = supabase.from('public_profiles').select('id').eq('handle', handle);
  if (excludeUserId) query = query.neq('id', excludeUserId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return !data;
}

/** Caller-only cascade delete (0020 `delete_account()`); see service.deleteAccount. */
export async function deleteAccount(supabase: Client) {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
}

export async function redeemInvite(supabase: Client, code: string) {
  const { error } = await supabase.rpc('redeem_invite', { p_code: code });
  if (error) throw error;
}

export async function listEnabledCountries(supabase: Client) {
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .eq('enabled', true)
    .order('code');
  if (error) throw error;
  return data;
}

// F-14: the public /u/{handle} page reads only this view (D-015 — never the base `profiles` table).
export async function getPublicProfile(supabase: Client, handle: string) {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Public profile by id — for places that hold a user id (e.g. a listing's seller), not a handle. */
export async function getPublicProfileById(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- follows (F-14 follow button, MV-S8-07) — RLS: public read, owner insert/delete (0002) ----------
export async function followUser(supabase: Client, followerId: string, followeeId: string) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, followee_id: followeeId });
  if (error) throw error;
}

export async function unfollowUser(supabase: Client, followerId: string, followeeId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) throw error;
}

export async function isFollowing(
  supabase: Client,
  followerId: string,
  followeeId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Public follower count (03 §2.12 "public read count"). */
export async function countFollowers(supabase: Client, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('followee_id', userId);
  if (error) throw error;
  return count ?? 0;
}

/** Batch version of getPublicProfileById — one round trip for a list of counterparties (e.g. the
 * distinct buyers/sellers across an offers inbox) instead of N. */
export async function listPublicProfilesByIds(supabase: Client, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('public_profiles').select('*').in('id', ids);
  if (error) throw error;
  return data;
}
