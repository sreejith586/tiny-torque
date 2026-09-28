-- pgTAP RLS matrix for identity_v2 (MV-S1-02, D-013) — owner/stranger/anon/admin ×
-- profiles, public_profiles, invites, feature_flags, domain_events, follows.
-- Run via CI's "pgTAP RLS matrix" job (supabase/postgres image) or `supabase test db` locally.

begin;
select plan(33);

-- ---------- fixtures: 3 users, created as the superuser (bypasses RLS) ----------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');

insert into public.profiles (id, display_name, account_type, handle, role, mobile) values
  ('00000000-0000-0000-0000-00000000000a', 'Owner', 'individual', 'owner_fixture', 'user', '+971500000001'),
  ('00000000-0000-0000-0000-00000000000b', 'Stranger', 'individual', 'stranger_fixture', 'user', '+919000000002'),
  ('00000000-0000-0000-0000-00000000000c', 'Admin', 'individual', 'admin_fixture', 'admin', null);

-- ---------- role-switching helpers ----------
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
  -- supabase_admin, not postgres: it's the actual superuser role in the CI image
  -- (postgres is scoped/non-superuser here), and setup inserts between test sections
  -- need full privilege to bypass RLS the same way the fixture inserts above did.
  perform set_config('role', 'supabase_admin', true);
end;
$$;

-- runs p_sql (expected to be an UPDATE/DELETE) and returns rows actually affected,
-- so an RLS policy that silently filters the target row (rather than raising) is testable
create or replace function tests.exec_and_count(p_sql text) returns integer
language plpgsql as $$
declare
  v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

\set owner '''00000000-0000-0000-0000-00000000000a'''
\set stranger '''00000000-0000-0000-0000-00000000000b'''
\set admin '''00000000-0000-0000-0000-00000000000c'''

-- ================= profiles =================

select tests.authenticate_as(:owner::uuid);
select is((select count(*) from public.profiles)::int, 1, 'profiles: owner sees only their own row');
select is((select mobile from public.profiles where id = :owner::uuid), '+971500000001', 'profiles: owner can read their own mobile');

