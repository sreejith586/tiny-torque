-- pgTAP — MV-S11-01/04 (F-01, D-016): the invite gate. redeem_invite is idempotent per collector
-- and case-insensitive, invite_redemptions is private, and onboarding (a profiles insert through
-- the API) needs a redeemed invite while `invite_only` is on.

begin;
select plan(20);

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

insert into auth.users (id) values
  ('c3000000-0000-0000-0000-00000000000a'),
  ('c3000000-0000-0000-0000-00000000000b'),
  ('c3000000-0000-0000-0000-00000000000c'),
  ('c3000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, display_name, account_type, handle, role) values
  ('c3000000-0000-0000-0000-00000000000d', 'Gate admin', 'individual', 'ig_admin', 'admin');
insert into public.invites (code, max_uses, cohort) values
  ('TT-ONE1-SEAT', 1, 'uae-collectors'),
  ('TT-TWO2-SEAT', 2, 'india-shops');
update public.feature_flags set enabled = true, audience = '{}'::jsonb where key = 'invite_only';

-- ---------- the gate ----------
select tests.authenticate_as('c3000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$insert into public.profiles (id, display_name, account_type, handle) values ('c3000000-0000-0000-0000-00000000000a', 'No code', 'individual', 'ig_nocode')$$,
  '42501', 'invite_required', 'invite_only ON: onboarding without a redeemed invite is refused by the database');

-- ---------- redeem: forgiving about case and spaces ----------
select lives_ok($$select public.redeem_invite(' tt-one1-seat ')$$, 'a code typed in lower case with spaces redeems');
select is((select cohort from public.invite_redemptions), 'uae-collectors', 'the collector sees their own redemption with its cohort');
select tests.clear_authentication();
select is((select used_count from public.invites where code = 'TT-ONE1-SEAT'), 1, 'one seat spent');

-- ---------- idempotent: closing the tab mid-onboarding does not lock the collector out ----------
select tests.authenticate_as('c3000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.redeem_invite('TT-ONE1-SEAT')$$, 're-entering the same (now full) code succeeds');
select lives_ok($$select public.redeem_invite('TT-TWO2-SEAT')$$, 'entering a second valid code is a no-op');
select throws_ok($$select public.redeem_invite('TT-NOPE-NOPE')$$, 'P0001', 'Invalid invite code', 'an unknown code is still rejected');
select tests.clear_authentication();
select is(
  (select array[(select used_count from public.invites where code = 'TT-ONE1-SEAT'),
                (select used_count from public.invites where code = 'TT-TWO2-SEAT'),
                (select count(*)::int from public.invite_redemptions where user_id = 'c3000000-0000-0000-0000-00000000000a'),
                (select count(*)::int from public.domain_events where type = 'invite.redeemed' and actor_id = 'c3000000-0000-0000-0000-00000000000a')]),
  array[1, 0, 1, 0], 'no extra seat or redemption row from the repeats; no event yet (no profile to hang it on)');

-- ---------- onboarding passes after redemption ----------
select tests.authenticate_as('c3000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$insert into public.profiles (id, display_name, account_type, handle) values ('c3000000-0000-0000-0000-00000000000a', 'Invited', 'individual', 'ig_invited')$$,
  'with a redeemed invite the same insert succeeds');

select tests.clear_authentication();
select is(
  (select payload ->> 'cohort' from public.domain_events
    where type = 'invite.redeemed' and actor_id = 'c3000000-0000-0000-0000-00000000000a'),
  'uae-collectors', 'invite.redeemed is logged exactly once, when the profile is created, with the cohort');

-- ---------- a full code stays closed to others ----------
select tests.authenticate_as('c3000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.redeem_invite('TT-ONE1-SEAT')$$, 'P0001', 'Invite code already used', 'a one-seat code works for one collector only');
select is((select count(*)::int from public.invite_redemptions), 0, 'another collector cannot see who redeemed what');
select throws_ok(
  $$insert into public.invite_redemptions (user_id, code) values ('c3000000-0000-0000-0000-00000000000b', 'TT-TWO2-SEAT')$$,
  '42501', null, 'a collector cannot write a redemption row themselves');

-- ---------- anon ----------
select tests.clear_authentication();
select set_config('role', 'anon', true);
select throws_ok($$select public.redeem_invite('TT-TWO2-SEAT')$$, '28000', null, 'redeem_invite refuses a caller who is not signed in');
select throws_ok($$select count(*) from public.invite_redemptions$$, '42501', null, 'anon cannot read invite_redemptions');
select tests.clear_authentication();

-- ---------- admin + non-API writers ----------
select tests.authenticate_as('c3000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.invite_redemptions where cohort = 'uae-collectors'), 1, 'an admin reads redemptions (cohort reporting)');
select tests.clear_authentication();
select lives_ok(
  $$insert into public.profiles (id, display_name, account_type, handle) values ('c3000000-0000-0000-0000-00000000000c', 'Seeded', 'individual', 'ig_seeded')$$,
  'seeds / psql / definer code create profiles without a code even while invite_only is ON');

-- ---------- gate off ----------
update public.feature_flags set enabled = false where key = 'invite_only';
select tests.authenticate_as('c3000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$insert into public.profiles (id, display_name, account_type, handle) values ('c3000000-0000-0000-0000-00000000000b', 'Open', 'individual', 'ig_open')$$,
  'invite_only OFF: onboarding needs no code');
select tests.clear_authentication();

-- ---------- backfill shape ----------
select has_index('public', 'invite_redemptions', 'invite_redemptions_cohort_idx', 'cohort index for the weekly report');
select col_is_pk('public', 'invite_redemptions', 'user_id', 'one redemption per collector, ever');

select * from finish();
rollback;
