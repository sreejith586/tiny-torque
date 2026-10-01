-- pgTAP for garage_v2 (MV-S2-03, D-013) — the generated full-text `search` column + the new
-- columns exist and behave. Run via CI's "pgTAP RLS matrix" job.

begin;
select plan(5);

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.profiles (id, display_name, account_type, handle, role)
  values ('00000000-0000-0000-0000-0000000000a1', 'Tester', 'individual', 'garage_v2_probe', 'user');

insert into public.collection_items (id, owner_id, brand, model, color, is_favorite)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1',
          'Hot Wheels', 'Skyline GT-R', 'Bayside Blue', true);

select ok(
  (select search is not null from public.collection_items where id = '00000000-0000-0000-0000-0000000000c1'),
  'search vector is populated'
);
select is(
  (select count(*)::int from public.collection_items where id = '00000000-0000-0000-0000-0000000000c1' and search @@ to_tsquery('simple', 'skyline')),
  1, 'search matches a model term'
);
select is(
  (select count(*)::int from public.collection_items where id = '00000000-0000-0000-0000-0000000000c1' and search @@ to_tsquery('simple', 'bayside')),
  1, 'search matches a color term'
);
select is(
  (select count(*)::int from public.collection_items where id = '00000000-0000-0000-0000-0000000000c1' and search @@ to_tsquery('simple', 'ferrari')),
  0, 'search does not match an absent term'
);
select is(
  (select is_favorite from public.collection_items where id = '00000000-0000-0000-0000-0000000000c1'),
  true, 'is_favorite persists'
);

select * from finish();
rollback;
