// AI scan service (F-03). The screen uses the metered `ai-scan` function only (MV-S11-04); the
// Phase-1 base64 `scan-photo` path is gone.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { ScanQuotaError, ScanUnavailableError } from './types';
import type { AiScanResult, ScanCandidate, ScanKind } from './types';

/** Scan an already-uploaded media row with the metered `ai-scan` Edge Function (F-03): quota,
 *  kill switch and cost log all live there. Throws ScanQuotaError / ScanUnavailableError. */
export async function scanMedia(
  supabase: Client,
  mediaId: string,
  kind: ScanKind = 'single'
): Promise<AiScanResult> {
  return repo.invokeAiScan(supabase, mediaId, kind);
}

export const recordScanAccepted = repo.recordScanAccepted;

/** Pure: what the scan screen says for each way a scan can fail. Never raw infrastructure text. */
export function scanErrorMessage(err: unknown): string {
  if (err instanceof ScanQuotaError) {
    return 'You’ve used your scans for now. Add this car by hand — your scans come back within 30 days.';
  }
  if (err instanceof ScanUnavailableError) {
    return 'Photo scanning is switched off right now. Add the car by hand instead.';
  }
  return 'We couldn’t scan this photo right now. Please try again in a little while.';
}

export type { AiScanResult, ScanCandidate, ScanKind };
export { ScanQuotaError, ScanUnavailableError } from './types';

export { listRecentScanJobs, scanCostThisMonth } from './repo';
