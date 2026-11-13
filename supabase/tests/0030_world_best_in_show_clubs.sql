-- pgTAP for 0015b_world_best_in_show_clubs (MV-W07-01/02/04/05/06; F-22, F-23, F-28; D-013, D-021, D-071).
-- Club roles RLS (owner / admin / member / applicant / invitee / banned / outsider / blocked): create, join
-- modes, applications, invitations, roles + transfer, remove / ban / unban, "a banned member cannot rejoin",
-- "only members read a non-open club's feed", direct writes closed. Club meetups (staff only, club_id kept,
-- feed line), recurring club night (draft spawn, idempotent, advance). Best-in-show (one ballot, own car
-- refused, recount, frozen at `ended` for RPC and direct sessions), attendance clock (server time, 120 s
-- cap, once), attend / host rewards through earn_tokens (flag per recipient, 2/day, ≥ 5 attended, replay
-- safe), photo wall (members only, visibility, limit, removal), hosting rules (level, upheld report in
-- 90 d, automatic suspension at two, admin lift + appeal note, dark notification). Run via CI's pgTAP job.

begin;
select plan(150);

insert into auth.users (id) values
  ('78000000-0000-0000-0000-00000000000a'), ('78000000-0000-0000-0000-00000000000b'),
  ('78000000-0000-0000-0000-00000000000c'), ('78000000-0000-0000-0000-00000000000d'),
  ('78000000-0000-0000-0000-00000000000e'), ('78000000-0000-0000-0000-00000000000f'),
  ('78000000-0000-0000-0000-000000000010'), ('78000000-0000-0000-0000-000000000011'),
  ('78000000-0000-0000-0000-000000000012'), ('78000000-0000-0000-0000-000000000013'),
  ('78000000-0000-0000-0000-000000000014'), ('78000000-0000-0000-0000-000000000015');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens, level, country_code) values
  ('78000000-0000-0000-0000-00000000000a', 'Owner',     'individual', 'cl_owner',     'free', 'user',  100, 2, 'AE'),
  ('78000000-0000-0000-0000-00000000000b', 'Second',    'individual', 'cl_second',    'free', 'user',    0, 2, 'AE'),
  ('78000000-0000-0000-0000-00000000000c', 'Member',    'individual', 'cl_member',    'free', 'user',    0, 1, 'AE'),
  ('78000000-0000-0000-0000-00000000000d', 'Applicant', 'individual', 'cl_applicant', 'free', 'user',    0, 1, 'AE'),
  ('78000000-0000-0000-0000-00000000000e', 'Blocked',   'individual', 'cl_blocked',   'free', 'user',    0, 1, 'AE'),
  ('78000000-0000-0000-0000-00000000000f', 'Outsider',  'individual', 'cl_outsider',  'free', 'user',    0, 1, 'AE'),
  ('78000000-0000-0000-0000-000000000010', 'Rookie',    'individual', 'cl_rookie',    'free', 'user',   50, 1, 'AE'),
  ('78000000-0000-0000-0000-000000000011', 'Admin',     'individual', 'cl_admin',     'free', 'admin',   0, 1, 'AE'),
  ('78000000-0000-0000-0000-000000000012', 'India',     'individual', 'cl_india',     'free', 'user',    0, 1, 'IN'),
  ('78000000-0000-0000-0000-000000000013', 'Capped',    'individual', 'cl_capped',    'free', 'user',    0, 1, 'AE'),
  ('78000000-0000-0000-0000-000000000014', 'Fourth',    'individual', 'cl_fourth',    'free', 'user',    0, 1, 'AE'),
  ('78000000-0000-0000-0000-000000000015', 'Brief',     'individual', 'cl_brief',     'free', 'user',    0, 1, 'AE');
-- garages: owner, second and rookie at garage level 2 (host_cap 10)
insert into public.world_garages (user_id, level, name, open_mode) values
  ('78000000-0000-0000-0000-00000000000a', 2, 'Owner garage',  'public'),
  ('78000000-0000-0000-0000-00000000000b', 2, 'Second garage', 'public'),
  ('78000000-0000-0000-0000-000000000010', 2, 'Rookie garage', 'public');
insert into public.blocks (blocker_id, blocked_id) values
  ('78000000-0000-0000-0000-00000000000a', '78000000-0000-0000-0000-00000000000e');
insert into public.collection_items (id, owner_id, brand, model, is_public) values
  ('78000000-0000-0000-0000-0000000000c1', '78000000-0000-0000-0000-00000000000c', 'HW', 'Skyline', true),
  ('78000000-0000-0000-0000-0000000000c2', '78000000-0000-0000-0000-00000000000c', 'HW', 'Supra',   true),
  ('78000000-0000-0000-0000-0000000000b1', '78000000-0000-0000-0000-00000000000b', 'HW', 'RX-7',    true);
