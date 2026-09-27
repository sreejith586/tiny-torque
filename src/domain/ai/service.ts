// AI scan service (Phase-1 shape; v2 with quotas/metering lands in S3 — F-03).
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import type { ScanCandidate } from './types';

export async function scanPhotoForCars(supabase: Client, file: File): Promise<ScanCandidate[]> {
  const base64 = await fileToBase64(file);
  return repo.invokeScanPhoto(supabase, base64, file.type || 'image/jpeg');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export type { ScanCandidate };
