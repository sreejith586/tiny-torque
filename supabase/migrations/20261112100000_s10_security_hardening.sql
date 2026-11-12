-- MV-S10-01 (F-19) — security review fixes. Findings and evidence: docs/security-review.md.
--
--   1. `collection_items_v1` (0003 compat view) ran with its OWNER's rights, so RLS on
--      `collection_items` never applied through it: anon could read every collector's private
--      and trashed cars, price paid included, via /rest/v1/collection_items_v1. Nothing in the
--      app reads the view; it becomes security_invoker (the caller's RLS applies) and anon loses
--      the grant. Dropping it is the destructive half and waits for the photo/photos column drop
--      (D-006 two-release rule).
--   2. `reports` kept its S0 INSERT policy next to the rate-limited `create_report` RPC, so a
--      direct table insert skipped the 10/day limit (F-15). The limit moves into a trigger that
--      covers both paths.
--   3. `feedback` had no limit at all — and from this migration every row notifies the admins.
--      Same 10 per 24 h rule, same `rate_limited` error.
--   4. The three H1 admin RPCs re-check is_admin() themselves; anon simply has no business
--      holding EXECUTE on them.
--   5. `domain_events` is partitioned by month and RLS on the parent does NOT cover a partition
--      that is addressed directly: /rest/v1/domain_events_2026_11 let anon read the whole event
--      log (actor ids, payloads) and insert / delete rows in it — forged events feed XP, badges
--      and the World earn consumer. Every partition gets RLS with no policy (deny all; rows
--      still flow through the parent, whose policies are the ones Postgres applies there) and
--      loses its API-role grants; `ensure_event_partitions` now locks each partition it creates.
--   6. `profiles` — the worst one. authenticated holds table-level UPDATE / INSERT (0001 grants)
--      and the only policies are "own row", so any signed-in collector could
--      `update profiles set role = 'admin', tokens = 999999, plan = 'pro', suspended_until = null`
--      on their own row straight through PostgREST (or onboard with those values). A trigger
--      guard, like S8's xp/level one, now refuses any change to the server-maintained columns
--      when the statement runs as an API role; SECURITY DEFINER RPCs, the service role and
--      psql are untouched (inside a definer function current_user is the function's owner).

-- ---------- 1. compat view obeys the caller's RLS ----------
alter view public.collection_items_v1 set (security_invoker = true);
revoke all on public.collection_items_v1 from anon;

-- ---------- 2. reports: 10 per rolling 24 h, whichever way the row arrives ----------
create or replace function public.check_report_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports
        where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists reports_rate_limit on public.reports;
create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.check_report_rate_limit();

-- ---------- 3. feedback: 10 per rolling 24 h ----------
create or replace function public.check_feedback_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.feedback
        where user_id = new.user_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.check_feedback_rate_limit();

revoke execute on function public.check_report_rate_limit() from public, anon, authenticated;
revoke execute on function public.check_feedback_rate_limit() from public, anon, authenticated;

-- ---------- 4. admin RPCs: no anon EXECUTE ----------
revoke execute on function public.admin_search_users(text, integer) from public, anon;
revoke execute on function public.admin_set_suspension(uuid, integer) from public, anon;
revoke execute on function public.admin_adjust_tokens(uuid, integer, text) from public, anon;
grant execute on function public.admin_search_users(text, integer) to authenticated, service_role;
grant execute on function public.admin_set_suspension(uuid, integer) to authenticated, service_role;
grant execute on function public.admin_adjust_tokens(uuid, integer, text) to authenticated, service_role;

-- ---------- 5. event-log partitions are not an API surface ----------
create or replace function public.lock_event_partitions() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_part regclass;
  v_n    integer := 0;
begin
  for v_part in
    select i.inhrelid::regclass from pg_inherits i where i.inhparent = 'public.domain_events'::regclass
  loop
    execute format('alter table %s enable row level security', v_part);
    execute format('revoke all on %s from public, anon, authenticated', v_part);
    v_n := v_n + 1;
  end loop;
  return v_n;
end; $$;
revoke execute on function public.lock_event_partitions() from public, anon, authenticated;
grant execute on function public.lock_event_partitions() to service_role;

select public.lock_event_partitions();

-- Same body as 20261108120000_h1_jobs.sql plus the lock on whatever it just created.
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
  perform public.lock_event_partitions();
  return jsonb_build_object('created', to_jsonb(v_created), 'from', v_month);
end; $$;
revoke execute on function public.ensure_event_partitions(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.ensure_event_partitions(timestamptz, integer) to service_role;

-- ---------- 6. profiles: server-maintained columns are not client-writable ----------
create or replace function public.guard_profile_privileged_columns() returns trigger
language plpgsql as $$
begin
  -- SECURITY INVOKER on purpose: current_user is the role the statement runs as — an API role
  -- for a direct PostgREST write, the function owner inside every definer RPC.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role <> 'user' or new.tokens <> 0 or new.plan <> 'free' or new.pro_until is not null
       or new.suspended_until is not null or new.scan_quota_used <> 0 or new.scan_quota_bonus <> 0
       or new.rating_avg is not null or new.rating_count <> 0 or new.xp <> 0 or new.level <> 0
       or new.deleted_at is not null or new.purged_at is not null then
      raise exception 'profile_privileged_columns' using errcode = '42501',
        hint = 'role, tokens, plan, pro, suspension, scan quota, rating, xp/level and deletion are server-maintained';
    end if;
    return new;
  end if;
  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.tokens is distinct from old.tokens
     or new.plan is distinct from old.plan
     or new.pro_until is distinct from old.pro_until
     or new.suspended_until is distinct from old.suspended_until
     or new.scan_quota_used is distinct from old.scan_quota_used
     or new.scan_quota_bonus is distinct from old.scan_quota_bonus
     or new.scan_quota_reset_at is distinct from old.scan_quota_reset_at
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.deleted_at is distinct from old.deleted_at
     or new.purged_at is distinct from old.purged_at
     or new.created_at is distinct from old.created_at then
    raise exception 'profile_privileged_columns' using errcode = '42501',
      hint = 'role, tokens, plan, pro, suspension, scan quota, rating and deletion change only through their RPCs';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

notify pgrst, 'reload schema';
