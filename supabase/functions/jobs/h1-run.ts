// Mini Vault — H1 housekeeping jobs: runtime (MV-S9-01, F-19, D-080, D-095).
//
// Runs the H1 track of the `jobs` Edge Function with the service role:
//   1. the SQL jobs through `run_h1_job` (one RPC; each job logs its own job_runs row),
//   2. purge_media  — `h1_purge_media_batch` → Storage remove() per bucket → `h1_purge_media_done`,
//      batch after batch until the table is clean (or MAX_BATCHES, so a stuck bucket can't spin),
//   3. purge_accounts — `h1_purge_accounts_batch` (anonymised ≥ grace days ago) → Auth admin
//      deleteUser → `h1_purge_account_done` (purged_at + `user.purged`),
//   4. `job_runs_recent_errors` over both tracks, so the caller (the daily GitHub Actions workflow)
//      can alert on anything that failed in the last 24 h, pg_cron runs included.
// Each Edge job records exactly one job_runs row through `record_job_run`, ok or error, and an error
// in one job never stops the next (same contract as the SQL dispatchers).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { summariseRuns, type JobRunRow } from './lib.ts';
import {
  alertLine,
  edgeJobsFor,
  groupByBucket,
  sqlJobFor,
  type H1EdgeJob,
  type H1JobRequest,
  type MediaPurgeRow,
  type RecentErrorRow,
} from './h1.ts';

const MAX_BATCHES = 50;

export interface H1Response {
  track: 'h1';
  runs: JobRunRow[];
  summary: ReturnType<typeof summariseRuns>;
  recent_errors: RecentErrorRow[];
  alert: string | null;
}

export async function runH1(
  admin: SupabaseClient,
  req: H1JobRequest
): Promise<{ status: number; body: H1Response | { error: string; detail?: string } }> {
  const runs: JobRunRow[] = [];

  const sqlJob = sqlJobFor(req.job);
  if (sqlJob) {
    const args: Record<string, unknown> = { p_job: sqlJob, p_source: 'edge' };
    if (req.at) args.p_at = req.at;
    const { data, error } = await admin.rpc('run_h1_job', args);
    if (error) {
      console.error('run_h1_job failed', error);
      return { status: 500, body: { error: 'Job dispatch failed.', detail: error.message } };
    }
    runs.push(...((data ?? []) as JobRunRow[]));
  }

  for (const job of edgeJobsFor(req.job)) {
    runs.push(await runEdgeJob(admin, job, req));
  }

  const { data: errs, error: errErr } = await admin.rpc('job_runs_recent_errors', {
    p_since: '24 hours',
  });
  if (errErr) console.error('job_runs_recent_errors failed', errErr);
  const recent = (errs ?? []) as RecentErrorRow[];
  const summary = summariseRuns(runs);
  const body: H1Response = {
    track: 'h1',
    runs,
    summary,
    recent_errors: recent,
    alert: alertLine(recent),
  };
  return { status: summary.error > 0 || recent.length > 0 ? 207 : 200, body };
}

async function runEdgeJob(
  admin: SupabaseClient,
  job: H1EdgeJob,
  req: H1JobRequest
): Promise<JobRunRow> {
  const startedAt = new Date().toISOString();
  const runAt = req.at ?? startedAt;
  let result: Record<string, unknown> = {};
  let error: string | null = null;
  try {
    result =
      job === 'purge_media' ? await purgeMedia(admin, req.limit) : await purgeAccounts(admin, req);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error(`${job} failed`, e);
  }
  const { data, error: logErr } = await admin.rpc('record_job_run', {
    p_job: job,
    p_status: error ? 'error' : 'ok',
    p_result: result,
    p_error: error,
    p_started_at: startedAt,
    p_run_at: runAt,
    p_source: 'edge',
  });
  if (logErr || !data) {
    console.error('record_job_run failed', logErr);
    // Still report the run to the caller even when the log write failed.
    return {
      id: -1,
      job,
      triggered_by: 'edge',
      run_at: runAt,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: error ? 'error' : 'ok',
      result: { ...result, log_error: logErr?.message ?? 'no row returned' },
      error,
    };
  }
  return data as JobRunRow;
}

