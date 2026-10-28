// The ONLY file in this module that talks to Supabase (D-007).
import type { Client } from '@/lib/supabase/types';

/** Remaining scans this rolling-30d period (DB function is the backstop, D-021). */
export async function scanQuotaRemaining(supabase: Client, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('entitlement_scan_quota', { p_user: userId });
  if (error) throw error;
  return data ?? 0;
}

/** Total active-listing slots for a user (base plan + grants; DB function is the backstop, D-021). */
export async function listingSlots(supabase: Client, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('entitlement_listing_slots', { p_user: userId });
  if (error) throw error;
  return data ?? 0;
}

/** DB-backed Pro check (pro_until > now(), D-021 backstop) — prefer `isProActive(profile)` when
 *  you already have the profile row loaded; this is for contexts that only have a user id. */
export async function isPro(supabase: Client, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_pro', { p_user: userId });
  if (error) throw error;
  return data ?? false;
}
