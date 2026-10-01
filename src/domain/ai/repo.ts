// The ONLY file in this module that talks to Supabase (D-007).
import type { Client } from '@/lib/supabase/types';
import type { ScanCandidate } from './types';

export async function invokeScanPhoto(
  supabase: Client,
  base64: string,
  mediaType: string
): Promise<ScanCandidate[]> {
  const { data, error } = await supabase.functions.invoke('scan-photo', {
    body: { image: base64, mediaType },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return (data?.candidates ?? []) as ScanCandidate[];
}

export async function listRecentScanJobs(supabase: Client, limit = 100) {
  const { data, error } = await supabase
    .from('ai_scan_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function scanCostThisMonth(supabase: Client): Promise<number> {
  const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data, error } = await supabase
    .from('ai_scan_jobs')
    .select('cost_usd')
    .gte('created_at', since);
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
}
