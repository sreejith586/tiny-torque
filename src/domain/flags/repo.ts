// The ONLY file in this module that talks to Supabase (D-007).
import type { Client, Json } from '@/lib/supabase/types';
import type { FlagAdminRow, FlagAudience, FlagRow } from './types';

export async function listFlags(supabase: Client): Promise<FlagRow[]> {
  const { data, error } = await supabase.from('feature_flags').select('key, enabled, audience');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    key: row.key,
    enabled: row.enabled,
    audience: (row.audience ?? {}) as FlagAudience,
  }));
}

export async function listFlagsForAdmin(supabase: Client): Promise<FlagAdminRow[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, enabled, audience, description, updated_at, updated_by')
    .order('key');
  if (error) throw error;
  const rows = data ?? [];
  // Audit line (MV-S10-04): who last saved each flag — handles via public_profiles, best effort.
  const ids = [...new Set(rows.map((r) => r.updated_by).filter((id): id is string => !!id))];
  const handles = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: people } = await supabase
      .from('public_profiles')
      .select('id, handle')
      .in('id', ids);
    for (const p of people ?? []) if (p.id) handles.set(p.id, p.handle);
  }
  return rows.map((row) => ({
    key: row.key,
    enabled: row.enabled,
    audience: (row.audience ?? {}) as FlagAudience,
    description: row.description,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    updated_by_handle: row.updated_by ? (handles.get(row.updated_by) ?? null) : null,
  }));
}

/** Admin-only by RLS ("Admins update feature flags", identity_v2) — a non-admin update affects 0
 *  rows, which `.single()` turns into an error rather than a silent no-op. */
export async function updateFlag(
  supabase: Client,
  adminId: string,
  key: string,
  patch: { enabled: boolean; audience: FlagAudience }
): Promise<FlagAdminRow> {
  const { data, error } = await supabase
    .from('feature_flags')
    .update({
      enabled: patch.enabled,
      audience: patch.audience as NonNullable<Json>,
      updated_by: adminId,
    })
    .eq('key', key)
    .select('key, enabled, audience, description, updated_at')
    .single();
  if (error) throw error;
  return { ...data, audience: (data.audience ?? {}) as FlagAudience };
}
