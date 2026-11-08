-- pgTAP for 0015_clubs_meetups (MV-W06-01/06, F-23, D-013, D-021, D-069, D-071). Hosting eligibility
-- (level cap, Pro +50 %), create → schedule (fee via spend_tokens, idempotent key, insufficient balance),
-- visibility matrix (host / co-host / attendee / follower / invitee / stranger / blocked / anon, drafts
-- hidden), RSVP + capacity + waitlist promotion, showcase (≤ 3 own public cars), host direct edits vs the
-- guard, start (host too early / backend on time), the live room on deal_messages (members only, muted,
-- kicked, closed after end), reminders (T-24 h / T-1 h once), auto transitions, cancel refund rule (≥ 24 h
-- refunded through credit_tokens, later kept), direct writes closed, cron schedule where pg_cron exists.
-- Run via CI's pgTAP job.

begin;
select plan(112);

insert into auth.users (id) values
  ('77000000-0000-0000-0000-00000000000a'),
  ('77000000-0000-0000-0000-00000000000b'),
  ('77000000-0000-0000-0000-00000000000c'),
  ('77000000-0000-0000-0000-00000000000d'),
  ('77000000-0000-0000-0000-00000000000e'),
  ('77000000-0000-0000-0000-00000000000f'),
  ('77000000-0000-0000-0000-000000000010'),
  ('77000000-0000-0000-0000-000000000011'),
  ('77000000-0000-0000-0000-000000000012');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens, level, country_code) values
  ('77000000-0000-0000-0000-00000000000a', 'Host',     'individual', 'm_host',     'free', 'user', 50, 2, 'AE'),
  ('77000000-0000-0000-0000-00000000000b', 'Cohost',   'individual', 'm_cohost',   'free', 'user',  0, 1, 'AE'),
  ('77000000-0000-0000-0000-00000000000c', 'Attendee', 'individual', 'm_attendee', 'free', 'user',  0, 1, 'IN'),
  ('77000000-0000-0000-0000-00000000000d', 'Follower', 'individual', 'm_follower', 'free', 'user',  0, 1, 'AE'),
  ('77000000-0000-0000-0000-00000000000e', 'Blocked',  'individual', 'm_blocked',  'free', 'user',  0, 1, 'AE'),
  ('77000000-0000-0000-0000-00000000000f', 'Shed',     'individual', 'm_shed',     'free', 'user', 50, 1, 'IN'),
  ('77000000-0000-0000-0000-000000000010', 'Broke',    'individual', 'm_broke',    'free', 'user',  0, 2, 'IN'),
  ('77000000-0000-0000-0000-000000000011', 'Pro',      'individual', 'm_pro',      'pro',  'user', 50, 2, 'AE'),
  ('77000000-0000-0000-0000-000000000012', 'Third',    'individual', 'm_third',    'free', 'user',  0, 1, 'AE');
-- garages: host level 2 (host_cap 10) · shed level 1 (host_cap 0) · broke level 2 · pro level 2
insert into public.world_garages (user_id, level, name, open_mode) values
  ('77000000-0000-0000-0000-00000000000a', 2, 'Host garage',  'public'),
  ('77000000-0000-0000-0000-00000000000f', 1, 'Shed garage',  'public'),
  ('77000000-0000-0000-0000-000000000010', 2, 'Broke garage', 'public'),
  ('77000000-0000-0000-0000-000000000011', 2, 'Pro garage',   'public');
insert into public.blocks (blocker_id, blocked_id) values
  ('77000000-0000-0000-0000-00000000000a', '77000000-0000-0000-0000-00000000000e');
insert into public.follows (follower_id, followee_id) values
  ('77000000-0000-0000-0000-00000000000d', '77000000-0000-0000-0000-00000000000a');
-- the attendee's cars: two public, one private
insert into public.collection_items (id, owner_id, brand, model, is_public) values
  ('77000000-0000-0000-0000-0000000000c1', '77000000-0000-0000-0000-00000000000c', 'HW', 'Skyline', true),
  ('77000000-0000-0000-0000-0000000000c2', '77000000-0000-0000-0000-00000000000c', 'HW', 'Supra',   true),
  ('77000000-0000-0000-0000-0000000000c3', '77000000-0000-0000-0000-00000000000c', 'HW', 'Secret',  false);

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
create or replace function tests.meetup_cron_jobs() returns integer language plpgsql as $$
declare n integer;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return -1; end if;
  execute $q$ select count(*)::int from cron.job where jobname = 'meetups_tick' $q$ into n;
  return n;
