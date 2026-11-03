-- pgTAP for 0013b_world_social (MV-W03-01/07, F-21, D-013). Visits (one per day, owner excluded,
-- blocked visitor refused), kudos (one per day), guestbook (post, host hide, rate limit), invites
-- (share-link token with max uses, direct by handle, expiry, revoke) and how they unlock
-- followers-only / invite-only garages, the open-garages view, notifications and events.
-- Run via CI's pgTAP job.

begin;
select plan(41);

insert into auth.users (id) values
  ('73000000-0000-0000-0000-00000000000a'),
  ('73000000-0000-0000-0000-00000000000b'),
  ('73000000-0000-0000-0000-00000000000c'),
  ('73000000-0000-0000-0000-00000000000d'),
  ('73000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens, country_code) values
  ('73000000-0000-0000-0000-00000000000a', 'Host',     'individual', 'v_host',     'free', 'user', 0, 'AE'),
  ('73000000-0000-0000-0000-00000000000b', 'Follower', 'individual', 'v_follower', 'free', 'user', 0, 'AE'),
  ('73000000-0000-0000-0000-00000000000c', 'Stranger', 'individual', 'v_stranger', 'free', 'user', 0, 'IN'),
  ('73000000-0000-0000-0000-00000000000d', 'Blocked',  'individual', 'v_blocked',  'free', 'user', 0, 'AE'),
  ('73000000-0000-0000-0000-00000000000e', 'Private',  'individual', 'v_private',  'free', 'user', 0, 'AE');
-- A public garage (host blocks D) · E invite-only garage · B follows A
insert into public.world_garages (user_id, level, name, open_mode) values
  ('73000000-0000-0000-0000-00000000000a', 1, 'Host garage', 'public'),
  ('73000000-0000-0000-0000-00000000000e', 1, 'Private garage', 'invite');
insert into public.blocks (blocker_id, blocked_id) values
  ('73000000-0000-0000-0000-00000000000a', '73000000-0000-0000-0000-00000000000d');
insert into public.follows (follower_id, followee_id) values
  ('73000000-0000-0000-0000-00000000000b', '73000000-0000-0000-0000-00000000000a');

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.authenticate_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- visits ----------
select tests.authenticate_anon();
select throws_ok($$select public.record_world_visit('73000000-0000-0000-0000-00000000000a')$$, '42501', null,
  'anon cannot record a visit');

select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000c');
select isnt((select id from public.record_world_visit('73000000-0000-0000-0000-00000000000a')), null,
  'a stranger can visit a public garage');
select is((select id from public.record_world_visit('73000000-0000-0000-0000-00000000000a')),
  (select id from public.world_visits where visitor_id = '73000000-0000-0000-0000-00000000000c'),
  'a second visit the same day returns the same row');
select throws_ok($$select public.record_world_visit('73000000-0000-0000-0000-00000000000e')$$, 'P0002', 'garage_not_found',
  'a stranger cannot visit an invite-only garage');
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000d');
select throws_ok($$select public.record_world_visit('73000000-0000-0000-0000-00000000000a')$$, 'P0002', 'garage_not_found',
  'a blocked user cannot visit the garage of the user who blocked them');
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000a');
select is((select id from public.record_world_visit('73000000-0000-0000-0000-00000000000a')), null,
  'the owner looking at their own garage is not a visit');
select tests.clear_authentication();
select is((select visit_count from public.world_garages where user_id = '73000000-0000-0000-0000-00000000000a'),
  1, 'visit_count counts distinct visitor-days');
select is((select count(*)::int from public.domain_events where type = 'world.visited'), 1, 'world.visited emitted once');
select is((select count(*)::int from public.notifications where user_id = '73000000-0000-0000-0000-00000000000a' and type = 'world_visit'),
  1, 'the host is notified once per visitor-day');

-- ---------- kudos ----------
select tests.authenticate_as('73000000-0000-0000-0000-00000000000c');
select is((select giver_id from public.give_world_kudos('73000000-0000-0000-0000-00000000000a')),
  '73000000-0000-0000-0000-00000000000c', 'a visitor can give kudos');
select public.give_world_kudos('73000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.give_world_kudos('73000000-0000-0000-0000-00000000000c')$$, 'P0001', 'own_garage',
  'no kudos to yourself');
select tests.clear_authentication();
select is((select kudos_count from public.world_garages where user_id = '73000000-0000-0000-0000-00000000000a'),
  1, 'kudos is one per giver per day');
select is((select count(*)::int from public.domain_events where type = 'world.kudos_given'), 1, 'world.kudos_given emitted once');

-- ---------- guestbook ----------
select tests.authenticate_as('73000000-0000-0000-0000-00000000000c');
select is((select body from public.post_world_guestbook('73000000-0000-0000-0000-00000000000a', '  Lovely Skylines!  ')),
  'Lovely Skylines!', 'a visitor posts a trimmed guestbook line');
select throws_ok($$select public.post_world_guestbook('73000000-0000-0000-0000-00000000000a', '   ')$$, 'P0001', 'invalid_body',
  'an empty line is rejected');
select throws_ok($$select public.post_world_guestbook('73000000-0000-0000-0000-00000000000a', repeat('x', 141))$$, 'P0001', 'invalid_body',
  'a 141-char line is rejected');
select public.post_world_guestbook('73000000-0000-0000-0000-00000000000a', 'two');
select public.post_world_guestbook('73000000-0000-0000-0000-00000000000a', 'three');
select public.post_world_guestbook('73000000-0000-0000-0000-00000000000a', 'four');
select public.post_world_guestbook('73000000-0000-0000-0000-00000000000a', 'five');
select throws_ok($$select public.post_world_guestbook('73000000-0000-0000-0000-00000000000a', 'six')$$, 'P0001', 'guestbook_rate_limit',
  'the 6th line within an hour is rate-limited (trigger)');
select is((select count(*)::int from public.world_guestbook where garage_user_id = '73000000-0000-0000-0000-00000000000a'),
  5, 'the author reads the garage''s guestbook');
-- the stranger cannot hide; the host can; hidden lines vanish for the author
select throws_ok(
  $$select public.hide_world_guestbook((select id from public.world_guestbook where body = 'two'))$$,
  '42501', 'not_authorized', 'only the host hides guestbook lines');
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000a');
select is((select hidden_by_host from public.hide_world_guestbook((select id from public.world_guestbook where body = 'two'))),
  true, 'the host hides a line');
select is((select count(*)::int from public.world_guestbook where garage_user_id = '73000000-0000-0000-0000-00000000000a'),
  5, 'the host still sees the hidden line');
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.world_guestbook where garage_user_id = '73000000-0000-0000-0000-00000000000a'),
  4, 'a hidden line is gone for everyone else');