-- Seeded seasons must not take part in anything this file pays out (the 0026 isolation rule).
delete from public.seasons;
-- world_earn ON for AE only: the India attendee shows the per-recipient gate.
update public.feature_flags set enabled = true, audience = '{"countries":["AE"]}'::jsonb where key = 'world_earn';

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
-- generated ids are stashed in transaction GUCs
create or replace function tests.k(p_key text) returns uuid language sql stable as $$
  select current_setting('tests.w07_' || p_key)::uuid;
$$;
create or replace function tests.u(p_suffix text) returns uuid language sql immutable as $$
  select ('78000000-0000-0000-0000-0000000000' || p_suffix)::uuid;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- host / owner eligibility: F-13 level ----------
select tests.authenticate_as(tests.u('10'));
select throws_ok(
  $$select public.create_meetup('Rookie night', now() + interval '2 days', now() + interval '2 days 2 hours', 3)$$,
  'P0001', 'host_level_too_low', 'a level-1 collector cannot host even with a level-2 garage');
select throws_ok($$select public.create_club('rookie_club', 'Rookie Club')$$,
  'P0001', 'host_level_too_low', 'and cannot own a club');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0a'));
select is(public.world_host_ineligible_reason(), null, 'a level-2 collector with a clean record may host');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0c'));
select throws_ok($$select public.world_host_ineligible_reason('78000000-0000-0000-0000-00000000000a')$$,
  '42501', 'not_authorized', 'eligibility of someone else is not a member''s to ask');
select tests.clear_authentication();

-- ---------- create ----------
select tests.authenticate_as(tests.u('0a'));
select set_config('tests.w07_open', (select id::text from public.create_club('JDM_Club', 'JDM Club', 'open', 'Skylines and friends', 'ae')), true);
select is((select slug::text || ':' || country_code from public.clubs where id = tests.k('open')), 'jdm_club:AE',
  'the slug is lower-cased, the country upper-cased');
select is((select role::text || ':' || status::text from public.club_members where club_id = tests.k('open') and user_id = tests.u('0a')),
  'owner:active', 'the creator is the active owner');
select throws_ok($$select public.create_club('jdm_club', 'Copycat')$$, 'P0001', 'slug_taken', 'a slug is unique (case-insensitive)');
select throws_ok($$select public.create_club('x!', 'Bad slug')$$, 'P0001', 'invalid_slug', 'the slug format is enforced');
select set_config('tests.w07_apply', (select id::text from public.create_club('apply_club', 'Apply Club', 'apply')), true);
select set_config('tests.w07_invite', (select id::text from public.create_club('invite_club', 'Invite Club', 'invite')), true);
select throws_ok($$select public.create_club('fourth_club', 'Too many')$$, 'P0001', 'club_limit', 'three clubs per owner');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'club.created' and entity_id = tests.k('open')), 1,
  'club.created emitted');

-- ---------- join modes ----------
select tests.authenticate_as(tests.u('0c'));
select is((select status::text from public.join_club(tests.k('open'))), 'active', 'an open club admits at once');
select is((select status::text from public.join_club(tests.k('open'))), 'active', 'joining twice is a no-op');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'club.joined' and entity_id = tests.k('open')), 1,
  'club.joined emitted once');
select tests.authenticate_as(tests.u('0e'));
select throws_ok($$select public.join_club(tests.k('open'))$$, 'P0002', 'club_not_found', 'a collector the owner blocked cannot join');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0d'));
select is((select status::text from public.join_club(tests.k('apply'))), 'pending', 'an apply club takes an application');
select is((select count(*)::int from public.club_feed(tests.k('apply'))), 0, 'an applicant cannot read a non-open club''s feed (F-22 AC)');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0f'));
select throws_ok($$select public.join_club(tests.k('invite'))$$, 'P0001', 'invite_required', 'an invite club needs an invitation');
select is((select count(*)::int from public.club_members where club_id = tests.k('open')), 2, 'an outsider reads an open club''s active roster');
select is((select count(*)::int from public.club_members where club_id = tests.k('apply')), 0, 'but not a closed club''s roster');
select is((select members from public.club_member_counts(array[tests.k('apply')])), 1, 'the size of a closed club is public');
select is((select count(*)::int from public.club_feed(tests.k('apply'))), 0, 'an outsider cannot read a non-open club''s feed');
select cmp_ok((select count(*)::int from public.club_feed(tests.k('open'))), '>=', 2, 'an open club''s feed is readable by any collector');
select tests.clear_authentication();