end; $$;
-- meetup ids are generated; stash them in transaction GUCs so later blocks can refer to them
create or replace function tests.m(p_key text) returns uuid language sql stable as $$
  select current_setting('tests.meetup_' || p_key)::uuid;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- hosting eligibility + fee table ----------
select tests.authenticate_anon();
select throws_ok(
  $$select public.create_meetup('JDM night', now() + interval '2 days', now() + interval '2 days 2 hours', 3)$$,
  '42501', null, 'anon cannot create a meetup');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000f');
select throws_ok(
  $$select public.create_meetup('Shed night', now() + interval '2 days', now() + interval '2 days 2 hours', 3)$$,
  'P0001', 'host_not_eligible', 'a level-1 garage (host_cap 0) cannot host');
select tests.clear_authentication();
select is(public.meetup_host_cap('77000000-0000-0000-0000-00000000000a'), 10, 'level 2 hosts 10');
select is(public.meetup_host_cap('77000000-0000-0000-0000-000000000011'), 15, 'Pro adds 50 % to the cap');
select is(public.meetup_host_cap('77000000-0000-0000-0000-00000000000c'), 0, 'no garage = cannot host');
select is(array[public.meetup_host_fee(10), public.meetup_host_fee(25), public.meetup_host_fee(26)], array[5, 10, 20],
  'host fee tiers 5 / 10 / 20 by capacity (placeholder)');

select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select public.create_meetup('Too big', now() + interval '2 days', now() + interval '2 days 2 hours', 11)$$,
  'P0001', 'capacity_too_high', 'capacity above the host cap is refused');
select throws_ok(
  $$select public.create_meetup('Yesterday', now() - interval '1 day', now() - interval '22 hours', 3)$$,
  'P0001', 'starts_in_past', 'a start in the past is refused');
select throws_ok(
  $$select public.create_meetup('Club night', now() + interval '2 days', now() + interval '2 days 2 hours', 3, 'club')$$,
  'P0001', 'not_club_member', 'club visibility needs an active club membership');
-- M1: public, capacity 3, in two days
select set_config('tests.meetup_m1',
  (select id::text from public.create_meetup('JDM night', now() + interval '2 days', now() + interval '2 days 2 hours', 3, 'public', 'JDM')), true);
select is((select status from public.meetups where id = tests.m('m1')), 'draft', 'a new meetup is a draft');
select is((select count(*)::int from public.meetups where host_id = '77000000-0000-0000-0000-00000000000a'), 1, 'the host sees their draft');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'meetup.created' and entity_id = tests.m('m1')), 1,
  'meetup.created emitted');
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.meetups where id = tests.m('m1')), 0, 'a draft is hidden from everyone else');
select throws_ok($$select public.transition_meetup(tests.m('m1'), 'schedule')$$, '42501', 'not_authorized',
  'only the host schedules');
select tests.clear_authentication();

-- ---------- schedule: the host fee ----------
select tests.authenticate_as('77000000-0000-0000-0000-000000000010');
select set_config('tests.meetup_broke',
  (select id::text from public.create_meetup('Broke night', now() + interval '2 days', now() + interval '2 days 1 hour', 3)), true);
select throws_ok($$select public.transition_meetup(tests.m('broke'), 'schedule')$$, 'P0001', 'insufficient_balance',
  'scheduling needs the fee in credits (spend_tokens raises)');
select is((select status from public.meetups where id = tests.m('broke')), 'draft', 'a failed schedule leaves the draft untouched');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select is((select status from public.transition_meetup(tests.m('m1'), 'schedule')), 'scheduled', 'the host schedules M1');
select throws_ok($$select public.transition_meetup(tests.m('m1'), 'schedule')$$, 'P0001', 'invalid_transition',
  'a scheduled meetup cannot be scheduled again');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '77000000-0000-0000-0000-00000000000a'), 45, 'the 5-credit host fee was charged');
select is((select count(*)::int from public.token_ledger
            where user_id = '77000000-0000-0000-0000-00000000000a' and reason = 'spend_meetup_host' and ref_id = tests.m('m1')),
  1, 'one spend_meetup_host ledger row references the meetup');
select is((select fee_paid from public.meetups where id = tests.m('m1')), 5, 'the meetup records the fee paid');
select is((select g.kind::text from public.entitlement_grants g join public.meetups m on m.fee_ledger_id = g.ledger_id where m.id = tests.m('m1')),
  'meetup_host', 'the receipt is a meetup_host grant');
