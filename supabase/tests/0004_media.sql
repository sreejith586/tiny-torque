-- pgTAP RLS matrix for media (MV-S2-01, D-013) — owner/stranger/anon/admin × media rows that
-- back a public vs a private collection_item. Run via CI's "pgTAP RLS matrix" job.

begin;
select plan(12);

-- ---------- fixtures (superuser, bypasses RLS) ----------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');

insert into public.profiles (id, display_name, account_type, handle, role, mobile) values
  ('00000000-0000-0000-0000-00000000000a', 'Owner', 'individual', 'owner_media', 'user', '+971500000001'),
  ('00000000-0000-0000-0000-00000000000b', 'Stranger', 'individual', 'stranger_media', 'user', '+919000000002'),
  ('00000000-0000-0000-0000-00000000000c', 'Admin', 'individual', 'admin_media', 'admin', null);

insert into public.collection_items (id, owner_id, brand, is_public) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'Hot Wheels', true),  -- public
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'Matchbox', false);   -- private

insert into public.media (id, owner_id, kind, entity_id, bucket, path, status) values
  ('20000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'item', '10000000-0000-0000-0000-0000000000a1', 'item-media', '00000000-0000-0000-0000-00000000000a/pub.jpg', 'ready'),
  ('20000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000a', 'item', '10000000-0000-0000-0000-0000000000a2', 'item-media', '00000000-0000-0000-0000-00000000000a/priv.jpg', 'ready');

-- ---------- role-switching helpers (match 0002) ----------
create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.authenticate_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
end; $$;
create or replace function tests.exec_and_count(p_sql text) returns integer language plpgsql as $$
declare v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- ---------- owner ----------
select tests.authenticate_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.media), 2, 'owner sees both of their media rows');
select is(tests.exec_and_count($$insert into public.media (owner_id, kind, entity_id, bucket, path, status) values ('00000000-0000-0000-0000-00000000000a','item','10000000-0000-0000-0000-0000000000a1','item-media','00000000-0000-0000-0000-00000000000a/extra.jpg','ready')$$), 1, 'owner can insert own media');
select is(tests.exec_and_count($$update public.media set status='flagged' where id='20000000-0000-0000-0000-0000000000d1'$$), 1, 'owner can update own media');
select is(tests.exec_and_count($$delete from public.media where path='00000000-0000-0000-0000-00000000000a/extra.jpg'$$), 1, 'owner can delete own media');

-- ---------- stranger ----------
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.media), 1, 'stranger sees only the public item''s media');
select is((select count(*)::int from public.media where entity_id='10000000-0000-0000-0000-0000000000a2'), 0, 'stranger cannot see private item media');
select is(tests.exec_and_count($$delete from public.media where id='20000000-0000-0000-0000-0000000000d2'$$), 0, 'stranger cannot delete other users media');
select throws_ok($$insert into public.media (owner_id, kind, entity_id, bucket, path, status) values ('00000000-0000-0000-0000-00000000000a','item','10000000-0000-0000-0000-0000000000a1','item-media','x/y.jpg','ready')$$, '42501', null, 'stranger cannot insert media owned by someone else');

-- ---------- anon ----------
select tests.clear_authentication();
select tests.authenticate_as_anon();
select is((select count(*)::int from public.media), 1, 'anon sees only public item media');
select is((select count(*)::int from public.media where entity_id='10000000-0000-0000-0000-0000000000a1'), 1, 'anon can read the public item''s media');
select is((select count(*)::int from public.media where entity_id='10000000-0000-0000-0000-0000000000a2'), 0, 'anon cannot read private item media');

-- ---------- admin ----------
select tests.clear_authentication();
select tests.authenticate_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.media), 2, 'admin sees all media');

select * from finish();
rollback;