-- ---------- applications + invitations ----------
select tests.authenticate_as(tests.u('0c'));
select throws_ok($$select public.decide_club_application(tests.k('apply'), '78000000-0000-0000-0000-00000000000d', true)$$,
  '42501', 'not_authorized', 'only the club''s staff decide applications');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0a'));
select lives_ok($$select public.decide_club_application(tests.k('apply'), '78000000-0000-0000-0000-00000000000d', true)$$,
  'the owner approves the application');
select is((select status::text from public.club_members where club_id = tests.k('apply') and user_id = tests.u('0d')), 'active',
  'the applicant is a member');
select is((select invited_by from public.invite_to_club(tests.k('invite'), 'CL_Outsider')), tests.u('0a'),
  'the owner invites by handle (case-insensitive)');
select throws_ok($$select public.invite_to_club(tests.k('invite'), 'cl_blocked')$$, 'P0002', 'invitee_not_found',
  'a blocked collector cannot be invited');
select tests.clear_authentication();
select is((select count(*)::int from public.notifications where user_id = tests.u('0d') and type = 'club_approved'), 1,
  'the applicant is told');
select is((select count(*)::int from public.notifications where user_id = tests.u('0f') and type = 'club_invite'), 1,
  'the invitee is told');
select tests.authenticate_as(tests.u('0d'));
select cmp_ok((select count(*)::int from public.club_feed(tests.k('apply'))), '>=', 2, 'a member reads the feed');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0f'));
select is((select status::text from public.join_club(tests.k('invite'))), 'active', 'the invitee accepts by joining');
select tests.clear_authentication();

-- ---------- roles ----------
select tests.authenticate_as(tests.u('0c'));
select throws_ok($$select public.set_club_member_role(tests.k('open'), '78000000-0000-0000-0000-00000000000c', 'admin')$$,
  '42501', 'not_authorized', 'a member cannot promote themself');
update public.club_members set role = 'owner' where club_id = tests.k('open') and user_id = '78000000-0000-0000-0000-00000000000c';
select is(public.club_role(tests.k('open'), tests.u('0c')), 'member', 'the roster has no direct write path (RLS filters the update)');
select throws_ok($$insert into public.clubs (slug, name, owner_id) values ('side_door', 'Side door', '78000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'clubs have no direct write path');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0a'));
select is((select role::text from public.set_club_member_role(tests.k('open'), '78000000-0000-0000-0000-00000000000c', 'admin')),
  'admin', 'the owner promotes a member to admin');
select tests.clear_authentication();
select is((select payload ->> 'from' from public.domain_events where type = 'club.role_changed' and entity_id = tests.k('open')),
  'member', 'club.role_changed records the previous role');

-- ---------- remove / ban / unban ----------
select tests.authenticate_as(tests.u('0b'));
select is((select status::text from public.join_club(tests.k('open'))), 'active', 'a second member joins');
select throws_ok($$select public.moderate_club_member(tests.k('open'), '78000000-0000-0000-0000-00000000000c', 'remove')$$,
  '42501', 'not_authorized', 'a member cannot remove anyone');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0c'));
select lives_ok($$select public.moderate_club_member(tests.k('open'), '78000000-0000-0000-0000-00000000000b', 'remove')$$,
  'an admin removes a member (F-22 AC)');
select throws_ok($$select public.moderate_club_member(tests.k('open'), '78000000-0000-0000-0000-00000000000a', 'remove')$$,
  '42501', 'not_authorized', 'nobody removes the owner');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0b'));
select is((select status::text from public.join_club(tests.k('open'))), 'active', 'a removed member may join again');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0c'));
select lives_ok($$select public.moderate_club_member(tests.k('open'), '78000000-0000-0000-0000-00000000000b', 'ban')$$,
  'an admin bans a member');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0b'));
select throws_ok($$select public.join_club(tests.k('open'))$$, 'P0001', 'banned_from_club', 'a banned member cannot rejoin (F-22 AC)');
select throws_ok($$select public.leave_club(tests.k('open'))$$, 'P0001', 'not_a_member', 'nor clear the ban by leaving');
select is(public.is_club_member(tests.k('open'), tests.u('0b')), false, 'a banned collector is not a member');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0a'));
select throws_ok($$select public.leave_club(tests.k('open'))$$, 'P0001', 'owner_cannot_leave', 'the owner cannot leave their club');
select lives_ok($$select public.moderate_club_member(tests.k('open'), '78000000-0000-0000-0000-00000000000b', 'unban')$$,
  'the owner lifts the ban');
select is((select role::text from public.set_club_member_role(tests.k('open'), '78000000-0000-0000-0000-00000000000c', 'member')),
  'member', 'the owner demotes the admin');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0b'));