select is((select count(*)::int from public.domain_events where type = 'meetup.scheduled' and entity_id = tests.m('m1')), 1,
  'meetup.scheduled emitted');

-- ---------- visibility matrix ----------
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.meetups where id = tests.m('m1')), 1, 'a stranger sees a scheduled public meetup');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.meetups where id = tests.m('m1')), 0, 'a blocked user does not see the blocker''s meetup');
select tests.clear_authentication();
select tests.authenticate_anon();
select is((select count(*)::int from public.meetups where id = tests.m('m1')), 1, 'anon sees public meetups (share links)');
select tests.clear_authentication();
-- M2 followers-only, M3 invite-only (host pays 5 each: 45 → 35)
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select set_config('tests.meetup_m2',
  (select id::text from public.create_meetup('Followers night', now() + interval '3 days', now() + interval '3 days 1 hour', 5, 'followers')), true);
select set_config('tests.meetup_m3',
  (select id::text from public.create_meetup('Invite night', now() + interval '3 days', now() + interval '3 days 1 hour', 5, 'invite')), true);
select public.transition_meetup(tests.m('m2'), 'schedule');
select public.transition_meetup(tests.m('m3'), 'schedule');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '77000000-0000-0000-0000-00000000000a'), 35, 'two more fees charged');
select tests.authenticate_as('77000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.meetups where id = tests.m('m2')), 1, 'a follower sees a followers-only meetup');
select is((select count(*)::int from public.meetups where id = tests.m('m3')), 0, 'but not an invite-only one');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.meetups where id = tests.m('m2')), 0, 'a non-follower does not see a followers-only meetup');
select throws_ok($$select public.invite_to_meetup(tests.m('m3'), 'm_follower')$$, '42501', 'not_authorized',
  'only the host / co-host invites');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select is((select user_id from public.invite_to_meetup(tests.m('m3'), 'M_Attendee')), '77000000-0000-0000-0000-00000000000c',
  'the host invites by handle (case-insensitive)');
select throws_ok($$select public.invite_to_meetup(tests.m('m3'), 'm_blocked')$$, 'P0002', 'invitee_not_found',
  'a blocked user cannot be invited');
select throws_ok($$select public.invite_to_meetup(tests.m('m3'), 'no_such_handle')$$, 'P0002', 'invitee_not_found',
  'an unknown handle cannot be invited');
select tests.clear_authentication();
select is((select count(*)::int from public.notifications where user_id = '77000000-0000-0000-0000-00000000000c' and type = 'meetup_invite'),
  1, 'the invitee is notified once');
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.meetups where id = tests.m('m3')), 1, 'an invitee sees the invite-only meetup');
select tests.clear_authentication();

-- ---------- RSVP, capacity, waitlist ----------
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.rsvp_meetup(tests.m('m1'))$$, 'P0001', 'host_cannot_rsvp', 'the host is implicit, not an rsvp');
select is((select role from public.set_meetup_cohost(tests.m('m1'), 'm_cohost', true)), 'cohost', 'the host appoints a co-host (takes a seat)');
select throws_ok($$select public.set_meetup_cohost(tests.m('m1'), 'm_blocked', true)$$, 'P0002', 'invitee_not_found',
  'a blocked user cannot be a co-host');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000e');
select throws_ok($$select public.rsvp_meetup(tests.m('m1'))$$, 'P0002', 'meetup_not_found', 'a blocked user cannot rsvp');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select is((select status from public.rsvp_meetup(tests.m('m1'))), 'going', 'an attendee rsvps going');
select is((select status from public.rsvp_meetup(tests.m('m1'))), 'going', 'rsvp is idempotent');
select throws_ok($$select public.rsvp_meetup(tests.m('m1'), 'maybe')$$, 'P0001', 'invalid_status', 'only going / declined');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000d');
select is((select status from public.rsvp_meetup(tests.m('m1'))), 'going', 'the follower takes the third seat');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-000000000012');
select is((select status from public.rsvp_meetup(tests.m('m1'))), 'waitlist', 'past capacity the rsvp is waitlisted (F-23 AC)');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'meetup.rsvp' and entity_id = tests.m('m1')), 3,
  'meetup.rsvp emitted per rsvp');
select tests.authenticate_as('77000000-0000-0000-0000-00000000000d');
select is((select status from public.rsvp_meetup(tests.m('m1'), 'declined')), 'declined', 'the follower declines');
select tests.clear_authentication();
select is((select status from public.meetup_rsvps where meetup_id = tests.m('m1') and user_id = '77000000-0000-0000-0000-000000000012'),
  'going', 'the waitlisted attendee is promoted when a seat frees up');
