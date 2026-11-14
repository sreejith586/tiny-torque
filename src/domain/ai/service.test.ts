import { describe, it, expect } from 'vitest';
import {
  recordScanAccepted,
  scanErrorMessage,
  scanMedia,
  ScanQuotaError,
  ScanUnavailableError,
} from './service';
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

describe('scan failures the screen must explain (MV-S11-04)', () => {
  /** supabase-js ≥ 2.4x: a non-2xx function answer is `error` with the Response in `context`. */
  function httpError(body: unknown): Client {
    return {
      functions: {
        invoke: async () => ({
          data: null,
          error: {
            message: 'Edge Function returned a non-2xx status code',
            context: { json: async () => body },
          },
        }),
      },
    } as unknown as Client;
  }

  it('reads a 402 quota body out of error.context', async () => {
    const c = httpError({ code: 'scan_quota_exhausted', plan: 'free', error: 'out' });
    await expect(scanMedia(c, 'm1')).rejects.toBeInstanceOf(ScanQuotaError);
  });

  it('reads a 503 kill-switch body out of error.context', async () => {
    const c = httpError({ code: 'feature_disabled', error: 'AI scan is currently unavailable.' });
    await expect(scanMedia(c, 'm1', 'group')).rejects.toBeInstanceOf(ScanUnavailableError);
  });

  it('still throws the transport error when the body is not JSON', async () => {
    const c = {
      functions: {
        invoke: async () => ({
          data: null,
          error: { message: 'boom', context: { json: async () => Promise.reject(new Error('x')) } },
        }),
      },
    } as unknown as Client;
    await expect(scanMedia(c, 'm1')).rejects.toMatchObject({ message: 'boom' });
  });

  it('has plain words for each failure, never raw error text', () => {
    expect(scanErrorMessage(new ScanQuotaError('free'))).toMatch(/used your scans/);
    expect(scanErrorMessage(new ScanUnavailableError())).toMatch(/switched off/);
    expect(scanErrorMessage(new Error('TypeError: fetch failed at x.ts:1'))).toMatch(/try again/);
  });

  it('records accepted candidates through the RPC', async () => {
    const calls: unknown[] = [];
    const c = {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return { data: 3, error: null };
      },
    } as unknown as Client;
    expect(await recordScanAccepted(c, 'job-1', 3)).toBe(3);
    expect(calls[0]).toEqual(['record_scan_accepted', { p_job: 'job-1', p_count: 3 }]);
  });
});
