-- 0018_admin_moderation — MV-S6-07, F-16, 04-feature-specs.md F-15/F-16.
--
-- resolve_report: the only path from an open report to dismiss / remove_listing / warn / suspend
-- (admin-only, is_admin()). Each action resolves the report (resolved_by/resolved_at/
-- resolution_note) and does its side effect atomically: remove_listing sets the target listing
-- `removed` (admin has no update RLS on marketplace_listings otherwise — seller-only); warn sends
-- the target a `system` notification with the admin's note, no other state change; suspend sets
-- `profiles.suspended_until` (middleware already blocks on this since MV-S5-08) for a fixed 7-day
-- window — not spec'd further, a reasonable default, revisit if you want it configurable.
-- "remove_listing"/"suspend" resolve target_type 'listing' -> that listing's seller for suspend,
-- since suspending literally needs a user id and a report on a listing doesn't carry one directly.

create or replace function public.resolve_report(
  p_report_id       uuid,
  p_action          text,
  p_resolution_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.reports;
  v_listing public.marketplace_listings;
  v_target_user uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'remove_listing', 'warn', 'suspend') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  select * into v_report from public.reports where id = p_report_id and status = 'open';
  if not found then raise exception 'report_not_found_or_resolved' using errcode = 'P0002'; end if;

  if v_report.target_type = 'listing' and v_report.target_id is not null then
    select * into v_listing from public.marketplace_listings where id = v_report.target_id::uuid;
    if found then v_target_user := v_listing.seller_id; end if;
  elsif v_report.target_type = 'user' and v_report.target_id is not null then
    v_target_user := v_report.target_id::uuid;
  end if;

  if p_action = 'remove_listing' then
    if v_listing.id is null then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
    update public.marketplace_listings set status = 'removed' where id = v_listing.id;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'listing.removed', 'listing', v_listing.id, jsonb_build_object('reason', 'admin_moderation', 'report_id', p_report_id));
  elsif p_action = 'warn' then
    if v_target_user is null then raise exception 'no_target_user' using errcode = 'P0001'; end if;
    insert into public.notifications (user_id, type, payload)
      values (v_target_user, 'system', jsonb_build_object('message', coalesce(p_resolution_note, 'You received a warning from the Tiny Torque team.')));
  elsif p_action = 'suspend' then
    if v_target_user is null then raise exception 'no_target_user' using errcode = 'P0001'; end if;
    update public.profiles set suspended_until = now() + interval '7 days' where id = v_target_user;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'user.suspended', 'profile', v_target_user, jsonb_build_object('report_id', p_report_id, 'days', 7));
  end if;

  update public.reports set
    status = (case when p_action = 'dismiss' then 'dismissed' else 'reviewed' end)::public.report_status,
    resolved_by = v_uid,
    resolved_at = now(),
    resolution_note = p_resolution_note
    where id = p_report_id
    returning * into v_report;

  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'report.resolved', 'report', p_report_id, jsonb_build_object('action', p_action));

  return v_report;
end; $$;

grant execute on function public.resolve_report(uuid, text, text) to authenticated;

-- ---------- Admin user search (profiles has no public search surface) ----------
create or replace function public.admin_search_users(p_query text, p_limit integer default 20)
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  return query
    select * from public.profiles
    where p_query is null or p_query = ''
      or display_name ilike '%' || p_query || '%'
      or handle ilike '%' || p_query || '%'
      or mobile = p_query
    order by created_at desc
    limit least(coalesce(p_limit, 20), 100);
end; $$;

grant execute on function public.admin_search_users(text, integer) to authenticated;

-- ---------- Direct suspend/unsuspend from the Users page (not tied to a report) ----------
create or replace function public.admin_set_suspension(p_user_id uuid, p_days integer default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;

  update public.profiles
    set suspended_until = case when p_days is null or p_days <= 0 then null else now() + make_interval(days => p_days) end
    where id = p_user_id
    returning * into v_profile;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;

  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (
      v_uid,
      case when p_days is null or p_days <= 0 then 'user.unsuspended' else 'user.suspended' end,
      'profile', p_user_id, jsonb_build_object('days', p_days)
    );
  return v_profile;
end; $$;

grant execute on function public.admin_set_suspension(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