-- the room is closed before the meetup is live
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$insert into public.deal_messages (kind, meetup_id, sender_id, body) values ('meetup', tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'early')$$,
  '42501', null, 'no messages before the meetup is live');

-- ---------- showcase ----------
select is((select count(*)::int from public.set_meetup_showcase(tests.m('m1'),
            array['77000000-0000-0000-0000-0000000000c1', '77000000-0000-0000-0000-0000000000c2']::uuid[])),
  2, 'an attendee brings two public cars');
select throws_ok(
  $$select public.set_meetup_showcase(tests.m('m1'), array['77000000-0000-0000-0000-0000000000c1', '77000000-0000-0000-0000-0000000000c2',
      '77000000-0000-0000-0000-0000000000c3', '77000000-0000-0000-0000-0000000000c4']::uuid[])$$,
  'P0001', 'too_many_items', 'more than showcase_limit cars is refused');
select throws_ok(
  $$select public.set_meetup_showcase(tests.m('m1'), array['77000000-0000-0000-0000-0000000000c3']::uuid[])$$,
  'P0001', 'item_not_public', 'a private car cannot be showcased');
select is((select count(*)::int from public.meetup_showcase where meetup_id = tests.m('m1')), 2, 'the showcase rows are readable by attendees');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000d');
select throws_ok(
  $$select public.set_meetup_showcase(tests.m('m1'), array['77000000-0000-0000-0000-0000000000c1']::uuid[])$$,
  'P0001', 'not_attending', 'someone who declined cannot showcase');
select tests.clear_authentication();

-- ---------- host direct edits vs the guard ----------
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select lives_ok($$update public.meetups set title = 'JDM night (Skylines)' where id = tests.m('m1')$$, 'the host edits the title directly');
select is((select title from public.meetups where id = tests.m('m1')), 'JDM night (Skylines)', 'the title changed');
select throws_ok($$update public.meetups set status = 'live' where id = tests.m('m1')$$, '42501', null,
  'status is not a grantable column — lifecycle is RPC-only');
select throws_ok($$update public.meetups set capacity = 20 where id = tests.m('m1')$$, 'P0001', 'capacity_too_high',
  'the guard keeps capacity within the host cap');
select throws_ok($$update public.meetups set capacity = 2 where id = tests.m('m1')$$, 'P0001', 'capacity_below_going',
  'the guard keeps capacity at or above the people going');
select throws_ok($$update public.meetups set starts_at = now() - interval '1 hour' where id = tests.m('m1')$$, 'P0001', 'starts_in_past',
  'the guard keeps the start in the future');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select lives_ok($$update public.meetups set title = 'hijack' where id = tests.m('m1')$$, 'an attendee''s edit is filtered to zero rows (RLS)');
select is((select title from public.meetups where id = tests.m('m1')), 'JDM night (Skylines)', 'and changed nothing');
select tests.clear_authentication();

-- ---------- start: host too early, backend on time ----------
select tests.authenticate_as('77000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.transition_meetup(tests.m('m1'), 'start')$$, 'P0001', 'too_early',
  'a co-host cannot open the room more than 15 min early');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select throws_ok($$select public.transition_meetup(tests.m('m1'), 'start')$$, '42501', 'not_authorized',
  'an attendee cannot start the meetup');
select throws_ok($$select * from public.run_meetup_jobs('all')$$, '42501', null, 'authenticated cannot run the meetup jobs');
select tests.clear_authentication();
-- direct session (pg_cron / psql) at M1's start instant
create temp table run1 as select * from public.run_meetup_jobs('meetup_transitions', (select starts_at from public.meetups where id = tests.m('m1')));
select is((select status || ':' || result::text from run1), 'ok:{"ended": 0, "errors": 0, "started": 1}', 'the transitions job opened one room');
select is((select status from public.meetups where id = tests.m('m1')), 'live', 'M1 is live');
select is((select count(*)::int from public.domain_events where type = 'meetup.started' and entity_id = tests.m('m1')), 1, 'meetup.started emitted');
select is((select count(*)::int from public.notifications where type = 'meetup_live' and payload ->> 'meetup_id' = tests.m('m1')::text),
  3, 'everyone going (co-host, attendee, promoted) is told the room is open');
select is((select triggered_by from run1), 'cron', 'a direct session is labelled cron');

