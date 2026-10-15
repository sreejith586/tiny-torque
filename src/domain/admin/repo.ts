// The ONLY file in this module that talks to Supabase (D-007). admin_search_users is a definer
// RPC that re-checks is_admin() itself — this is a second layer, not the real gate (that's the
// RPC + /admin route guards, src/proxy.ts and src/app/admin/layout.tsx).
import type { Client } from '@/lib/supabase/types';
import type { AdminProfileRow } from './types';

export async function searchUsers(
  supabase: Client,
  query: string,
  limit = 20
): Promise<AdminProfileRow[]> {
  const { data, error } = await supabase.rpc('admin_search_users', {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AdminProfileRow[];
}

/** `days` null/0 unsuspends; a positive number sets suspended_until that many days out. */
export async function setSuspension(
  supabase: Client,
  userId: string,
  days: number | null
): Promise<AdminProfileRow> {
  const { data, error } = await supabase.rpc('admin_set_suspension', {
    p_user_id: userId,
    p_days: days ?? undefined,
  });
  if (error) throw error;
  return data as unknown as AdminProfileRow;
}
