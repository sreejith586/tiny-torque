-- pgTAP tests for identity_rpcs (MV-S1-05, D-013/D-021) — redeem_invite() atomicity + emit_event().
-- Run via CI's "pgTAP RLS matrix" job (supabase/postgres image) or `supabase test db` locally.

begin;
select plan(10);

-- ---------- fixtures ----------
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000aa');
insert into public.profiles (id, display_name, account_type, handle, role) values
  ('00000000-0000-0000-0000-0000000000aa', 'Redeemer', 'individual', 'redeemer_fixture', 'user');

insert into public.invites (code, max_uses, used_count, cohort) values ('GOODCODE', 2, 0, 'founders');
insert into public.invites (code, max_uses, used_count, cohort) values ('USEDUP', 1, 1, 'founders');
insert into public.invites (code, max_uses, used_count, expires_at, cohort) values ('EXPIRED', 5, 0, now() - interval '1 day', 'founders');

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create or replace function tests.authenticate_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end;
$$;
create or replace function tests.clear_authentication() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'supabase_admin', true);
end;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

\set redeemer '''00000000-0000-0000-0000-0000000000aa'''

-- ---------- redeem_invite ----------
select tests.authenticate_as_anon();
select throws_ok(
  $$select public.redeem_invite('GOODCODE')$$,
  '28000',
  null,
  'redeem_invite: unauthenticated callers are rejected'
);

select tests.authenticate_as(:redeemer::uuid);

select lives_ok(
  $$select public.redeem_invite('GOODCODE')$$,
  'redeem_invite: a valid, unused code redeems successfully'
);
select is(
  (select used_count from public.invites where code = 'GOODCODE'),
  1,
  'redeem_invite: used_count increments atomically'
);
select is(
  (select count(*)::int from public.domain_events where type = 'invite.redeemed' and actor_id = :redeemer::uuid),
  1,
  'redeem_invite: emits an invite.redeemed domain event via emit_event()'
);
select is(
  (select (payload->>'code') from public.domain_events where type = 'invite.redeemed' and actor_id = :redeemer::uuid),
  'GOODCODE',
  'redeem_invite: the logged event payload carries the redeemed code'
);

select throws_ok(
  $$select public.redeem_invite('NOSUCHCODE')$$,
  'P0001',
  null,
  'redeem_invite: an unknown code is rejected'
);
select throws_ok(
  $$select public.redeem_invite('USEDUP')$$,
  'P0001',
  null,
  'redeem_invite: a code already at max_uses is rejected'
);
select throws_ok(
  $$select public.redeem_invite('EXPIRED')$$,
  'P0001',
  null,
  'redeem_invite: an expired code is rejected'
);

-- redeeming GOODCODE a second time is allowed by design (max_uses=2, no per-user tracking column
-- in the invites schema, F-01/03 §2.23) -- confirms the cap, not per-user dedup, is what's enforced
select lives_ok(
  $$select public.redeem_invite('GOODCODE')$$,
  'redeem_invite: the same code can be redeemed again up to max_uses'
);
select throws_ok(
  $$select public.redeem_invite('GOODCODE')$$,
  'P0001',
  null,
  'redeem_invite: the third attempt hits max_uses and is rejected'
);

select tests.clear_authentication();

select * from finish();
rollback;
