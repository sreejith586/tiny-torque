// The ONLY file in this module that talks to Supabase (D-007).
import type { Client } from '@/lib/supabase/types';
import {
  ScanQuotaError,
  ScanUnavailableError,
  type AiScanResult,
  type ScanCandidate,
  type ScanKind,
} from './types';

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
  // A non-2xx answer (402 quota, 503 kill switch) arrives as `error` with the Response in
  // `error.context` on current supabase-js, or as `data` on older builds — read both.
  let payload: Record<string, unknown> | null = (data ?? null) as Record<string, unknown> | null;
  if (error && !payload) {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        payload = (await ctx.json()) as Record<string, unknown>;
      } catch {
        payload = null;
      }
    }
  }
  if (payload?.code === 'scan_quota_exhausted') {
    throw new ScanQuotaError(String(payload.plan ?? 'free'), String(payload.error ?? ''));
  }
  if (payload?.code === 'feature_disabled') {
    throw new ScanUnavailableError(String(payload.error ?? ''));
  }
  if (error) throw error;
  if (payload?.error) throw new Error(String(payload.error));
  return {
    candidates: (payload?.candidates ?? []) as ScanCandidate[],
    quota_remaining: Number(payload?.quota_remaining ?? 0),
    job_id: (payload?.job_id ?? null) as string | null,
  };
}

/** Tell the job how many of its candidates were saved (KPI: scan share / acceptance; logs
 *  scan.accepted). Definer RPC, caller's own finished job only. */
export async function recordScanAccepted(
  supabase: Client,
  jobId: string,
  count: number
): Promise<number> {
  const { data, error } = await supabase.rpc('record_scan_accepted', {
    p_job: jobId,
    p_count: count,
  });
  if (error) throw error;
  return data ?? 0;
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
