// Mini Vault — jobs runner pure helpers (F-26, MV-W04-04, 07 §6.4).
//
// Everything in this file is network-free and side-effect-free so it can be unit-tested with Deno
// offline (see lib.test.ts), same split as ai-scan/lib.ts and stripe-webhook/lib.ts. The HTTP entry
// (secret check against the env, the service-role RPC call) lives in index.ts.
//
// The real scheduler is pg_cron inside the database (migration 0014d `world_jobs`); this function
// is the manual / ops trigger and the fallback when pg_cron is unavailable on the hosted project.
// The job logic itself is SQL (`run_world_job`), so the helpers here only validate the request,
// summarise what the dispatcher returned, and mirror two pieces of window arithmetic (quest reset
// windows, T-14 d expiry batches) so an operator can predict a run before firing it.

/** The dispatcher's job names, in the order `run_world_job('all')` runs them. */
export const JOB_NAMES = [
  'quest_reset',
  'earned_expiry_notice',
  'earned_expiry',
  'season_rollover',
  'score_recompute',
] as const;
export type JobName = (typeof JOB_NAMES)[number];

export interface JobRequest {
  job: JobName | 'all';
  /** ISO instant the jobs reason about; omitted = the database's now(). */
  at: string | null;
}

export type ParseResult = { ok: true; value: JobRequest } | { ok: false; error: string };

/** D-013: validate the request body ({ job?: name | 'all', at?: ISO }) without zod so the helper
 *  stays dependency-free; unknown keys are ignored, an empty body means "all, now". */
export function parseJobRequest(body: unknown): ParseResult {
  if (body === null || body === undefined) return { ok: true, value: { job: 'all', at: null } };
  if (typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;
  const job = b.job === undefined ? 'all' : b.job;
  if (typeof job !== 'string' || !isJobName(job)) {
    return { ok: false, error: `job must be one of ${['all', ...JOB_NAMES].join(', ')}.` };
  }
  let at: string | null = null;
  if (b.at !== undefined && b.at !== null) {
    if (typeof b.at !== 'string' || Number.isNaN(Date.parse(b.at))) {
      return { ok: false, error: 'at must be an ISO-8601 instant.' };
    }
    at = new Date(b.at).toISOString();
  }
  return { ok: true, value: { job, at } };
}

export function isJobName(value: string): value is JobName | 'all' {
  return value === 'all' || (JOB_NAMES as readonly string[]).includes(value);
}

/** Constant-time comparison of the shared secret (header value vs JOBS_SECRET). Length leaks
 *  nothing useful here, but the byte comparison must not short-circuit. */
export function verifySecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Accepts either `x-jobs-secret: <secret>` or `Authorization: Bearer <secret>`. */
export function secretFromHeaders(headers: Headers): string | null {
  const direct = headers.get('x-jobs-secret');
  if (direct) return direct.trim();
  const auth = headers.get('authorization') ?? '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;
}

/** One `job_runs` row as the dispatcher returns it (mirrors 03 §2.42). */
export interface JobRunRow {
  id: number;
  job: string;
  triggered_by: string;
  run_at: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'ok' | 'error';
  result: Record<string, unknown>;
  error: string | null;
}

export interface RunSummary {
  ok: number;
  error: number;
  /** job → status, in run order. */
  jobs: Record<string, 'ok' | 'error' | 'running'>;
  /** The first failing job's message, for the HTTP status / alert line. */
  firstError: string | null;
}

export function summariseRuns(rows: JobRunRow[]): RunSummary {
  const summary: RunSummary = { ok: 0, error: 0, jobs: {}, firstError: null };
  for (const r of rows) {
    summary.jobs[r.job] = r.status;
    if (r.status === 'ok') summary.ok += 1;
    if (r.status === 'error') {
      summary.error += 1;
      if (summary.firstError === null)
        summary.firstError = `${r.job}: ${r.error ?? 'unknown error'}`;
    }
  }
  return summary;
}

// ---------- window arithmetic mirrored from SQL (0014b quest_period_start / 0014d notice) ----------

export type QuestCadence = 'daily' | 'weekly';

/** UTC calendar day of an instant as YYYY-MM-DD (= public.mv_utc_day). */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return utcDay(d);
}

/** The reset window an instant falls in: UTC day for daily, the Monday for weekly, plus which half
 *  of the quest pool that window shows (= public.quest_set_index, epoch Monday 2026-01-05). */
export function resetWindow(
  cadence: QuestCadence,
  at: Date
): { periodStart: string; periodEnd: string; setIndex: 0 | 1 } {
  const day = utcDay(at);
  const epoch = Date.UTC(2026, 0, 5);
  if (cadence === 'daily') {
    const days = Math.round((Date.parse(`${day}T00:00:00Z`) - epoch) / 86_400_000);
    return { periodStart: day, periodEnd: addDays(day, 1), setIndex: mod2(days) };
  }
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(day, -dow);
  const weeks = Math.floor(
    Math.round((Date.parse(`${monday}T00:00:00Z`) - epoch) / 86_400_000) / 7
  );
  return { periodStart: monday, periodEnd: addDays(monday, 7), setIndex: mod2(weeks) };
}

function mod2(n: number): 0 | 1 {
  return (((n % 2) + 2) % 2) as 0 | 1;
}

/** A credit row as the notice job sees it. */
export interface EarnedCreditRow {
  user_id: string;
  created_at: string;
  remaining: number;
  source: string;
  delta: number;
}

export interface ExpiringBatch {
  userId: string;
  /** UTC day the batch expires (created_at + 180 d). */
  expiresOn: string;
  amount: number;
  daysLeft: number;
}

export const EARNED_TTL_DAYS = 180;
export const NOTICE_HORIZON_DAYS = 14;

/** Groups earned credits with something left that expire inside [at, at + 14 d) by (user, expiry
 *  day) — the exact batches `world_job_earned_expiry_notice` notifies, so an operator can preview a
 *  run from a ledger export. Ordered by user then day, like the SQL. */
export function groupExpiringBatches(rows: EarnedCreditRow[], at: Date): ExpiringBatch[] {
  const from = at.getTime();
  const to = from + NOTICE_HORIZON_DAYS * 86_400_000;
  const byKey = new Map<string, ExpiringBatch>();
  for (const r of rows) {
    if (r.delta <= 0 || r.source !== 'earned' || r.remaining <= 0) continue;
    const expiresAt = Date.parse(r.created_at) + EARNED_TTL_DAYS * 86_400_000;
    if (Number.isNaN(expiresAt) || expiresAt < from || expiresAt >= to) continue;
    const expiresOn = utcDay(new Date(expiresAt));
    const key = `${r.user_id}|${expiresOn}`;
    const existing = byKey.get(key);
    if (existing) existing.amount += r.remaining;
    else {
      byKey.set(key, {
        userId: r.user_id,
        expiresOn,
        amount: r.remaining,
        daysLeft: Math.round(
          (Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${utcDay(at)}T00:00:00Z`)) /
            86_400_000
        ),
      });
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.userId === b.userId
      ? a.expiresOn.localeCompare(b.expiresOn)
      : a.userId.localeCompare(b.userId)
  );
}
