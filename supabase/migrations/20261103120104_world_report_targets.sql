-- 0013c_world_report_targets — MV-W03-08 (F-28), 07 §9 "report on every World entity".
--
-- resolve_report() (0010 admin_moderation) only knew `listing` and `user` targets. World adds two
-- report targets: `garage` (target_id = the owner's user id) and `guestbook` (target_id = the
-- world_guestbook row). This replaces the function body so warn / suspend resolve the right person
-- for both, and adds one action, `hide_guestbook`, that hides the reported line (same path as the
-- host's hide_world_guestbook, so the audit event is identical). Signature unchanged — no types
-- change. Everything else in the body is 0010's, verbatim.

create or replace function public.resolve_report(
  p_report_id uuid,
  p_action text,
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
  v_entry public.world_guestbook;
  v_target_user uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'remove_listing', 'warn', 'suspend', 'hide_guestbook') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  select * into v_report from public.reports where id = p_report_id and status = 'open';
  if not found then raise exception 'report_not_found_or_resolved' using errcode = 'P0002'; end if;

  if v_report.target_type = 'listing' and v_report.target_id is not null then
    select * into v_listing from public.marketplace_listings where id = v_report.target_id::uuid;
    if found then v_target_user := v_listing.seller_id; end if;
  elsif v_report.target_type in ('user', 'garage') and v_report.target_id is not null then
    v_target_user := v_report.target_id::uuid;
  elsif v_report.target_type = 'guestbook' and v_report.target_id is not null then
    select * into v_entry from public.world_guestbook where id = v_report.target_id::uuid;
    if found then v_target_user := v_entry.author_id; end if;
  end if;

  if p_action = 'remove_listing' then
    if v_listing.id is null then raise exception 'listing_not_found' using errcode = 'P0002'; end if;
    update public.marketplace_listings set status = 'removed' where id = v_listing.id;
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
      values (v_uid, 'listing.removed', 'listing', v_listing.id, jsonb_build_object('reason', 'admin_moderation', 'report_id', p_report_id));
  elsif p_action = 'hide_guestbook' then
    if v_entry.id is null then raise exception 'entry_not_found' using errcode = 'P0002'; end if;
    -- same RPC the host uses (admin is allowed there), so world.guestbook_hidden is emitted once
    perform public.hide_world_guestbook(v_entry.id, true);
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

notify pgrst, 'reload schema';
