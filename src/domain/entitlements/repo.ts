// The ONLY file in this module that talks to Supabase (D-007).
import type { Client } from '@/lib/supabase/types';

/** Remaining scans this rolling-30d period (DB function is the backstop, D-021). */
export async function scanQuotaRemaining(supabase: Client, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('entitlement_scan_quota', { p_user: userId });
  if (error) throw error;
  return data ?? 0;
}