-- ---------- the live room (deal_messages, kind = meetup) ----------
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$insert into public.deal_messages (kind, meetup_id, sender_id, body) values ('meetup', tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'hello room')$$,
  'an attendee posts in the live room');
select lives_ok(
  $$insert into public.deal_messages (kind, meetup_id, sender_id, body, reaction) values ('meetup', tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'fire', 'fire')$$,
  'a reaction is a thread row with a reaction key');
select throws_ok(
  $$insert into public.deal_messages (kind, meetup_id, sender_id, body, reaction) values ('meetup', tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'x', 'poop')$$,
  '23514', null, 'unknown reaction keys are refused');
select is((select count(*)::int from public.deal_messages where meetup_id = tests.m('m1')), 2, 'members read the room');
select tests.clear_authentication();
select throws_ok(
  $$insert into public.deal_messages (kind, offer_id, meetup_id, sender_id, body) values ('deal', null, tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'x')$$,
  '23514', null, 'a deal row must point at an offer, a meetup row at a meetup (constraint, RLS aside)');
select is((select count(*)::int from public.domain_events where type = 'message.sent' and entity = 'meetup' and entity_id = tests.m('m1')), 2,
  'message.sent names the meetup thread');
select tests.authenticate_as('77000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.deal_messages where meetup_id = tests.m('m1')), 0, 'a non-attendee cannot read the room (F-23 AC)');
select throws_ok(
  $$insert into public.deal_messages (kind, meetup_id, sender_id, body) values ('meetup', tests.m('m1'), '77000000-0000-0000-0000-00000000000d', 'psst')$$,
  '42501', null, 'a non-attendee cannot post');
select tests.clear_authentication();
-- moderation: mute / unmute / kick
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select throws_ok($$select public.moderate_meetup_attendee(tests.m('m1'), '77000000-0000-0000-0000-000000000012', 'mute')$$, '42501', 'not_authorized',
  'attendees do not moderate');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000b');
select isnt((select muted_at from public.moderate_meetup_attendee(tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'mute')), null,
  'a co-host mutes an attendee');
select throws_ok($$select public.moderate_meetup_attendee(tests.m('m1'), '77000000-0000-0000-0000-00000000000a', 'mute')$$, '42501', 'not_authorized',
  'nobody moderates the host');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$insert into public.deal_messages (kind, meetup_id, sender_id, body) values ('meetup', tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'muted?')$$,
  '42501', null, 'a muted attendee cannot post');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select is((select muted_at from public.moderate_meetup_attendee(tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'unmute')), null,
  'the host unmutes');
select isnt((select removed_at from public.moderate_meetup_attendee(tests.m('m1'), '77000000-0000-0000-0000-000000000012', 'kick')), null,
  'the host kicks an attendee');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-000000000012');
select throws_ok($$select public.rsvp_meetup(tests.m('m1'))$$, 'P0001', 'removed_by_host', 'a kicked attendee cannot come back');
select is((select count(*)::int from public.deal_messages where meetup_id = tests.m('m1')), 0, 'a kicked attendee no longer reads the room');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'meetup.moderated' and entity_id = tests.m('m1')), 4,
  'co-host + mute + unmute + kick are audited');

-- ---------- reminders: T-24 h then T-1 h, once each ----------
select tests.authenticate_as('77000000-0000-0000-0000-00000000000d');
select public.rsvp_meetup(tests.m('m2'));
select tests.clear_authentication();
select is((select result from public.run_meetup_jobs('meetup_reminders', (select starts_at - interval '23 hours' from public.meetups where id = tests.m('m2')))),
  '{"reminders": 2, "notified": 3}'::jsonb, 'inside 24 h: M2 (host + follower) and M3 (host) are reminded');
select is((select count(*)::int from public.notifications where type = 'meetup_reminder' and payload ->> 'horizon' = '24h'), 3,
  'one 24h notification per person');
select is((select result from public.run_meetup_jobs('meetup_reminders', (select starts_at - interval '20 hours' from public.meetups where id = tests.m('m2')))),
  '{"reminders": 0, "notified": 0}'::jsonb, 'a second run inside the same horizon reminds nobody again');
select is((select result from public.run_meetup_jobs('meetup_reminders', (select starts_at - interval '30 minutes' from public.meetups where id = tests.m('m2')))),
  '{"reminders": 2, "notified": 3}'::jsonb, 'inside 1 h: the second reminder');
select is((select count(*)::int from public.domain_events where type = 'meetup.reminder' and entity_id = tests.m('m2')), 2,
  'two meetup.reminder events per meetup (24h, 1h)');