select is((select status::text from public.join_club(tests.k('open'))), 'active', 'after the unban they can join');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0c'));
select throws_ok($$select public.moderate_club_member(tests.k('open'), '78000000-0000-0000-0000-00000000000b', 'ban')$$,
  '42501', 'not_authorized', 'a demoted admin has no moderation rights');
select tests.clear_authentication();
-- ownership transfer
select tests.authenticate_as(tests.u('0a'));
select is((select role::text from public.set_club_member_role(tests.k('apply'), '78000000-0000-0000-0000-00000000000d', 'owner')),
  'owner', 'the owner hands the club over');
select tests.clear_authentication();
select is((select owner_id from public.clubs where id = tests.k('apply')), tests.u('0d'), 'clubs.owner_id follows the transfer');
select is(public.club_role(tests.k('apply'), tests.u('0a')), 'admin', 'the previous owner stays as an admin');

-- ---------- club meetups ----------
select tests.authenticate_as(tests.u('0b'));
select throws_ok(
  $$select public.create_meetup('Not mine', now() + interval '2 days', now() + interval '2 days 2 hours', 3, 'public', null, null, tests.k('open'))$$,
  'P0001', 'not_club_staff', 'a plain member cannot host as the club');
select set_config('tests.w07_solo',
  (select id::text from public.create_meetup('Solo night', now() + interval '5 days', now() + interval '5 days 1 hour', 3)), true);
select throws_ok($$update public.meetups set club_id = tests.k('open') where id = tests.k('solo')$$,
  'P0001', 'not_club_staff', 'nor point their own meetup at the club by a direct edit');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0a'));
select set_config('tests.w07_m1',
  (select id::text from public.create_meetup('Members night', now() + interval '2 days', now() + interval '2 days 2 hours', 10, 'club', null, null, tests.k('open'))), true);
select set_config('tests.w07_m2',
  (select id::text from public.create_meetup('Open night', now() + interval '1 day', now() + interval '1 day 2 hours', 10, 'public', null, null, tests.k('open'))), true);
select is((select club_id from public.meetups where id = tests.k('m2')), tests.k('open'), 'a club-hosted meetup keeps its club for any visibility');
select is((select status::text from public.transition_meetup(tests.k('m1'), 'schedule')), 'scheduled', 'the owner schedules the club meetup');
select is((select status::text from public.transition_meetup(tests.k('m2'), 'schedule')), 'scheduled', 'and the public club-hosted one');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'club.meetup_scheduled' and entity_id = tests.k('open')), 2,
  'a scheduled club meetup lands on the club feed');
select tests.authenticate_as(tests.u('0c'));
select is((select count(*)::int from public.meetups where id = tests.k('m1')), 1, 'a member sees a club-only meetup');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('10'));
select is((select count(*)::int from public.meetups where id = tests.k('m1')), 0, 'a non-member does not');
select tests.clear_authentication();

-- ---------- recurring club night ----------
select tests.authenticate_as(tests.u('0c'));
select throws_ok(
  $$select public.set_club_night(tests.k('open'), 'Club night', 'weekly', now() + interval '3 days', 120, 8)$$,
  'P0001', 'not_club_staff', 'only the club''s staff set the club night');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0a'));
select lives_ok($$select public.set_club_night(tests.k('open'), 'Old night', 'monthly', now() + interval '20 days', 120, 8)$$,
  'the owner sets a club night');
select is((select cadence from public.set_club_night(tests.k('open'), 'Club night', 'weekly', now() + interval '3 days', 120, 8)),
  'weekly', 'setting it again replaces it');
select is((select count(*)::int from public.club_night_templates where club_id = tests.k('open') and active), 1, 'one active club night per club');
select throws_ok($$select public.world_job_club_nights(now())$$, '42501', null, 'authenticated cannot run the club-night job');
select tests.clear_authentication();
create temp table night1 as select * from public.run_meetup_jobs('club_nights', now());
select is((select status || ':' || result::text from night1), 'ok:{"skipped": 0, "spawned": 1, "stopped": 0}',
  'the job spawns the occurrence inside the 7-day window');
select is((select status::text || ':' || capacity::text from public.meetups
            where club_id = tests.k('open') and title = 'Club night' and starts_at = now() + interval '3 days'),
  'draft:8', 'as a DRAFT (the host fee is the host''s spend, never a job''s)');
select is((select count(*)::int from public.notifications where user_id = tests.u('0a') and type = 'club_night_ready'), 1,
  'the host is told a draft is ready');
create temp table night2 as select * from public.run_meetup_jobs('club_nights', now());
select is((select result::text from night2), '{"skipped": 0, "spawned": 0, "stopped": 0}', 'a second run spawns nothing (idempotent)');
create temp table night3 as select * from public.run_meetup_jobs('club_nights', now() + interval '4 days');
select is((select result::text from night3), '{"skipped": 0, "spawned": 1, "stopped": 0}', 'the next week''s occurrence spawns when it enters the window');
select is((select next_starts_at from public.club_night_templates where club_id = tests.k('open') and active),
  now() + interval '17 days', 'the template advanced by its cadence');
