// The ONLY file in this module that talks to Supabase (D-007).
import type { Client } from '@/lib/supabase/types';
import { ScanQuotaError, type AiScanResult, type ScanCandidate, type ScanKind } from './types';

/**
 * ai-scan v2 (F-03, MV-S3-02): scans an already-uploaded media row server-side. The Edge Function
 * enforces the quota + kill switch and meters the job; we surface a quota block as ScanQuotaError
 * so the caller can route to the paywall. `supabase.functions.invoke` returns a non-2xx body in
 * `data` (not `error`) when the function responds with JSON, so we read the code off `data`.
 */
export async function invokeAiScan(
  supabase: Client,
  mediaId: string,
  kind: ScanKind = 'single'
): Promise<AiScanResult> {
  const { data, error } = await supabase.functions.invoke('ai-scan', {
    body: { media_id: mediaId, kind },
  });
  if (data?.code === 'scan_quota_exhausted') {
    throw new ScanQuotaError(String(data.plan ?? 'free'), String(data.error ?? ''));
  }
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    candidates: (data?.candidates ?? []) as ScanCandidate[],
    quota_remaining: Number(data?.quota_remaining ?? 0),
    job_id: (data?.job_id ?? null) as string | null,
  };
}

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
