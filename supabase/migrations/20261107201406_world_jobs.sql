-- 0014d_world_jobs — MV-W04-04 (jobs runner), F-26, 07 §6.4 (scheduled jobs) / §3.2–§3.3, D-070
-- (earned credits expire after 180 d WITH NOTICE), D-071 (server authority), D-009 (every job
-- emits events), 02 §blueprint ("Edge Function jobs for app-level jobs, pg_cron for DB-only jobs").
--
-- Everything the World economy needs to happen on a clock, in one SECURITY DEFINER dispatcher:
--   quest_reset           → `quest.reset` once per daily / weekly window (progress rows are per
--                           period already — 0014 — so "reset" = announcing the new window)
--   earned_expiry_notice  → T-14 d notice: one `tokens.expiring_soon` event + one notification per
--                           (user, expiry day) batch of earned credits, never twice for a batch
--   earned_expiry         → expire_earned_tokens() (0014b)
--   season_rollover       → rollover_season(p_at) (0014c)
--   score_recompute       → world_recompute_all_scores() (0014c)
-- Each run writes one `job_runs` row; a failing job records its error and the next job still runs.
-- Scheduling = pg_cron (same file, guarded so a Postgres without pg_cron — CI's plain image — still
-- applies this migration), with the Edge Function `jobs` as the manual / ops trigger and the fallback
-- when pg_cron is unavailable on the hosted project. Ships dark: while `world_earn` is OFF nobody
-- earns, so expiry / notice / quest windows have nothing to act on; seasons only announce themselves.
--
-- `job_runs` is deliberately generic (job name + timing + status + jsonb result) so MV-S9-01's
-- listing / offer expiry and partition jobs reuse it instead of adding a second log.

