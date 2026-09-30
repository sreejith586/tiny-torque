// The ONLY file in this module that talks to Supabase (D-007).
import type { Client } from '@/lib/supabase/types';
import type { FlagAudience, FlagRow } from './types';

export async function listFlags(supabase: Client): Promise<FlagRow[]> {
  const { data, error } = await supabase.from('feature_flags').select('key, enabled, audience');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    key: row.key,
    enabled: row.enabled,
    audience: (row.audience ?? {}) as FlagAudience,
  }));
}