/** media rows with status `removed` → storage objects deleted → rows deleted. Batched. */
async function purgeMedia(admin: SupabaseClient, limit: number): Promise<Record<string, unknown>> {
  let objects = 0;
  let rows = 0;
  let batches = 0;
  const failedBuckets: string[] = [];
  while (batches < MAX_BATCHES) {
    const { data, error } = await admin.rpc('h1_purge_media_batch', { p_limit: limit });
    if (error) throw new Error(`h1_purge_media_batch: ${error.message}`);
    const batch = (data ?? []) as MediaPurgeRow[];
    if (batch.length === 0) break;
    batches += 1;
    const doneIds: string[] = [];
    for (const g of groupByBucket(batch)) {
      const { error: rmErr } = await admin.storage.from(g.bucket).remove(g.paths);
      if (rmErr) {
        // Leave these rows for the next run; a missing object is not an error for Storage, so
        // this is a real failure (bucket gone, permissions) worth surfacing.
        console.error(`storage remove failed for bucket ${g.bucket}`, rmErr);
        if (!failedBuckets.includes(g.bucket)) failedBuckets.push(g.bucket);
        continue;
      }
      objects += g.paths.length;
      doneIds.push(...g.ids);
    }
    // Rows without a bucket/path (defensive) are unrecoverable garbage: drop them too.
    for (const r of batch)
      if ((!r.bucket || !r.path) && !doneIds.includes(r.id)) doneIds.push(r.id);
    if (doneIds.length === 0) break; // nothing progressed → stop, the error is in the result
    const { data: n, error: doneErr } = await admin.rpc('h1_purge_media_done', { p_ids: doneIds });
    if (doneErr) throw new Error(`h1_purge_media_done: ${doneErr.message}`);
    rows += typeof n === 'number' ? n : 0;
    if (batch.length < limit) break;
  }
  const result: Record<string, unknown> = { objects, rows, batches };
  if (failedBuckets.length > 0) {
    result.failed_buckets = failedBuckets;
    throw Object.assign(new Error(`storage remove failed for: ${failedBuckets.join(', ')}`), {
      result,
    });
  }
  return result;
}

/** profiles anonymised by delete_account() ≥ grace days ago → auth.users row deleted → purged_at. */
async function purgeAccounts(
  admin: SupabaseClient,
  req: H1JobRequest
): Promise<Record<string, unknown>> {
  const args: Record<string, unknown> = {
    p_grace_days: req.graceDays,
    p_limit: Math.min(req.limit, 500),
  };
  if (req.at) args.p_at = req.at;
  const { data, error } = await admin.rpc('h1_purge_accounts_batch', args);
  if (error) throw new Error(`h1_purge_accounts_batch: ${error.message}`);
  const due = (data ?? []) as Array<{ id: string; deleted_at: string }>;
  let purged = 0;
  const failed: string[] = [];
  for (const u of due) {
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    // "User not found" = the auth row is already gone (a previous run died between the two
    // steps): the profile still needs its purged_at, so fall through.
    if (delErr && !/not found/i.test(delErr.message)) {
      console.error(`auth deleteUser failed for ${u.id}`, delErr);
      failed.push(u.id);
      continue;
    }
    const { error: doneErr } = await admin.rpc('h1_purge_account_done', { p_user: u.id });
    if (doneErr) {
      console.error(`h1_purge_account_done failed for ${u.id}`, doneErr);
      failed.push(u.id);
      continue;
    }
    purged += 1;
  }
  const result: Record<string, unknown> = { due: due.length, purged, grace_days: req.graceDays };
  if (failed.length > 0) {
    result.failed = failed.length;
    throw new Error(`${failed.length} account purge(s) failed; see function logs`);
  }
  return result;
}