select tests.authenticate_as(tests.u('0a'));
select lives_ok($$select public.stop_club_night(tests.k('open'))$$, 'the owner stops the club night');
select tests.clear_authentication();
select is((select count(*)::int from public.club_night_templates where club_id = tests.k('open') and active), 0, 'no active club night left');

-- ---------- best-in-show ----------
select tests.authenticate_as(tests.u('0c'));
select public.rsvp_meetup(tests.k('m2'));
select public.set_meetup_showcase(tests.k('m2'), array['78000000-0000-0000-0000-0000000000c1', '78000000-0000-0000-0000-0000000000c2']::uuid[]);
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0b'));
select public.rsvp_meetup(tests.k('m2'));
select public.set_meetup_showcase(tests.k('m2'), array['78000000-0000-0000-0000-0000000000b1']::uuid[]);
select tests.clear_authentication();
select tests.authenticate_as(tests.u('12')); select public.rsvp_meetup(tests.k('m2')); select tests.clear_authentication();
select tests.authenticate_as(tests.u('13')); select public.rsvp_meetup(tests.k('m2')); select tests.clear_authentication();
select tests.authenticate_as(tests.u('14')); select public.rsvp_meetup(tests.k('m2')); select tests.clear_authentication();
select tests.authenticate_as(tests.u('15')); select public.rsvp_meetup(tests.k('m2')); select tests.clear_authentication();
select set_config('tests.w07_c1', (select id::text from public.meetup_showcase where item_id = '78000000-0000-0000-0000-0000000000c1'), true);
select set_config('tests.w07_c2', (select id::text from public.meetup_showcase where item_id = '78000000-0000-0000-0000-0000000000c2'), true);
select set_config('tests.w07_b1', (select id::text from public.meetup_showcase where item_id = '78000000-0000-0000-0000-0000000000b1'), true);

select tests.authenticate_as(tests.u('0b'));
select throws_ok($$select public.vote_best_in_show(tests.k('m2'), tests.k('c1'))$$, 'P0001', 'voting_closed',
  'no votes before the room is live');
select is(public.meetup_room_ping(tests.k('m2')), false, 'and the attendance clock does not run');
select tests.clear_authentication();
-- direct session at M2's start instant: only M2 goes live (M1 starts a day later)
select public.run_meetup_jobs('meetup_transitions', (select starts_at from public.meetups where id = tests.k('m2')));
select is((select status::text from public.meetups where id = tests.k('m2')), 'live', 'M2 is live');

select tests.authenticate_as(tests.u('0c'));
select throws_ok($$select public.vote_best_in_show(tests.k('m2'), tests.k('c1'))$$, 'P0001', 'own_entry', 'you cannot vote for your own car');
select is((select votes from public.vote_best_in_show(tests.k('m2'), tests.k('b1'))), 1, 'an attendee votes');
select is((select count(*)::int from public.meetup_votes where meetup_id = tests.k('m2')), 1, 'a voter reads only their own ballot');
select throws_ok(
  $$insert into public.meetup_votes (meetup_id, voter_id, showcase_id) values (tests.k('m2'), '78000000-0000-0000-0000-00000000000c', tests.k('b1'))$$,
  '42501', null, 'ballots have no direct write path');
update public.meetup_showcase set votes = 99 where id = tests.k('c1');
select is((select votes from public.meetup_showcase where id = tests.k('c1')), 0, 'the tally has no direct write path (RLS filters the update)');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0f'));
select throws_ok($$select public.vote_best_in_show(tests.k('m2'), tests.k('c1'))$$, 'P0001', 'not_attending', 'a non-attendee cannot vote');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0b'));
select is((select votes from public.vote_best_in_show(tests.k('m2'), tests.k('c1'))), 1, 'a second attendee votes for another car');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('12'));
select is((select votes from public.vote_best_in_show(tests.k('m2'), tests.k('c1'))), 2, 'votes add up');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('13'));
select is((select votes from public.vote_best_in_show(tests.k('m2'), tests.k('b1'))), 2, 'two cars level on two votes');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('14'));
select is((select votes from public.vote_best_in_show(tests.k('m2'), tests.k('c2'))), 1, 'a fifth attendee votes for a third car');
select is((select votes from public.vote_best_in_show(tests.k('m2'), tests.k('c1'))), 3, 'then moves the ballot while the meetup is live');
select tests.clear_authentication();
select is((select array_agg(votes order by item_id) from public.meetup_showcase where meetup_id = tests.k('m2')), array[2, 3, 0],
  'the tally is recounted from the ballots (b1 2 · c1 3 · c2 0)');
