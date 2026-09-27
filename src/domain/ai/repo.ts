// The ONLY file in this module that talks to Supabase (D-007).
import type { Client } from '@/lib/supabase/types';
import type { ScanCandidate } from './types';

export async function invokeScanPhoto(supabase: Client, base64: string, mediaType: string): Promise<ScanCandidate[]> {
  const { data, error } = await supabase.functions.invoke('scan-photo', { body: { image: base64, mediaType } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return (data?.candidates ?? []) as ScanCandidate[];
}
