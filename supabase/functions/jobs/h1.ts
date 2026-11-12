// Mini Vault — H1 housekeeping jobs: pure helpers (MV-S9-01, F-19, 03 §3, D-080, D-095).
//
// Kept apart from lib.ts (the World track's helpers) on purpose: both tracks extend the `jobs`
// function in parallel, so each owns its own file and index.ts only routes between them. Nothing
// here touches the network; h1-run.ts is the runtime (RPCs, Storage, Auth admin), h1.test.ts the
// offline Deno tests.
//
// Request shape (index.ts routes a body with `track: 'h1'` here):
//   { track: 'h1', job?: 'all' | <H1 job>, at?: ISO instant, grace_days?: int, limit?: int }
// SQL jobs run through the SECURITY DEFINER dispatcher `run_h1_job` (migration 0011); the two
// purge jobs run in this function because they need the Storage / Auth admin APIs, and log through
// `record_job_run`. 'all' = the SQL jobs first (one RPC), then purge_media, then purge_accounts.

/** The SQL dispatcher's jobs, in the order `run_h1_job('all')` runs them. */
export const H1_SQL_JOBS = [
  'expire_listings',
  'expire_offers',
  'purge_trash',
  'ensure_event_partitions',
] as const;
/** The jobs that run inside this Edge Function (Storage + Auth admin APIs). */
export const H1_EDGE_JOBS = ['purge_media', 'purge_accounts'] as const;
export const H1_JOB_NAMES = [...H1_SQL_JOBS, ...H1_EDGE_JOBS] as const;
export type H1SqlJob = (typeof H1_SQL_JOBS)[number];
export type H1EdgeJob = (typeof H1_EDGE_JOBS)[number];
export type H1JobName = (typeof H1_JOB_NAMES)[number];

export const DEFAULT_GRACE_DAYS = 7; // delete_account() → auth.users purge (D-080 follow-up)
export const DEFAULT_BATCH_LIMIT = 200; // media objects per Storage remove() batch
export const MAX_BATCH_LIMIT = 1000;

export interface H1JobRequest {
  job: H1JobName | 'all';
  /** ISO instant the SQL jobs reason about; omitted = the database's now(). */
  at: string | null;
  graceDays: number;
  limit: number;
}

export type H1ParseResult = { ok: true; value: H1JobRequest } | { ok: false; error: string };

/** True when the body asks for the H1 track (`track: 'h1'`) or names an H1 job. */
export function isH1Request(body: unknown): boolean {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  if (b.track === 'h1') return true;
  return typeof b.job === 'string' && (H1_JOB_NAMES as readonly string[]).includes(b.job);
}

/** D-013: validate an H1 request body without zod (dependency-free Edge helper). */
export function parseH1JobRequest(body: unknown): H1ParseResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;
  const job = b.job === undefined ? 'all' : b.job;
  if (typeof job !== 'string' || !isH1JobName(job)) {
    return { ok: false, error: `job must be one of ${['all', ...H1_JOB_NAMES].join(', ')}.` };
  }
  let at: string | null = null;
  if (b.at !== undefined && b.at !== null) {
    if (typeof b.at !== 'string' || Number.isNaN(Date.parse(b.at))) {
      return { ok: false, error: 'at must be an ISO-8601 instant.' };
    }
    at = new Date(b.at).toISOString();
  }
  const graceDays = intOr(b.grace_days, DEFAULT_GRACE_DAYS, 0, 365);
  if (graceDays === null) return { ok: false, error: 'grace_days must be an integer 0–365.' };
  const limit = intOr(b.limit, DEFAULT_BATCH_LIMIT, 1, MAX_BATCH_LIMIT);
  if (limit === null) return { ok: false, error: `limit must be an integer 1–${MAX_BATCH_LIMIT}.` };
  return { ok: true, value: { job, at, graceDays, limit } };
}

function intOr(v: unknown, dflt: number, min: number, max: number): number | null {
  if (v === undefined || v === null) return dflt;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return null;
  return v;
}

export function isH1JobName(value: string): value is H1JobName | 'all' {
  return value === 'all' || (H1_JOB_NAMES as readonly string[]).includes(value);
}

/** Which SQL job name to hand `run_h1_job` for a request (null = no SQL job in this request). */
export function sqlJobFor(job: H1JobName | 'all'): H1SqlJob | 'all' | null {
  if (job === 'all') return 'all';
  return (H1_SQL_JOBS as readonly string[]).includes(job) ? (job as H1SqlJob) : null;
}

/** Which Edge jobs a request runs, in order. */
export function edgeJobsFor(job: H1JobName | 'all'): H1EdgeJob[] {
  if (job === 'all') return [...H1_EDGE_JOBS];
  return (H1_EDGE_JOBS as readonly string[]).includes(job) ? [job as H1EdgeJob] : [];
}

/** One `h1_purge_media_batch` row. */
export interface MediaPurgeRow {
  id: string;
  bucket: string;
  path: string;
}

/** Storage's remove() is per bucket: group a batch by bucket, keeping row order and ids. */
export function groupByBucket(
  rows: MediaPurgeRow[]
): Array<{ bucket: string; paths: string[]; ids: string[] }> {
  const groups = new Map<string, { bucket: string; paths: string[]; ids: string[] }>();
  for (const r of rows) {
    if (!r.bucket || !r.path) continue;
    const g = groups.get(r.bucket) ?? { bucket: r.bucket, paths: [], ids: [] };
    g.paths.push(r.path);
    g.ids.push(r.id);
    groups.set(r.bucket, g);
  }
  return [...groups.values()];
}

/** A failed run in the alert window, as `job_runs_recent_errors` returns it. */
export interface RecentErrorRow {
  job: string;
  status: string;
  error: string | null;
  started_at: string;
}

/** The one-line alert body the daily workflow prints / posts when something failed. */
export function alertLine(errors: RecentErrorRow[]): string | null {
  if (errors.length === 0) return null;
  const jobs = [...new Set(errors.map((e) => e.job))].sort();
  const first = errors[0];
  return `${errors.length} failed job run(s) in the last 24 h [${jobs.join(', ')}]; latest: ${first.job} @ ${first.started_at} — ${first.error ?? 'unknown error'}`;
}