select is((select count(*)::int from public.meetup_votes where meetup_id = tests.k('m2') and voter_id = tests.u('14')), 1,
  'one ballot per attendee');

-- ---------- attendance clock ----------
update public.meetup_rsvps set room_joined_at = now() - interval '11 minutes', room_seen_at = now() - interval '100 seconds', room_seconds = 540
  where meetup_id = tests.k('m2') and user_id in (tests.u('0c'), tests.u('0b'), tests.u('12'), tests.u('13'), tests.u('14'));
update public.meetup_rsvps set room_joined_at = now() - interval '1 hour', room_seen_at = now() - interval '1 hour'
  where meetup_id = tests.k('m2') and user_id = tests.u('15');
select tests.authenticate_as(tests.u('0c'));
select is(public.meetup_room_ping(tests.k('m2')), true, 'ten minutes in the room = attended');
select is(public.meetup_room_ping(tests.k('m2')), true, 'and stays attended');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0b')); select public.meetup_room_ping(tests.k('m2')); select tests.clear_authentication();
select tests.authenticate_as(tests.u('12')); select public.meetup_room_ping(tests.k('m2')); select tests.clear_authentication();
select tests.authenticate_as(tests.u('13')); select public.meetup_room_ping(tests.k('m2')); select tests.clear_authentication();
select tests.authenticate_as(tests.u('14')); select public.meetup_room_ping(tests.k('m2')); select tests.clear_authentication();
select tests.authenticate_as(tests.u('15'));
select is(public.meetup_room_ping(tests.k('m2')), false, 'coming back after an hour away is not attendance');
select tests.clear_authentication();
select is((select room_seconds from public.meetup_rsvps where meetup_id = tests.k('m2') and user_id = tests.u('15')), 120,
  'a gap between pings counts for at most 120 s');
select tests.authenticate_as(tests.u('0a'));
select is(public.meetup_room_ping(tests.k('m2')), false, 'the host has no attendance clock');
select tests.clear_authentication();
select is((select count(*)::int from public.domain_events where type = 'meetup.checked_in' and entity_id = tests.k('m2')), 5,
  'meetup.checked_in emitted once per attendee who attended');

-- ---------- photo wall ----------
select tests.authenticate_as(tests.u('0f'));
select throws_ok(
  $$insert into public.media (owner_id, kind, entity_id, bucket, path, status)
    values ('78000000-0000-0000-0000-00000000000f', 'meetup_photo', tests.k('m2'), 'item-media', '78000000-0000-0000-0000-00000000000f/meetups/x.jpg', 'ready')$$,
  'P0001', 'not_attending', 'a non-attendee cannot post on the photo wall');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0c'));
select lives_ok(
  $$insert into public.media (owner_id, kind, entity_id, bucket, path, status)
    values ('78000000-0000-0000-0000-00000000000c', 'meetup_photo', tests.k('m2'), 'item-media', '78000000-0000-0000-0000-00000000000c/meetups/1.jpg', 'ready')$$,
  'an attendee posts a photo while the meetup is live');
select throws_ok($$update public.media set entity_id = tests.k('m1') where path = '78000000-0000-0000-0000-00000000000c/meetups/1.jpg'$$,
  '42501', 'rpc_only_column', 'a wall photo cannot be moved to another meetup');
select tests.clear_authentication();
select set_config('tests.w07_photo', (select id::text from public.media where path = '78000000-0000-0000-0000-00000000000c/meetups/1.jpg'), true);
select tests.authenticate_as(tests.u('0f'));
select is((select count(*)::int from public.media where id = tests.k('photo')), 1, 'the wall follows meetup visibility (public meetup)');
select throws_ok($$select public.remove_meetup_photo(tests.k('photo'))$$, '42501', 'not_authorized', 'a bystander cannot take a photo down');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0e'));
select is((select count(*)::int from public.media where id = tests.k('photo')), 0, 'a blocked collector does not see the wall');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0a'));
select lives_ok($$select public.remove_meetup_photo(tests.k('photo'))$$, 'the host takes a photo down');
select tests.clear_authentication();
select is((select status::text from public.media where id = tests.k('photo')), 'removed', 'the row is kept as removed');
select tests.authenticate_as(tests.u('0c'));
select throws_ok($$update public.media set status = 'ready' where id = tests.k('photo')$$, '42501', 'rpc_only_column',
  'its owner cannot put a removed photo back');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0f'));