-- ---------- job_runs (new, §2.42) ----------
create table public.job_runs (
  id           bigint generated always as identity primary key,
  job          text not null check (job ~ '^[a-z][a-z0-9_]{1,59}$'),
  triggered_by text not null default 'cron' check (triggered_by in ('cron', 'edge', 'manual')),
  run_at       timestamptz not null,                             -- the instant the job reasoned about (p_at)
  started_at   timestamptz not null default clock_timestamp(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running', 'ok', 'error')),
  result       jsonb not null default '{}'::jsonb,
  error        text
);
create index job_runs_job_started_idx on public.job_runs (job, started_at desc);
create index job_runs_started_idx on public.job_runs (started_at desc);
alter table public.job_runs enable row level security;
create policy "Admins read job runs" on public.job_runs for select using (public.is_admin());
grant select on public.job_runs to authenticated;
-- No write policies: run_world_job() (definer) is the only writer.

-- ---------- notification kind for the T-14 d notice (§2.20) ----------
-- Added here and only USED at job time (plpgsql resolves the literal on execution), same shape as
-- 0013b's four World kinds. Text + deep link live in src/domain/notifications/service.ts.
alter type public.notification_type add value if not exists 'tokens_expiring';

-- ---------- quest_reset ----------
-- Emits `quest.reset` once per (cadence, period) — the window the dispatcher's p_at falls into —
-- with the quests on offer and the previous window's completion stats. Idempotent by looking for
-- the event itself (one row per day / week, cheap on the type index). Backend only.
create or replace function public.world_job_quest_reset(p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cadence  public.quest_cadence;
  v_period   date;
  v_prev     date;
  v_keys     text[];
  v_rows     integer;
  v_done     integer;
  v_emitted  integer := 0;
  v_skipped  integer := 0;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  foreach v_cadence in array enum_range(null::public.quest_cadence) loop
    v_period := public.quest_period_start(v_cadence, p_at);
    if exists (
      select 1 from public.domain_events
      where type = 'quest.reset' and entity = 'quest'
        and payload ->> 'cadence' = v_cadence::text
        and payload ->> 'period_start' = v_period::text
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    select coalesce(array_agg(q.key order by q.sort_order), '{}'::text[]) into v_keys
      from public.current_quests(p_at) q where q.cadence = v_cadence;
    v_prev := case v_cadence when 'daily' then v_period - 1 else v_period - 7 end;
    select count(*), count(qp.completed_at) into v_rows, v_done
      from public.quest_progress qp join public.quests q on q.key = qp.quest_key
      where q.cadence = v_cadence and qp.period_start = v_prev;
    perform public.emit_event(null, 'quest.reset', 'quest', null, jsonb_build_object(
      'cadence', v_cadence, 'period_start', v_period,
      'period_end', public.quest_period_end(v_cadence, v_period),
      'quests', to_jsonb(v_keys),
      'previous_period_start', v_prev, 'previous_rows', v_rows, 'previous_completed', v_done));
    v_emitted := v_emitted + 1;
  end loop;
  return jsonb_build_object('emitted', v_emitted, 'skipped', v_skipped, 'day', public.mv_utc_day(p_at));
end; $$;
revoke execute on function public.world_job_quest_reset(timestamptz) from public, anon, authenticated;
grant execute on function public.world_job_quest_reset(timestamptz) to service_role;

-- ---------- earned_expiry_notice (T-14 d, D-070 "with notice") ----------
-- A batch = one user's earned credits (source = earned, remaining > 0) that expire on the same UTC
-- day (created_at + 180 d — the same arithmetic expire_earned_tokens() uses), where that day lies
-- within [p_at, p_at + 14 d). Per batch: one `tokens.expiring_soon` event (actor = the user,
-- entity = profile) and one `tokens_expiring` notification. Idempotent: a batch that already has
-- its event (same user + same expires_on) is skipped, so a daily run notifies each batch exactly
-- once, 14 days (or, for credits that are already closer, as many days as remain) before it goes.
create or replace function public.world_job_earned_expiry_notice(p_at timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b          record;
  v_notified integer := 0;
  v_users    integer := 0;
  v_amount   integer := 0;
  v_last     uuid;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  for b in
    select l.user_id,
           public.mv_utc_day(l.created_at + interval '180 days') as expires_on,
           sum(l.remaining)::integer as amount
    from public.token_ledger l
    where l.delta > 0 and l.source = 'earned' and l.remaining > 0
      and l.created_at + interval '180 days' >= p_at
      and l.created_at + interval '180 days' <  p_at + interval '14 days'
    group by l.user_id, public.mv_utc_day(l.created_at + interval '180 days')
    order by l.user_id, 2
  loop
    if exists (
      select 1 from public.domain_events
      where type = 'tokens.expiring_soon' and entity = 'profile' and entity_id = b.user_id
        and payload ->> 'expires_on' = b.expires_on::text
    ) then continue; end if;
    perform public.emit_event(b.user_id, 'tokens.expiring_soon', 'profile', b.user_id,
      jsonb_build_object('amount', b.amount, 'expires_on', b.expires_on,
                         'days_left', b.expires_on - public.mv_utc_day(p_at)));
    insert into public.notifications (user_id, type, payload)
      values (b.user_id, 'tokens_expiring', jsonb_build_object('amount', b.amount, 'expires_on', b.expires_on));
    v_notified := v_notified + 1;
    v_amount := v_amount + b.amount;
    if v_last is distinct from b.user_id then v_users := v_users + 1; v_last := b.user_id; end if;
  end loop;
  return jsonb_build_object('notified', v_notified, 'users', v_users, 'amount', v_amount);
end; $$;
revoke execute on function public.world_job_earned_expiry_notice(timestamptz) from public, anon, authenticated;
grant execute on function public.world_job_earned_expiry_notice(timestamptz) to service_role;

-- ---------- run_world_job: the dispatcher ----------
-- Who may run jobs: the service role (the Edge Function `jobs`), or a direct database session that
-- carries no JWT at all (pg_cron, an operator in psql). PostgREST always sets request.jwt.claims
-- (anon at least), so a web caller can never look like a direct session. The inner functions
-- check mv_is_backend_caller() themselves, so for the duration of this transaction the dispatcher
-- presents the service role to them and restores the previous claims before returning.
-- p_job = one of the five names or 'all' (in the order below). p_at = the instant the jobs reason
-- about (tests pin it; pg_cron passes now()). p_source overrides the triggered_by label.
-- Returns the job_runs rows it wrote; a failing job is recorded as status = error with the message
-- and does not stop the others (each job runs in its own sub-transaction, so its writes roll back).
create or replace function public.run_world_job(
  p_job    text,
  p_at     timestamptz default now(),
  p_source text default null
)
returns setof public.job_runs
language plpgsql security definer set search_path = public as $$
declare
  c_jobs   constant text[] := array['quest_reset', 'earned_expiry_notice', 'earned_expiry', 'season_rollover', 'score_recompute'];
  v_jobs   text[];
  v_job    text;
  v_run    public.job_runs;
  v_result jsonb;
  v_claims text := current_setting('request.jwt.claims', true);
  v_direct boolean;
  v_source text;
begin
  v_direct := coalesce(nullif(v_claims, ''), '') = '' and coalesce(auth.role(), '') = '';
  if not (public.mv_is_backend_caller() or v_direct) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_job is null or (p_job <> 'all' and not (p_job = any (c_jobs))) then
    raise exception 'unknown_job' using errcode = 'P0001';
  end if;
  v_jobs := case when p_job = 'all' then c_jobs else array[p_job] end;
  v_source := coalesce(p_source, case when public.mv_is_backend_caller() then 'edge' else 'cron' end);
  if v_source not in ('cron', 'edge', 'manual') then raise exception 'invalid_source' using errcode = 'P0001'; end if;

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  foreach v_job in array v_jobs loop
    insert into public.job_runs (job, triggered_by, run_at) values (v_job, v_source, coalesce(p_at, now()))
      returning * into v_run;
    begin
      -- One statement per job (not one CASE): a job whose function is missing or broken must
      -- fail only its own branch, never the planning of the others.
      if    v_job = 'quest_reset'          then v_result := public.world_job_quest_reset(coalesce(p_at, now()));
      elsif v_job = 'earned_expiry_notice' then v_result := public.world_job_earned_expiry_notice(coalesce(p_at, now()));
      elsif v_job = 'earned_expiry'        then v_result := jsonb_build_object('expired', public.expire_earned_tokens());
      elsif v_job = 'season_rollover'      then v_result := public.rollover_season(coalesce(p_at, now()));
      elsif v_job = 'score_recompute'      then v_result := jsonb_build_object('changed', public.world_recompute_all_scores());
      end if;
      update public.job_runs
        set status = 'ok', result = coalesce(v_result, '{}'::jsonb), finished_at = clock_timestamp()
        where id = v_run.id returning * into v_run;
    exception when others then
      update public.job_runs
        set status = 'error', error = left(sqlstate || ': ' || sqlerrm, 2000), finished_at = clock_timestamp()
        where id = v_run.id returning * into v_run;
    end;
    return next v_run;
  end loop;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  return;
end; $$;
revoke execute on function public.run_world_job(text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.run_world_job(text, timestamptz, text) to service_role;

-- ---------- pg_cron schedules ----------
-- Guarded twice: `create extension` is tried inside its own sub-transaction (a plain Postgres — CI's
-- "migrations apply cleanly" image — has no pg_cron and must still apply this file), and the
-- schedules are only written when the extension really exists. Re-running the block replaces the
-- World schedules by name (unschedule, then schedule) so a later migration can retune them.
-- Jobs run as the role that applied this migration (postgres on the hosted project), which is a
-- direct session with no JWT — exactly what run_world_job() admits. Times are UTC (pg_cron's
-- default; every World window is UTC, 0014b). The weekly entry is redundant with the daily one by
-- construction (quest_reset handles both cadences, idempotent per window) and exists so the Monday
-- window is announced even if the 00:05 run was missed.
do $cron$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable here (%): World schedules skipped — the Edge Function `jobs` is the fallback', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname like 'world\_%';
    perform cron.schedule('world_quest_reset_daily',    '5 0 * * *',  $j$ select public.run_world_job('quest_reset') $j$);
    perform cron.schedule('world_quest_reset_weekly',   '10 0 * * 1', $j$ select public.run_world_job('quest_reset') $j$);
    perform cron.schedule('world_earned_expiry_notice', '20 0 * * *', $j$ select public.run_world_job('earned_expiry_notice') $j$);
    perform cron.schedule('world_earned_expiry',        '30 0 * * *', $j$ select public.run_world_job('earned_expiry') $j$);
    perform cron.schedule('world_season_rollover',      '0 * * * *',  $j$ select public.run_world_job('season_rollover') $j$);
    perform cron.schedule('world_score_recompute',      '45 2 * * *', $j$ select public.run_world_job('score_recompute') $j$);
  end if;
end $cron$;

notify pgrst, 'reload schema';