select tests.clear_authentication();
select is((select count(*)::int from public.notifications where user_id = '73000000-0000-0000-0000-00000000000a' and type = 'world_guestbook'),
  5, 'the host is notified per guestbook line');
select is((select count(*)::int from public.domain_events where type = 'world.guestbook_hidden'), 1, 'hiding is audited');

-- ---------- invites unlock the invite-only garage ----------
select tests.authenticate_as('73000000-0000-0000-0000-00000000000e');
select is((select max_uses from public.create_world_invite(null, 24, 1)), 1, 'the host creates a share-link invite');
select throws_ok($$select public.create_world_invite('no_such_handle')$$, 'P0002', 'invitee_not_found',
  'a direct invite needs a real handle');
select is((select invitee_id from public.create_world_invite('v_follower', 48)),
  '73000000-0000-0000-0000-00000000000b', 'a direct invite resolves the handle');
select tests.clear_authentication();
select is((select count(*)::int from public.notifications where user_id = '73000000-0000-0000-0000-00000000000b' and type = 'world_invite'),
  1, 'the invitee is notified');
-- B (directly invited) sees E's invite-only garage; C (not yet) does not
select tests.authenticate_as('73000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.world_garages where user_id = '73000000-0000-0000-0000-00000000000e'),
  1, 'a direct invitee sees the invite-only garage');
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.world_garages where user_id = '73000000-0000-0000-0000-00000000000e'),
  0, 'without an invite the garage stays hidden');
-- C accepts the share link → visible; a second user cannot reuse a 1-use token
select is((select used_count from public.accept_world_invite(
  (select token from public.world_invites where garage_user_id = '73000000-0000-0000-0000-00000000000e' and invitee_id is null))),
  1, 'accepting a share link counts a use');
select is((select count(*)::int from public.world_garages where user_id = '73000000-0000-0000-0000-00000000000e'),
  1, 'after accepting, the garage is visible');
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000d');
select throws_ok($$select public.accept_world_invite(
  (select token from public.world_invites where garage_user_id = '73000000-0000-0000-0000-00000000000e' and invitee_id is null))$$,
  'P0001', 'invite_invalid', 'a used-up share link is refused');
select throws_ok($$select public.accept_world_invite('nope')$$, 'P0001', 'invite_invalid', 'an unknown token is refused');
-- revoke the direct invite → B loses access
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000e');
select isnt((select revoked_at from public.revoke_world_invite(
  (select id from public.world_invites where invitee_id = '73000000-0000-0000-0000-00000000000b'))), null, 'the host revokes a direct invite');
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.world_garages where user_id = '73000000-0000-0000-0000-00000000000e'),
  0, 'a revoked invite no longer opens the garage');
-- an expired invite does not open it either (expire C's accepted one)
select tests.clear_authentication();
update public.world_invites set expires_at = now() - interval '1 minute'
  where garage_user_id = '73000000-0000-0000-0000-00000000000e' and invitee_id is null;
select tests.authenticate_as('73000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.world_garages where user_id = '73000000-0000-0000-0000-00000000000e'),
  0, 'an expired invite no longer opens the garage');

-- ---------- open garages view ----------
select tests.clear_authentication();
select tests.authenticate_anon();
select is((select string_agg(handle, ',' order by handle) from public.world_open_garages where handle like 'v\_%'),
  'v_host', 'anon lists public garages only');
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.world_open_garages where handle = 'v_host'),
  0, 'a blocked user does not see the blocker''s garage in the list');

-- ---------- direct writes stay closed ----------
select tests.clear_authentication();
select tests.authenticate_as('73000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$insert into public.world_kudos (garage_user_id, giver_id) values ('73000000-0000-0000-0000-00000000000a', '73000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'authenticated cannot insert kudos directly');
select throws_ok(
  $$update public.world_garages set visit_count = 999 where user_id = '73000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'counters are RPC-only (guard) or invisible (RLS)');

select * from finish();
rollback;