select is((select count(*)::int from public.media where id = tests.k('photo')), 0, 'and is off the wall');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0c'));
select lives_ok(
  $$insert into public.media (owner_id, kind, entity_id, bucket, path, status)
    select '78000000-0000-0000-0000-00000000000c', 'meetup_photo', tests.k('m2'), 'item-media',
           '78000000-0000-0000-0000-00000000000c/meetups/n' || g || '.jpg', 'ready' from generate_series(1, 6) g$$,
  'six photos per attendee');
select throws_ok(
  $$insert into public.media (owner_id, kind, entity_id, bucket, path, status)
    values ('78000000-0000-0000-0000-00000000000c', 'meetup_photo', tests.k('m2'), 'item-media', '78000000-0000-0000-0000-00000000000c/meetups/n7.jpg', 'ready')$$,
  'P0001', 'photo_limit', 'the seventh is refused');
select tests.clear_authentication();

-- ---------- end: the result freezes, rewards are paid ----------
-- the Capped attendee already earned two attend rewards today (2/day)
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.earn_tokens(tests.u('13'), 'earn_attend', 1, 'attend:test-a:13');
select public.earn_tokens(tests.u('13'), 'earn_attend', 1, 'attend:test-b:13');
select tests.clear_authentication();

select tests.authenticate_as(tests.u('0a'));
select is((select status::text from public.transition_meetup(tests.k('m2'), 'end')), 'ended', 'the host ends the meetup');
select throws_ok($$update public.meetups set best_in_show_votes = 9 where id = tests.k('m2')$$, '42501', null,
  'the host cannot edit the result');
select tests.clear_authentication();
select is((select best_in_show_id from public.meetups where id = tests.k('m2')), tests.k('c1'), 'the most-voted car is best in show');
select is((select best_in_show_votes from public.meetups where id = tests.k('m2')), 3, 'with its vote count');
select is((select actor_id from public.domain_events where type = 'meetup.best_in_show' and entity_id = tests.k('m2')), tests.u('0c'),
  'meetup.best_in_show names the winner');
select is((select (payload ->> 'attended')::int from public.domain_events where type = 'meetup.ended' and entity_id = tests.k('m2')), 5,
  'meetup.ended carries the attended count');
select tests.authenticate_as(tests.u('15'));
select throws_ok($$select public.vote_best_in_show(tests.k('m2'), tests.k('b1'))$$, 'P0001', 'voting_closed',
  'no vote after the end (F-23 AC)');
select tests.clear_authentication();
select throws_ok($$update public.meetup_showcase set votes = 9 where id = tests.k('b1')$$, 'P0001', 'voting_closed',
  'the tally is frozen even for a direct session (F-23 AC)');
select throws_ok($$update public.meetup_votes set showcase_id = tests.k('b1') where voter_id = '78000000-0000-0000-0000-000000000014'$$,
  'P0001', 'voting_closed', 'and so are the ballots');

select is((select array_agg(delta order by delta) from public.token_ledger where user_id = tests.u('0c') and reason = 'earn_attend'),
  array[3], 'an attendee who attended earns +3 (earn_attend)');
select is((select count(*)::int from public.token_ledger where user_id = tests.u('15') and reason = 'earn_attend'), 0,
  'an attendee who did not attend earns nothing');
select is((select count(*)::int from public.token_ledger where user_id = tests.u('12') and reason = 'earn_attend'), 0,
  'world_earn OFF for the recipient = no reward (dark means dark)');
select is((select count(*)::int from public.token_ledger where user_id = tests.u('13') and reason = 'earn_attend'), 2,
  'the third attend reward of the day is not paid (2/day)');
select is((select array_agg(delta) from public.token_ledger where user_id = tests.u('0a') and reason = 'earn_host'),
  array[10], 'the host of a meetup with ≥ 5 attended earns +10 (earn_host)');
-- replay: the same event again pays nothing twice
insert into public.domain_events (actor_id, type, entity, entity_id, payload)
  values (tests.u('0a'), 'meetup.ended', 'meetup', tests.k('m2'), '{}'::jsonb);
select is((select count(*)::int from public.token_ledger where reason in ('earn_attend', 'earn_host')
            and idempotency_key like '%' || tests.k('m2')::text || '%'), 4,
  'a replayed meetup.ended pays nothing twice (3 attend + 1 host)');

-- ---------- hosting rules: upheld reports ----------
select tests.authenticate_as(tests.u('0f'));
select lives_ok($$select public.create_report('meetup', tests.k('m2')::text, 'Open night', 'harassment', 'rude host')$$,
  'a meetup can be reported');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0c'));
select lives_ok($$select public.create_report('club', tests.k('open')::text, 'JDM Club', 'inappropriate_content', null)$$,
  'a club can be reported');
select lives_ok($$select public.create_report('club', tests.k('invite')::text, 'Invite Club', 'spam', null)$$,
  'and another one');