select is(
  tests.exec_and_count($$update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b'$$),
  0,
  'profiles: owner cannot update a stranger''s row (RLS filters it, 0 rows affected)'
);

select tests.authenticate_as(:stranger::uuid);
select is((select count(*) from public.profiles)::int, 1, 'profiles: stranger sees only their own row');
select is((select count(*) from public.profiles where id = :owner::uuid)::int, 0, 'profiles: stranger cannot see the owner''s row at all');

select tests.authenticate_as_anon();
select is((select count(*) from public.profiles)::int, 0, 'profiles: anon sees no rows');

select tests.authenticate_as(:admin::uuid);
select is((select count(*) from public.profiles)::int, 3, 'profiles: admin sees every row');

select tests.clear_authentication();

-- ================= public_profiles (view) =================

select hasnt_column('public', 'public_profiles', 'mobile', 'public_profiles: never exposes mobile (D-015)');

select tests.authenticate_as(:stranger::uuid);
select is((select count(*) from public.public_profiles)::int, 3, 'public_profiles: stranger can read every profile''s public columns');
select is(
  (select display_name from public.public_profiles where id = :owner::uuid),
  'Owner',
  'public_profiles: stranger reads the owner''s display_name via the view'
);

-- regression test for the write-through-view bypass found in self-review: the view must not
-- be writable by anon/authenticated, since that would silently bypass the RLS above
select throws_ok(
  $$update public.public_profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501',
  'public_profiles: UPDATE is rejected (no write-through to profiles)'
);
select throws_ok(
  $$delete from public.public_profiles where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501',
  'public_profiles: DELETE is rejected (no write-through to profiles)'
);

select tests.authenticate_as_anon();
select is((select count(*) from public.public_profiles)::int, 3, 'public_profiles: anon can also read every profile''s public columns');

select tests.clear_authentication();

-- ================= invites =================

insert into public.invites (code, cohort) values ('WELCOME1', 'founders');

select tests.authenticate_as(:owner::uuid);
select is((select count(*) from public.invites)::int, 0, 'invites: non-admin sees no rows');
select throws_ok(
  $$insert into public.invites (code) values ('SHOULDFAIL')$$,
  '42501',
  'invites: non-admin insert is rejected'
);

select tests.authenticate_as_anon();
select is((select count(*) from public.invites)::int, 0, 'invites: anon sees no rows');

select tests.authenticate_as(:admin::uuid);
select is((select count(*) from public.invites)::int, 1, 'invites: admin sees the seeded invite');
select lives_ok(
  $$insert into public.invites (code) values ('ADMINCODE')$$,
  'invites: admin insert succeeds'
);

select tests.clear_authentication();

-- ================= feature_flags =================

insert into public.feature_flags (key, enabled) values ('csv_import', false);

select tests.authenticate_as(:stranger::uuid);
select is((select count(*) from public.feature_flags)::int, 1, 'feature_flags: any authenticated user can read flags');
select throws_ok(
  $$update public.feature_flags set enabled = true where key = 'csv_import'$$,
  '42501',
  'feature_flags: non-admin update is rejected'
);
select throws_ok(
  $$insert into public.feature_flags (key) values ('should_fail')$$,
  '42501',
  'feature_flags: non-admin insert is rejected'
);

select tests.authenticate_as_anon();
select is((select count(*) from public.feature_flags)::int, 1, 'feature_flags: anon can read flags too (public read, D-018)');

select tests.authenticate_as(:admin::uuid);
select lives_ok(
  $$update public.feature_flags set enabled = true where key = 'csv_import'$$,
  'feature_flags: admin update succeeds'
);

select tests.clear_authentication();

-- ================= domain_events =================

select tests.authenticate_as(:owner::uuid);
select lives_ok(
  $$insert into public.domain_events (type, entity, entity_id, actor_id) values ('user.signed_up', 'profile', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a')$$,
  'domain_events: authenticated user can log an event as themselves'
);
select throws_ok(
  $$insert into public.domain_events (type, entity, actor_id) values ('user.signed_up', 'profile', '00000000-0000-0000-0000-00000000000b')$$,
  '42501',
  'domain_events: cannot log an event impersonating another actor'
);
-- 03-data-model.md §2.21: "read admin only" — even the actor who logged it can't read it back
select is((select count(*) from public.domain_events)::int, 0, 'domain_events: owner cannot read even their own logged event back');

select tests.authenticate_as_anon();
select throws_ok(
  $$insert into public.domain_events (type, entity) values ('user.signed_up', 'profile')$$,
  '42501',
  'domain_events: anon cannot log events'
);

select tests.authenticate_as(:admin::uuid);
select is((select count(*) from public.domain_events)::int, 1, 'domain_events: admin can read all logged events');

select tests.clear_authentication();

-- ================= follows =================

select tests.authenticate_as(:owner::uuid);
select lives_ok(
  $$insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')$$,
  'follows: user can follow another user as themselves'
);
select throws_ok(
  $$insert into public.follows (follower_id, followee_id) values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c')$$,
  '42501',
  'follows: cannot create a follow row impersonating another follower'
);

select tests.authenticate_as(:stranger::uuid);
select is((select count(*) from public.follows)::int, 1, 'follows: any authenticated user can read the follow graph (dormant, see PROGRESS.md blockers)');
select is(
  tests.exec_and_count($$delete from public.follows where follower_id = '00000000-0000-0000-0000-00000000000a'$$),
  0,
  'follows: stranger cannot delete someone else''s follow row'
);

select tests.authenticate_as(:owner::uuid);
select is(
  tests.exec_and_count($$delete from public.follows where follower_id = '00000000-0000-0000-0000-00000000000a'$$),
  1,
  'follows: owner can delete their own follow row'
);

select tests.clear_authentication();

select * from finish();
rollback;
