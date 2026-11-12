// Mini Vault — jobs Edge Function (F-26, MV-W04-04, 07 §6.4, D-071).
//
// Deploy:  supabase functions deploy jobs --no-verify-jwt
//   (--no-verify-jwt: callers are pg_cron's HTTP fallback, a GitHub Action or an operator's curl,
//   none of which carries a Supabase user JWT — the shared secret below is the auth check.)
// Secrets (set once):
//   supabase secrets set JOBS_SECRET=<long random string>      (also in .env.example)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// Call:
//   curl -X POST https://<ref>.functions.supabase.co/jobs -H "x-jobs-secret: $JOBS_SECRET" \
//        -H "content-type: application/json" -d '{"job":"all"}'
//   body: { job?: 'all' | 'quest_reset' | 'earned_expiry_notice' | 'earned_expiry' |
//                 'season_rollover' | 'score_recompute' |
//                 'meetup_transitions' | 'meetup_reminders' (0015, → run_meetup_jobs), at?: ISO instant }
//   H1 track (MV-S9-01, h1.ts / h1-run.ts): { track: 'h1', job?: 'all' | 'expire_listings' |
//     'expire_offers' | 'purge_trash' | 'ensure_event_partitions' | 'purge_media' | 'purge_accounts',
//     at?, grace_days?, limit? } → run_h1_job + the Storage / Auth purges; 207 also when any run of
//     either track failed in the last 24 h (the daily h1-jobs.yml workflow alerts on that).
//
// Flow: verify the secret (constant-time) -> validate the body (lib.ts) -> call the SECURITY
// DEFINER dispatcher `run_world_job` with the service role (the only role besides a direct
// database session it admits) -> return the job_runs rows it wrote plus a summary. The job logic
// is entirely in SQL (migration 0014d), so this function stays a thin trigger: pg_cron runs the same
// dispatcher on its schedules; this is the manual / ops path and the fallback if pg_cron is off.
// HTTP 200 when every job ran ok, 207 when at least one job recorded an error (its row says why),
// 401 for a bad secret, 400 for a bad body, 500 when the RPC itself could not be reached.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  parseJobRequest,
  secretFromHeaders,
  summariseRuns,
  verifySecret,
  type JobRunRow,
} from './lib.ts';
import { dispatcherFor } from './meetups.ts';
import { isH1Request, parseH1JobRequest } from './h1.ts';
import { runH1 } from './h1-run.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const JOBS_SECRET = Deno.env.get('JOBS_SECRET');
  if (!SUPABASE_URL || !SERVICE_KEY)
    return json({ error: 'Server is misconfigured (missing Supabase env).' }, 500);
  if (!JOBS_SECRET) return json({ error: 'Server is missing JOBS_SECRET.' }, 500);

  if (!verifySecret(secretFromHeaders(req.headers), JOBS_SECRET))
    return json({ error: 'Not authorised.' }, 401);

  let raw: unknown = null;
  const text = await req.text();
  if (text.trim().length > 0) {
    try {
      raw = JSON.parse(text);
    } catch {
      return json({ error: 'Invalid request.', detail: 'Body is not JSON.' }, 400);
    }
  }
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // H1 housekeeping track (MV-S9-01) — its own parser / runner so both tracks evolve apart.
  if (isH1Request(raw)) {
    const h1 = parseH1JobRequest(raw);
    if (!h1.ok) return json({ error: 'Invalid request.', detail: h1.error }, 400);
    const out = await runH1(admin, h1.value);
    return json(out.body, out.status);
  }

  const parsed = parseJobRequest(raw);
  if (!parsed.ok) return json({ error: 'Invalid request.', detail: parsed.error }, 400);
  const args: Record<string, unknown> = { p_job: parsed.value.job, p_source: 'edge' };
  if (parsed.value.at) args.p_at = parsed.value.at;
  const dispatcher = dispatcherFor(parsed.value.job);
  const { data, error } = await admin.rpc(dispatcher, args);
  if (error) {
    console.error(`${dispatcher} failed`, error);
    return json({ error: 'Job dispatch failed.', detail: error.message }, 500);
  }
  const runs = (data ?? []) as JobRunRow[];
  const summary = summariseRuns(runs);
  return json({ runs, summary }, summary.error > 0 ? 207 : 200);
});
