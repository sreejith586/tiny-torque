import { describe, it, expect } from 'vitest';
import { scanMedia, ScanQuotaError } from './service';
import type { Client } from '@/lib/supabase/types';

/** Minimal stub: scanMedia only reaches supabase.functions.invoke. */
function clientReturning(result: { data?: unknown; error?: unknown }): Client {
  return {
    functions: { invoke: async () => result },
  } as unknown as Client;
}

describe('scanMedia (MV-S3-02)', () => {
  it('shapes a successful scan payload', async () => {
    const client = clientReturning({
      data: {
        candidates: [{ brand: 'Hot Wheels', confidence: 0.9 }],
        quota_remaining: 8,
        job_id: 'job-1',
      },
    });
    const out = await scanMedia(client, '11111111-1111-1111-1111-111111111111');
    expect(out.candidates).toHaveLength(1);
    expect(out.quota_remaining).toBe(8);
    expect(out.job_id).toBe('job-1');
  });

  it('defaults a sparse payload rather than throwing', async () => {
    const out = await scanMedia(clientReturning({ data: {} }), 'm1');
    expect(out.candidates).toEqual([]);
    expect(out.quota_remaining).toBe(0);
    expect(out.job_id).toBeNull();
  });

  it('throws ScanQuotaError (with plan) when the function reports quota exhausted', async () => {
    const client = clientReturning({
      data: { code: 'scan_quota_exhausted', plan: 'free', error: 'out of scans' },
    });
    await expect(scanMedia(client, 'm1')).rejects.toBeInstanceOf(ScanQuotaError);
    await expect(scanMedia(client, 'm1')).rejects.toMatchObject({
      plan: 'free',
      code: 'scan_quota_exhausted',
    });
  });

  it('propagates a transport error', async () => {
    const client = clientReturning({ error: new Error('network down') });
    await expect(scanMedia(client, 'm1')).rejects.toThrow('network down');
  });

  it('propagates a function-level error body', async () => {
    const client = clientReturning({ data: { error: 'Photo not found.' } });
    await expect(scanMedia(client, 'm1')).rejects.toThrow('Photo not found.');
  });
});
