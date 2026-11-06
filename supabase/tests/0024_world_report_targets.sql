-- pgTAP for 0013c_world_report_targets (MV-W03-08, F-28): resolve_report() understands `garage`
-- (target = the owner) and `guestbook` (target = the line's author) reports, and the new
-- `hide_guestbook` action hides the line through hide_world_guestbook (one audit event).

begin;
select plan(9);

insert into auth.users (id) values
  ('74000000-0000-0000-0000-00000000000a'),
  ('74000000-0000-0000-0000-00000000000b'),
  ('74000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens) values
  ('74000000-0000-0000-0000-00000000000a', 'Host',    'individual', 'rt_host',    'free', 'user',  0),
  ('74000000-0000-0000-0000-00000000000b', 'Visitor', 'individual', 'rt_visitor', 'free', 'user',  0),
  ('74000000-0000-0000-0000-00000000000c', 'Admin',   'individual', 'rt_admin',   'free', 'admin', 0);
insert into public.world_garages (user_id, level, name, open_mode) values
  ('74000000-0000-0000-0000-00000000000a', 1, 'Host garage', 'public');
insert into public.world_guestbook (id, garage_user_id, author_id, body) values
  ('74000000-0000-0000-0000-0000000000e1', '74000000-0000-0000-0000-00000000000a', '74000000-0000-0000-0000-00000000000b', 'nice cars, rubbish host');

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- the host reports the guestbook line; the visitor reports the garage
select tests.authenticate_as('74000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$select public.create_report('guestbook', '74000000-0000-0000-0000-0000000000e1', 'guestbook line', 'harassment', 'rude')$$,
  'a guestbook line can be reported');
select tests.clear_authentication();
select tests.authenticate_as('74000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$select public.create_report('garage', '74000000-0000-0000-0000-00000000000a', 'Host garage', 'inappropriate_content', null)$$,
  'a garage can be reported (target = the owner)');

-- a non-admin cannot resolve anything
select throws_ok(
  $$select public.resolve_report((select id from public.reports where target_type = 'garage' limit 1), 'warn', null)$$,
  '42501', 'not_authorized', 'a non-admin cannot resolve a report');

-- admin: hide_guestbook hides the line and resolves the report
select tests.clear_authentication();
select tests.authenticate_as('74000000-0000-0000-0000-00000000000c');
select is(
  (select status::text from public.resolve_report(
     (select id from public.reports where target_type = 'guestbook' limit 1), 'hide_guestbook', 'spam')),
  'reviewed', 'hide_guestbook resolves the report as reviewed');
select tests.clear_authentication();
select is((select hidden_by_host from public.world_guestbook where id = '74000000-0000-0000-0000-0000000000e1'),
  true, 'the reported guestbook line is hidden');
select is((select count(*)::int from public.domain_events where type = 'world.guestbook_hidden'),
  1, 'the hide is audited once as world.guestbook_hidden');

-- admin: warn on a garage report reaches the garage owner
select tests.authenticate_as('74000000-0000-0000-0000-00000000000c');
select is(
  (select status::text from public.resolve_report(
     (select id from public.reports where target_type = 'garage' limit 1), 'warn', 'keep it friendly')),
  'reviewed', 'warn on a garage report resolves it');
select tests.clear_authentication();
select is((select count(*)::int from public.notifications where user_id = '74000000-0000-0000-0000-00000000000a'
  and type = 'system' and payload ->> 'message' = 'keep it friendly'), 1, 'the garage owner gets the warning');

-- an unknown action is still rejected (fixture row inserted as superuser, then resolve as admin)
insert into public.reports (target_type, target_id, reason, reporter_id)
  values ('garage', '74000000-0000-0000-0000-00000000000a', 'other', '74000000-0000-0000-0000-00000000000b');
select tests.authenticate_as('74000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select public.resolve_report((select id from public.reports where status = 'open' limit 1), 'nuke', null)$$,
  'P0001', 'invalid_action', 'unknown actions are rejected');

select * from finish();
rollback;
