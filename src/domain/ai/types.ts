export interface ScanCandidate {
  brand: string;
  model: string | null;
  variant: string | null;
  series: string | null;
  scale: string | null;
  confidence: number; // 0-1
  notes: string | null;
}

export type ScanKind = 'single' | 'group';

/** Result of the ai-scan v2 Edge Function (F-03). */
export interface AiScanResult {
  candidates: ScanCandidate[];
  quota_remaining: number;
  job_id: string | null;
}

/** Thrown when the scan is blocked by quota so the UI can show the paywall (F-03, S3-06). */
export class ScanQuotaError extends Error {
  readonly code = 'scan_quota_exhausted';
  readonly plan: string;
  constructor(plan: string, message = 'You have used all your scans for this period.') {
    super(message);
    this.name = 'ScanQuotaError';
    this.plan = plan;
  }
}