select throws_ok($$select public.admin_set_host_suspension('78000000-0000-0000-0000-00000000000a', 'suspend', null)$$,
  '42501', 'not_authorized', 'a non-admin cannot suspend hosting');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('11'));
select is((select target_user_id from public.resolve_report((select id from public.reports where target_type = 'meetup'), 'warn', 'Keep it friendly')),
  tests.u('0a'), 'an upheld meetup report is about the host');
select tests.clear_authentication();
select is((select count(*)::int from public.world_host_suspensions where user_id = tests.u('0a')), 0, 'one upheld report does not suspend');
select tests.authenticate_as(tests.u('0a'));
select is(public.world_host_ineligible_reason(), 'host_recent_report', 'but it blocks hosting for 90 days');
select throws_ok(
  $$select public.create_meetup('After report', now() + interval '2 days', now() + interval '2 days 2 hours', 3)$$,
  'P0001', 'host_recent_report', 'create_meetup refuses');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('11'));
select is((select status::text from public.resolve_report((select id from public.reports where target_type = 'club' and target_id = tests.k('invite')::text), 'dismiss', null)),
  'dismissed', 'a dismissed report is not upheld');
select tests.clear_authentication();
select is((select count(*)::int from public.world_host_suspensions where user_id = tests.u('0a')), 0, 'and does not count towards suspension');
select tests.authenticate_as(tests.u('11'));
select is((select target_user_id from public.resolve_report((select id from public.reports where target_type = 'club' and target_id = tests.k('open')::text), 'warn', null)),
  tests.u('0a'), 'an upheld club report is about the owner');
select tests.clear_authentication();
select is((select reason from public.world_host_suspensions where user_id = tests.u('0a') and lifted_at is null), 'upheld_reports',
  'two upheld reports suspend hosting automatically');
select is((select count(*)::int from public.domain_events where type = 'world.host_suspended' and entity_id = tests.u('0a')), 1,
  'world.host_suspended emitted');
select is((select count(*)::int from public.notifications where user_id = tests.u('0a') and type = 'hosting_suspended'), 0,
  'no World notification while world_meetups / world_clubs are OFF for them (dark)');
select tests.authenticate_as(tests.u('0a'));
select is(public.world_host_ineligible_reason(), 'hosting_suspended', 'the reason is the suspension');
select throws_ok($$select public.create_club('late_club', 'Late Club')$$, 'P0001', 'hosting_suspended', 'a suspended collector cannot start a club');
select throws_ok(
  $$select public.transition_meetup((select id from public.meetups where title = 'Club night' and status = 'draft' order by starts_at limit 1), 'schedule')$$,
  'P0001', 'hosting_suspended', 'nor schedule a draft');
select is((select count(*)::int from public.world_host_suspensions), 1, 'a collector reads their own suspension');
select tests.clear_authentication();
select tests.authenticate_as(tests.u('0c'));
select is((select count(*)::int from public.world_host_suspensions), 0, 'nobody else does');
select tests.clear_authentication();

-- ---------- admin: appeal note, lift, manual suspension ----------
select tests.authenticate_as(tests.u('11'));
select is((select appeal_note from public.admin_set_host_suspension('78000000-0000-0000-0000-00000000000a', 'note', 'Appealed by email')),
  'Appealed by email', 'an admin records the appeal note');
select isnt((select lifted_at from public.admin_set_host_suspension('78000000-0000-0000-0000-00000000000a', 'lift', null)), null,
  'an admin lifts the suspension');
select throws_ok($$select public.admin_set_host_suspension('78000000-0000-0000-0000-00000000000a', 'lift', null)$$,
  'P0001', 'not_suspended', 'lifting twice is refused');
select tests.clear_authentication();
select is((select appeal_note from public.world_host_suspensions where user_id = tests.u('0a')), 'Appealed by email',
  'the appeal note survives the lift');
select is((select count(*)::int from public.domain_events where type = 'world.host_reinstated' and entity_id = tests.u('0a')), 1,
  'world.host_reinstated emitted');
select tests.authenticate_as(tests.u('0a'));
select is(public.world_host_ineligible_reason(), 'host_recent_report', 'after the lift the 90-day rule still applies');
select tests.clear_authentication();
update public.feature_flags set enabled = true, audience = '{}'::jsonb where key = 'world_meetups';
select tests.authenticate_as(tests.u('11'));
select is((select reason from public.admin_set_host_suspension('78000000-0000-0000-0000-00000000000b', 'suspend', 'Spam meetups')),
  'admin', 'an admin suspends hosting by hand');
select tests.clear_authentication();
select is((select count(*)::int from public.notifications where user_id = tests.u('0b') and type = 'hosting_suspended'), 1,
  'with the World open for them, the collector is notified');

select * from finish();
rollback;
