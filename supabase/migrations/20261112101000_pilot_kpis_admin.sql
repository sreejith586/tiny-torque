-- MV-S10-03 / MV-S10-04 / MV-S10-05 (F-18, F-16, F-15) — pilot KPI view, admin Overview numbers,
-- feedback → admin notifications.
--
--   * `pilot_kpis_weekly` — materialised view, one row per UTC week (Monday start, last 52 weeks):
--     the SQL half of every 01 §6 pilot metric. Not readable through the API (materialised views
--     have no RLS): admins read it via `admin_pilot_kpis()`, and `refresh_pilot_kpis()` rebuilds
--     it (nightly pg_cron + the admin page's Refresh button), logged in `job_runs` like every
--     other job (D-095 / D-099).
--   * `admin_overview()` — the /admin Overview tiles in one admin-only call.
--   * `feedback` insert → one `feedback_received` notification per admin.
--   * `claim_analytics_events()` — the PostHog mirror (F-18 "events mirroring key domain events").
--     Until now PostHog only saw page views. The event log is the truth and most KPI events are
--     written by triggers / RPCs the browser never sees, so the browser asks for the signed-in
--     collector's own new KPI events and forwards them. A per-user cursor row makes each event
--     come back exactly once across devices and tabs (at-most-once to PostHog; SQL stays the
--     source of truth). Only id, type and time leave the database — no payloads.

-- ---------- notification type (not usable until this migration commits — only the trigger
--            body below references it, at run time) ----------
alter type public.notification_type add value if not exists 'feedback_received';

-- ---------- pilot_kpis_weekly ----------
create materialized view public.pilot_kpis_weekly as
with weeks as (
  select w::date as week_start
  from generate_series(
    date_trunc('week', now() at time zone 'utc') - interval '51 weeks',
    date_trunc('week', now() at time zone 'utc'),
    interval '1 week') w
),
signups as (
  -- cohort metrics: counted in the week the collector signed up
  select date_trunc('week', p.created_at at time zone 'utc')::date as week_start,
         count(*) as signups,
         count(*) filter (where (
           select count(*) from public.collection_items i
            where i.owner_id = p.id and i.created_at < p.created_at + interval '7 days') >= 5) as activated_7d,
         count(*) filter (where exists (
           select 1 from public.marketplace_listings l where l.seller_id = p.id)) as signups_published,
         count(*) filter (where exists (
           select 1 from public.domain_events e
            where e.actor_id = p.id
              and e.occurred_at >= p.created_at + interval '21 days'
              and e.occurred_at <  p.created_at + interval '28 days')) as retained_w4
  from public.profiles p
  group by 1
),
items as (
  select date_trunc('week', created_at at time zone 'utc')::date as week_start, count(*) as items_added
  from public.collection_items group by 1
),
scans as (
  select date_trunc('week', created_at at time zone 'utc')::date as week_start,
         count(*) as scans,
         coalesce(sum(case when jsonb_typeof(candidates) = 'array' then jsonb_array_length(candidates) else 0 end), 0) as scan_candidates,
         coalesce(sum(accepted_count), 0) as scan_accepted,
         coalesce(sum(cost_usd), 0) as scan_cost_usd
  from public.ai_scan_jobs group by 1
),
listings as (
  select date_trunc('week', created_at at time zone 'utc')::date as week_start,
         count(*) as listings_published,
         count(distinct seller_id) as publishers
  from public.marketplace_listings group by 1
),
offers_created as (
  select date_trunc('week', created_at at time zone 'utc')::date as week_start, count(*) as offers_created
  from public.offers group by 1
),
deals as (
  select date_trunc('week', o.completed_at at time zone 'utc')::date as week_start,
         count(*) as deals_completed,
         count(*) filter (where exists (
           select 1 from public.seller_reviews r where r.offer_id = o.id and r.deleted_at is null)) as deals_reviewed
  from public.offers o
  where o.status = 'completed' and o.completed_at is not null
  group by 1
),
active as (
  select date_trunc('week', occurred_at at time zone 'utc')::date as week_start,
         count(distinct actor_id) as wau
  from public.domain_events
  where actor_id is not null
    and occurred_at >= date_trunc('week', now() at time zone 'utc') - interval '51 weeks'
  group by 1
),
purchases as (
  select date_trunc('week', paid_at at time zone 'utc')::date as week_start,
         count(*) as token_purchases,
         count(distinct user_id) as token_buyers
  from public.token_purchases
  where status = 'paid' and paid_at is not null
  group by 1
),
revenue as (
  select week_start, jsonb_object_agg(currency, amount) as token_revenue
  from (
    select date_trunc('week', paid_at at time zone 'utc')::date as week_start,
           trim(currency) as currency, sum(amount) as amount
    from public.token_purchases
    where status = 'paid' and paid_at is not null
    group by 1, 2) r
  group by week_start
),
reports_created as (
  select date_trunc('week', created_at at time zone 'utc')::date as week_start, count(*) as reports_created
  from public.reports group by 1
),
reports_actioned as (
  select date_trunc('week', resolved_at at time zone 'utc')::date as week_start, count(*) as reports_actioned
  from public.reports
  where status = 'reviewed' and resolved_at is not null
  group by 1
)
select
  w.week_start,
  coalesce(s.signups, 0)::int            as signups,
  coalesce(s.activated_7d, 0)::int       as activated_7d,
  coalesce(s.signups_published, 0)::int  as signups_published,
  coalesce(s.retained_w4, 0)::int        as retained_w4,
  coalesce(i.items_added, 0)::int        as items_added,
  coalesce(sc.scans, 0)::int             as scans,
  coalesce(sc.scan_candidates, 0)::int   as scan_candidates,
  coalesce(sc.scan_accepted, 0)::int     as scan_accepted,
  coalesce(sc.scan_cost_usd, 0)::numeric(10, 5) as scan_cost_usd,
  coalesce(l.listings_published, 0)::int as listings_published,
  coalesce(l.publishers, 0)::int         as publishers,
  -- approximation: a listing is "live in the week" from created_at until it sold, was removed /
  -- expired (updated_at of that status) or was trashed
  (select count(*) from public.marketplace_listings m
    where m.created_at < (w.week_start + 7)::timestamp at time zone 'utc'
      and coalesce(m.sold_at,
                   case when m.status in ('removed', 'expired') then m.updated_at end,
                   m.deleted_at,
                   'infinity'::timestamptz) >= w.week_start::timestamp at time zone 'utc')::int as listings_live,
  coalesce(oc.offers_created, 0)::int    as offers_created,
  coalesce(d.deals_completed, 0)::int    as deals_completed,
  coalesce(d.deals_reviewed, 0)::int     as deals_reviewed,
  coalesce(a.wau, 0)::int                as wau,
  coalesce(pu.token_purchases, 0)::int   as token_purchases,
  coalesce(pu.token_buyers, 0)::int      as token_buyers,
  coalesce(rv.token_revenue, '{}'::jsonb) as token_revenue,
  coalesce(rc.reports_created, 0)::int   as reports_created,
  coalesce(ra.reports_actioned, 0)::int  as reports_actioned
from weeks w
left join signups s           on s.week_start = w.week_start
left join items i             on i.week_start = w.week_start
left join scans sc            on sc.week_start = w.week_start
left join listings l          on l.week_start = w.week_start
left join offers_created oc   on oc.week_start = w.week_start
left join deals d             on d.week_start = w.week_start
left join active a            on a.week_start = w.week_start
left join purchases pu        on pu.week_start = w.week_start
left join revenue rv          on rv.week_start = w.week_start
left join reports_created rc  on rc.week_start = w.week_start
left join reports_actioned ra on ra.week_start = w.week_start
with data;

create unique index pilot_kpis_weekly_week_idx on public.pilot_kpis_weekly (week_start);
revoke all on public.pilot_kpis_weekly from public, anon, authenticated;

comment on materialized view public.pilot_kpis_weekly is
  'F-18 weekly pilot KPIs (01 §6), UTC weeks. Read via admin_pilot_kpis(); rebuilt by refresh_pilot_kpis().';

-- ---------- admin read ----------
create or replace function public.admin_pilot_kpis(p_weeks integer default 12)
returns setof public.pilot_kpis_weekly
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
    select * from public.pilot_kpis_weekly
    order by week_start desc
    limit least(greatest(coalesce(p_weeks, 12), 1), 52);
end; $$;
revoke execute on function public.admin_pilot_kpis(integer) from public, anon;
grant execute on function public.admin_pilot_kpis(integer) to authenticated, service_role;

-- ---------- refresh (admin button, pg_cron, or the service role) ----------
create or replace function public.refresh_pilot_kpis()
returns public.job_runs
language plpgsql security definer set search_path = public as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_direct boolean;
  v_source text;
  v_run    public.job_runs;
begin
  v_direct := coalesce(nullif(v_claims, ''), '') = '' and coalesce(auth.role(), '') = '';
  if public.mv_is_backend_caller() then v_source := 'edge';
  elsif v_direct then v_source := 'cron';
  elsif public.is_admin() then v_source := 'manual';
  else raise exception 'not_authorized' using errcode = '42501';
  end if;

  insert into public.job_runs (job, triggered_by, run_at) values ('refresh_pilot_kpis', v_source, now())
    returning * into v_run;
  begin
    refresh materialized view public.pilot_kpis_weekly;
    update public.job_runs
      set status = 'ok',
          result = jsonb_build_object('weeks', (select count(*) from public.pilot_kpis_weekly)),
          finished_at = clock_timestamp()
      where id = v_run.id returning * into v_run;
  exception when others then
    update public.job_runs
      set status = 'error', error = left(sqlstate || ': ' || sqlerrm, 2000), finished_at = clock_timestamp()
      where id = v_run.id returning * into v_run;
  end;
  return v_run;
end; $$;
revoke execute on function public.refresh_pilot_kpis() from public, anon;
grant execute on function public.refresh_pilot_kpis() to authenticated, service_role;

-- ---------- admin Overview (F-16): one row of counts, this-month costs and revenue ----------
create or replace function public.admin_overview()
returns table (
  users integer,
  users_new_7d integer,
  items integer,
  listings_active integer,
  offers_total integer,
  offers_pending integer,
  deals_completed integer,
  scans_month integer,
  scan_cost_usd_month numeric,
  token_purchases_month integer,
  token_revenue_month jsonb,
  phone_users_active_month integer,
  open_reports integer,
  feedback_7d integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_month timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query select
    (select count(*) from public.profiles where deleted_at is null)::int,
    (select count(*) from public.profiles where deleted_at is null and created_at > now() - interval '7 days')::int,
    (select count(*) from public.collection_items where deleted_at is null)::int,
    (select count(*) from public.marketplace_listings where status = 'active' and deleted_at is null)::int,
    (select count(*) from public.offers)::int,
    (select count(*) from public.offers where status = 'pending')::int,
    (select count(*) from public.offers where status = 'completed')::int,
    (select count(*) from public.ai_scan_jobs where created_at >= v_month)::int,
    (select coalesce(sum(cost_usd), 0) from public.ai_scan_jobs where created_at >= v_month)::numeric,
    (select count(*) from public.token_purchases where status = 'paid' and paid_at >= v_month)::int,
    coalesce((
      select jsonb_object_agg(currency, amount) from (
        select trim(currency) as currency, sum(amount) as amount
        from public.token_purchases
        where status = 'paid' and paid_at >= v_month
        group by 1) r), '{}'::jsonb),
    -- the base of the SMS estimate: collectors active this month with a verified mobile on their
    -- profile (phone OTP, D-012). profiles.mobile, not auth.users.phone: no auth-schema dependency.
    (select count(distinct e.actor_id) from public.domain_events e
      join public.profiles p on p.id = e.actor_id
      where e.occurred_at >= v_month and coalesce(p.mobile, '') <> '')::int,
    (select count(*) from public.reports where status = 'open' and deleted_at is null)::int,
    (select count(*) from public.feedback where created_at > now() - interval '7 days')::int;
end; $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated, service_role;

-- ---------- feedback → admin notifications (F-15 "feedback/bug form → admin notifications") ----------
create or replace function public.notify_admins_on_feedback() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, payload)
  select p.id, 'feedback_received'::public.notification_type,
         jsonb_build_object('feedback_id', new.id, 'kind', new.kind)
  from public.profiles p
  where p.role = 'admin' and p.deleted_at is null and p.id <> new.user_id;
  return new;
end; $$;
revoke execute on function public.notify_admins_on_feedback() from public, anon, authenticated;
drop trigger if exists feedback_notify_admins on public.feedback;
create trigger feedback_notify_admins
  after insert on public.feedback
  for each row execute function public.notify_admins_on_feedback();

-- ---------- PostHog mirror: each collector claims their own new KPI events once ----------
create table public.analytics_cursors (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  last_event_id bigint not null default 0,
  updated_at    timestamptz not null default now()
);
alter table public.analytics_cursors enable row level security;
create policy "Users read their own analytics cursor" on public.analytics_cursors for select
  using (user_id = auth.uid());
revoke all on public.analytics_cursors from public, anon, authenticated;
grant select on public.analytics_cursors to authenticated;

create or replace function public.claim_analytics_events(p_limit integer default 100)
returns table (id bigint, type text, occurred_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  c_types constant text[] := array[
    'user.onboarded', 'user.opened', 'invite.redeemed',
    'item.created', 'scan.requested', 'scan.completed', 'scan.accepted', 'import.completed',
    'listing.published', 'listing.sold',
    'offer.created', 'offer.accepted', 'offer.completed', 'review.created',
    'tokens.purchased', 'tokens.spent', 'pro.activated',
    'report.created', 'feedback.created'];
  v_uid   uuid := auth.uid();
  v_after bigint;
  v_max   bigint;
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid) then
    return;
  end if;
  -- First call: start a week back, not at the beginning of time.
  insert into public.analytics_cursors (user_id, last_event_id)
  values (v_uid, coalesce((select max(e.id) from public.domain_events e
                            where e.occurred_at < now() - interval '7 days'), 0))
  on conflict (user_id) do nothing;

  select c.last_event_id into v_after
    from public.analytics_cursors c where c.user_id = v_uid for update;

  select max(s.id) into v_max from (
    select e.id from public.domain_events e
     where e.actor_id = v_uid and e.id > v_after and e.type = any (c_types)
     order by e.id
     limit least(greatest(coalesce(p_limit, 100), 1), 500)) s;
  if v_max is null then
    return;
  end if;

  update public.analytics_cursors c
     set last_event_id = v_max, updated_at = now()
   where c.user_id = v_uid;

  return query
    select e.id, e.type, e.occurred_at
      from public.domain_events e
     where e.actor_id = v_uid and e.id > v_after and e.id <= v_max and e.type = any (c_types)
     order by e.id;
end; $$;
revoke execute on function public.claim_analytics_events(integer) from public, anon;
grant execute on function public.claim_analytics_events(integer) to authenticated;

-- ---------- nightly refresh (guarded like the h1_* schedules; its own name so the h1_* set stays the four of D-099; 04:10 UTC is a free slot) ----------
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'pilot_kpis_refresh';
    perform cron.schedule('pilot_kpis_refresh', '10 4 * * *', $j$ select public.refresh_pilot_kpis() $j$);
  else
    raise notice 'pg_cron unavailable here: pilot_kpis_weekly is refreshed from /admin/kpis only';
  end if;
end $cron$;

notify pgrst, 'reload schema';