-- ---------- end: backend at ends_at; the room closes ----------
create temp table run2 as select * from public.run_meetup_jobs('meetup_transitions', (select ends_at from public.meetups where id = tests.m('m1')));
select is((select result from run2), '{"ended": 1, "errors": 0, "started": 0}'::jsonb, 'the transitions job ended M1 (M2 / M3 not due)');
select is((select status from public.meetups where id = tests.m('m1')), 'ended', 'M1 ended');
select is((select (payload ->> 'attendees')::int from public.domain_events where type = 'meetup.ended' and entity_id = tests.m('m1')), 2,
  'meetup.ended carries the attendee count (co-host + attendee; kicked excluded)');
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$insert into public.deal_messages (kind, meetup_id, sender_id, body) values ('meetup', tests.m('m1'), '77000000-0000-0000-0000-00000000000c', 'late')$$,
  '42501', null, 'the room is closed after the meetup ends');
select throws_ok($$select public.set_meetup_showcase(tests.m('m1'), array[]::uuid[])$$, 'P0001', 'meetup_closed',
  'the showcase is frozen after the end');
select is((select count(*)::int from public.deal_messages where meetup_id = tests.m('m1')), 2, 'the thread stays readable to attendees');
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.transition_meetup(tests.m('m1'), 'cancel')$$, 'P0001', 'invalid_transition', 'an ended meetup cannot be cancelled');

-- ---------- cancel: refund ≥ 24 h before, fee kept later ----------
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000c');
select public.rsvp_meetup(tests.m('m3'));
select tests.clear_authentication();
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select is((select status from public.transition_meetup(tests.m('m3'), 'cancel')), 'cancelled', 'the host cancels M3 two days out');
select set_config('tests.meetup_m4',
  (select id::text from public.create_meetup('Tonight', now() + interval '2 hours', now() + interval '3 hours', 3)), true);
select public.transition_meetup(tests.m('m4'), 'schedule');
select is((select status from public.transition_meetup(tests.m('m4'), 'cancel')), 'cancelled', 'the host cancels M4 two hours out');
select tests.clear_authentication();
select is((select tokens from public.profiles where id = '77000000-0000-0000-0000-00000000000a'), 35,
  'M3''s fee came back (35 → 40), M4''s was charged and kept (40 → 35)');
select is((select count(*)::int from public.token_ledger where reason = 'refund' and ref_id = tests.m('m3')), 1, 'the refund is a credit_tokens refund row');
select is((select payload ->> 'refunded' from public.domain_events where type = 'meetup.cancelled' and entity_id = tests.m('m3')), 'true',
  'meetup.cancelled says the fee was refunded');
select is((select payload ->> 'refunded' from public.domain_events where type = 'meetup.cancelled' and entity_id = tests.m('m4')), 'false',
  'cancel < 24 h keeps the fee (F-23 AC)');
select is((select count(*)::int from public.notifications where type = 'meetup_cancelled' and user_id = '77000000-0000-0000-0000-00000000000c'), 1,
  'the attendee is told about the cancellation');

-- ---------- direct writes stay closed; clubs are read-only until W07 ----------
select tests.authenticate_as('77000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$insert into public.meetups (host_id, title, starts_at, ends_at, capacity) values ('77000000-0000-0000-0000-00000000000a', 'direct', now() + interval '1 day', now() + interval '1 day 1 hour', 3)$$,
  '42501', null, 'authenticated cannot insert meetups directly');
select throws_ok(
  $$insert into public.meetup_rsvps (meetup_id, user_id) values (tests.m('m2'), '77000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'authenticated cannot insert rsvps directly');
select throws_ok(
  $$insert into public.meetup_showcase (meetup_id, user_id, item_id) values (tests.m('m2'), '77000000-0000-0000-0000-00000000000a', '77000000-0000-0000-0000-0000000000c1')$$,
  '42501', null, 'authenticated cannot insert showcase rows directly');
select throws_ok(
  $$insert into public.clubs (slug, name, owner_id) values ('jdm_club', 'JDM Club', '77000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'clubs have no write policy yet (W07)');
select tests.clear_authentication();
select is((select count(*)::int from public.job_runs where job like 'meetup\_%'), 5, 'every dispatcher run wrote a job_runs row');
select ok(tests.meetup_cron_jobs() in (-1, 1), 'the meetups_tick schedule exists wherever pg_cron does');

select * from finish();
rollback;
