-- 0011_h1_jobs — MV-S9-01 (F-19 ops readiness, 03 §3 "expire_listings / expire_offers pg_cron hourly",
-- F-02 "30-day trash", D-080 "auth.users row + storage objects left to S9's jobs function"),
-- D-009 (every job emits events), D-021 (offer status only via an RPC — this file adds the one
-- server-side transition the state machine always had on paper: pending --(72 h)--> expired),
-- D-058 (there was no `expired` listing status; this is the additive enum value + the transition it
-- said would come with a real expire_listings()), D-095 (reuse the World jobs runner: same
-- `job_runs` table, a sibling SECURITY DEFINER dispatcher `run_h1_job`, same guarded pg_cron block).
--
-- H1 housekeeping, four SQL jobs behind one dispatcher (pg_cron + the Edge Function `jobs`):
--   expire_listings          hourly  active listings past `expires_at` → status `expired`,
--                                    `listing.expired` event + a `listing_expired` notification to
--                                    the seller (the "Expired" tab's Renew button already exists)
--   expire_offers            hourly  pending offers past `expires_at` (72 h) → status `expired`,
--                                    `offer.expired` event + an `offer_expired` notification to the buyer
--   purge_trash              daily   items soft-deleted ≥ 30 d ago are hard-deleted (the item.deleted
--                                    hard=true trigger from 0013a fires); their media rows → `removed`
--   ensure_event_partitions  daily   `domain_events` monthly partitions for this month + the next two
--                                    (0002 created them through 2026-12 by hand and left a default
--                                    partition "until the S9 job exists")
-- …and two Edge-side jobs that need the Storage / Auth admin APIs, so they live in
-- supabase/functions/jobs (h1-run.ts) and only get their batch / done RPCs + the job log here:
--   purge_media     media rows with status `removed` → storage object deleted → row deleted
--   purge_accounts  profiles anonymised by delete_account() ≥ 7 d ago → auth.users row deleted
--                   (service role), `profiles.purged_at` set, `user.purged` event
-- For the auth purge to leave the anonymised tombstone (and every finance row hanging off it,
-- D-080 "ledger/purchase rows are kept") in place, `profiles.id` must stop cascading from
-- `auth.users`: the FK is dropped below (decision row in DECISIONS.md, MV-S9-01).

-- ---------- additive enum values (resolved at execution time inside the functions below) ----------
alter type public.listing_status add value if not exists 'expired';
alter type public.notification_type add value if not exists 'listing_expired';
alter type public.notification_type add value if not exists 'offer_expired';

-- ---------- profiles: purge bookkeeping + no more cascade from auth.users ----------
alter table public.profiles add column if not exists purged_at timestamptz;
comment on column public.profiles.purged_at is
  'Set by the purge_accounts job once the auth.users row + storage objects of a deleted (anonymised) account are gone (MV-S9-01).';

do $fk$
declare v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'profiles' and c.contype = 'f'
    and c.confrelid = 'auth.users'::regclass;
  if v_name is not null then
    execute format('alter table public.profiles drop constraint %I', v_name);
  end if;
end $fk$;

-- ---------- indexes the hourly scans use ----------
-- marketplace_listings (expires_at) where status = 'active' already exists (0006).
create index if not exists offers_pending_expires_idx on public.offers (expires_at) where status = 'pending';
create index if not exists collection_items_trash_idx on public.collection_items (deleted_at) where deleted_at is not null;
create index if not exists media_removed_idx on public.media (created_at) where status = 'removed';
create index if not exists profiles_purge_idx on public.profiles (deleted_at) where deleted_at is not null and purged_at is null;

-- ---------- expire_listings ----------
create or replace function public.expire_listings(p_at timestamptz default now())
returns integer
language plpgsql security definer set search_path = public as $$
declare
  l   record;
  v_n integer := 0;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  for l in
    select id, seller_id, brand, model, expires_at
    from public.marketplace_listings
    where status = 'active' and deleted_at is null and expires_at is not null and expires_at <= p_at
    order by expires_at
    for update skip locked
  loop
    update public.marketplace_listings set status = 'expired' where id = l.id;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (l.seller_id, 'listing.expired', 'listing', l.id, jsonb_build_object('expired_at', l.expires_at));
    insert into public.notifications (user_id, type, payload)
      values (l.seller_id, 'listing_expired',
              jsonb_build_object('listing_id', l.id, 'brand', l.brand, 'model', l.model));
    v_n := v_n + 1;
  end loop;
  return v_n;
end; $$;
revoke execute on function public.expire_listings(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_listings(timestamptz) to service_role;

-- ---------- expire_offers ----------
-- The one status change outside transition_offer(): no caller, no authorisation question — the
-- clock ran out. Same row shape as a decline (responded_at set, decline_reason = 'expired') so the
-- inbox renders it with the existing status pill and copy.
create or replace function public.expire_offers(p_at timestamptz default now())
returns integer
language plpgsql security definer set search_path = public as $$
declare
  o   record;
  v_n integer := 0;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  for o in
    select id, buyer_id, seller_id, listing_id, expires_at
    from public.offers
    where status = 'pending' and expires_at <= p_at
    order by expires_at
    for update skip locked
  loop
    update public.offers set status = 'expired', responded_at = p_at, decline_reason = 'expired' where id = o.id;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (null, 'offer.expired', 'offer', o.id,
              jsonb_build_object('buyer_id', o.buyer_id, 'seller_id', o.seller_id,
                                 'listing_id', o.listing_id, 'expired_at', o.expires_at));
    insert into public.notifications (user_id, type, payload)
      values (o.buyer_id, 'offer_expired', jsonb_build_object('offer_id', o.id, 'listing_id', o.listing_id));
    v_n := v_n + 1;
  end loop;
  return v_n;
end; $$;
revoke execute on function public.expire_offers(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_offers(timestamptz) to service_role;

-- ---------- purge_trash (F-02: 30-day trash) ----------
-- Hard-deletes items whose soft delete is older than p_days. The 0013a AFTER DELETE trigger emits
-- `item.deleted` {hard: true} per row (D-009) and the World slot-integrity consumer drops the car
-- from any garage. Item media rows are marked `removed` so the Edge purge_media job frees the
-- storage objects; listings keep their denormalised copy (sold history, no FK to the item).
create or replace function public.purge_trash(p_at timestamptz default now(), p_days integer default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ids   uuid[];
  v_media integer;
  v_items integer;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_days is null or p_days < 1 then raise exception 'invalid_days' using errcode = 'P0001'; end if;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids
    from public.collection_items
    where deleted_at is not null and deleted_at <= p_at - make_interval(days => p_days);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return jsonb_build_object('items', 0, 'media', 0);
  end if;
  update public.media set status = 'removed'
    where kind = 'item' and entity_id = any (v_ids) and status <> 'removed';
  get diagnostics v_media = row_count;
  delete from public.collection_items where id = any (v_ids);
  get diagnostics v_items = row_count;
  return jsonb_build_object('items', v_items, 'media', v_media);
end; $$;
revoke execute on function public.purge_trash(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.purge_trash(timestamptz, integer) to service_role;

-- ---------- ensure_event_partitions ----------
-- Creates `domain_events_YYYY_MM` for the month of p_at and the next p_ahead months when missing.
-- Idempotent (if not exists). Rows that already landed in the default partition for a month make
-- that month's create fail (Postgres refuses the overlap): the error is recorded by the dispatcher
-- and surfaces in the admin job log / the daily alert — move the rows by hand, then re-run.
create or replace function public.ensure_event_partitions(p_at timestamptz default now(), p_ahead integer default 2)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_month   date := date_trunc('month', p_at at time zone 'UTC')::date;
  v_name    text;
  v_created text[] := '{}';
  i         integer;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  for i in 0 .. coalesce(p_ahead, 2) loop
    v_name := format('domain_events_%s', to_char(v_month + make_interval(months => i), 'YYYY_MM'));
    if to_regclass('public.' || v_name) is null then
      execute format(
        'create table public.%I partition of public.domain_events for values from (%L) to (%L)',
        v_name,
        (v_month + make_interval(months => i))::date,
        (v_month + make_interval(months => i + 1))::date);
      v_created := v_created || v_name;
    end if;
  end loop;
  return jsonb_build_object('created', to_jsonb(v_created), 'from', v_month);
end; $$;
revoke execute on function public.ensure_event_partitions(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.ensure_event_partitions(timestamptz, integer) to service_role;

-- ---------- Edge-side jobs: batch / done RPCs (service role only) ----------
-- purge_media: the Edge job deletes the storage objects, then calls *_done with the ids it freed.
create or replace function public.h1_purge_media_batch(p_limit integer default 200)
returns table (id uuid, bucket text, path text)
language sql security definer set search_path = public stable as $$
  select m.id, m.bucket, m.path
  from public.media m
  where m.status = 'removed' and public.mv_is_backend_caller()
  order by m.created_at
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;
revoke execute on function public.h1_purge_media_batch(integer) from public, anon, authenticated;
grant execute on function public.h1_purge_media_batch(integer) to service_role;

create or replace function public.h1_purge_media_done(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  delete from public.media where id = any (coalesce(p_ids, '{}'::uuid[])) and status = 'removed';
  get diagnostics v_n = row_count;
  return v_n;
end; $$;
revoke execute on function public.h1_purge_media_done(uuid[]) from public, anon, authenticated;
grant execute on function public.h1_purge_media_done(uuid[]) to service_role;

-- purge_accounts: anonymised ≥ p_grace_days ago, not yet purged, oldest first.
create or replace function public.h1_purge_accounts_batch(p_at timestamptz default now(), p_grace_days integer default 7, p_limit integer default 50)
returns table (id uuid, deleted_at timestamptz)
language sql security definer set search_path = public stable as $$
  select p.id, p.deleted_at
  from public.profiles p
  where p.deleted_at is not null and p.purged_at is null
    and p.deleted_at <= p_at - make_interval(days => greatest(0, coalesce(p_grace_days, 7)))
    and public.mv_is_backend_caller()
  order by p.deleted_at
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;
revoke execute on function public.h1_purge_accounts_batch(timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.h1_purge_accounts_batch(timestamptz, integer, integer) to service_role;

create or replace function public.h1_purge_account_done(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.profiles set purged_at = now()
    where id = p_user and deleted_at is not null and purged_at is null;
  if not found then raise exception 'not_purgeable' using errcode = 'P0001'; end if;
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (null, 'user.purged', 'profile', p_user, '{}'::jsonb);
end; $$;
revoke execute on function public.h1_purge_account_done(uuid) from public, anon, authenticated;
grant execute on function public.h1_purge_account_done(uuid) to service_role;

-- record_job_run: the job log for jobs that run outside the database (the two Edge purges).
create or replace function public.record_job_run(
  p_job        text,
  p_status     text,
  p_result     jsonb default '{}'::jsonb,
  p_error      text default null,
  p_started_at timestamptz default clock_timestamp(),
  p_run_at     timestamptz default now(),
  p_source     text default 'edge'
)
returns public.job_runs
language plpgsql security definer set search_path = public as $$
declare v_run public.job_runs;
begin
  if not public.mv_is_backend_caller() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_status not in ('ok', 'error') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  insert into public.job_runs (job, triggered_by, run_at, started_at, finished_at, status, result, error)
    values (p_job, coalesce(p_source, 'edge'), coalesce(p_run_at, now()), coalesce(p_started_at, clock_timestamp()),
            clock_timestamp(), p_status, coalesce(p_result, '{}'::jsonb), left(p_error, 2000))
    returning * into v_run;
  return v_run;
end; $$;
revoke execute on function public.record_job_run(text, text, jsonb, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.record_job_run(text, text, jsonb, text, timestamptz, timestamptz, text) to service_role;

-- job_runs_recent_errors: the daily alert's question — any job (either track) that failed lately?
create or replace function public.job_runs_recent_errors(p_since interval default interval '24 hours')
returns table (job text, status text, error text, started_at timestamptz)
language sql security definer set search_path = public stable as $$
  select r.job, r.status, r.error, r.started_at
  from public.job_runs r
  where r.status = 'error' and r.started_at >= now() - coalesce(p_since, interval '24 hours')
    and (public.mv_is_backend_caller() or public.is_admin())
  order by r.started_at desc;
$$;
revoke execute on function public.job_runs_recent_errors(interval) from public, anon;
grant execute on function public.job_runs_recent_errors(interval) to authenticated, service_role;

-- ---------- run_h1_job: the dispatcher (same contract as run_world_job, 0014d / D-095) ----------
create or replace function public.run_h1_job(
  p_job    text,
  p_at     timestamptz default now(),
  p_source text default null
)
returns setof public.job_runs
language plpgsql security definer set search_path = public as $$
declare
  c_jobs   constant text[] := array['expire_listings', 'expire_offers', 'purge_trash', 'ensure_event_partitions'];
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
      if    v_job = 'expire_listings'         then v_result := jsonb_build_object('expired', public.expire_listings(coalesce(p_at, now())));
      elsif v_job = 'expire_offers'           then v_result := jsonb_build_object('expired', public.expire_offers(coalesce(p_at, now())));
      elsif v_job = 'purge_trash'             then v_result := public.purge_trash(coalesce(p_at, now()));
      elsif v_job = 'ensure_event_partitions' then v_result := public.ensure_event_partitions(coalesce(p_at, now()));
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
revoke execute on function public.run_h1_job(text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.run_h1_job(text, timestamptz, text) to service_role;

-- ---------- pg_cron schedules (guarded exactly like 0014d's World block) ----------
-- Offsets avoid the World slots (:00 season rollover, 00:05–00:30 daily, 02:45). The two Edge
-- purges have no pg_cron entry (they need the Storage / Auth admin APIs): the GitHub Actions
-- workflow `.github/workflows/h1-jobs.yml` fires the Edge Function `jobs` daily and fails — i.e.
-- alerts — when any run (either track, last 24 h) recorded an error.
do $cron$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable here (%): H1 schedules skipped — the Edge Function `jobs` is the fallback', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname like 'h1\_%';
    perform cron.schedule('h1_expire_listings',         '15 * * * *', $j$ select public.run_h1_job('expire_listings') $j$);
    perform cron.schedule('h1_expire_offers',           '20 * * * *', $j$ select public.run_h1_job('expire_offers') $j$);
    perform cron.schedule('h1_purge_trash',             '35 3 * * *', $j$ select public.run_h1_job('purge_trash') $j$);
    perform cron.schedule('h1_ensure_event_partitions', '50 3 * * *', $j$ select public.run_h1_job('ensure_event_partitions') $j$);
  end if;
end $cron$;

notify pgrst, 'reload schema';
