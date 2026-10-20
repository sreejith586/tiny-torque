-- pgTAP for gamification + profile completeness (MV-S8-01/02/04/05, F-13/F-14, D-013). The item
-- event triggers, the xp/level guard, gamification_events' per-user scoping, apply_gamification's
-- idempotent unlocks + notification, feedback RLS, the public_profiles media columns, and
-- delete_account's cascade. Run via CI's pgTAP job.

begin;
select plan(22);

insert into auth.users (id) values
  ('83000000-0000-0000-0000-00000000000a'),
  ('83000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, display_name, account_type, handle, plan, role, mobile, bio) values
  ('83000000-0000-0000-0000-00000000000a', 'Gamer', 'individual', 'g_gamer', 'free', 'user', '+971500000001', 'hello'),
  ('83000000-0000-0000-0000-00000000000b', 'Other', 'individual', 'g_other', 'free', 'user', null, null);

create schema if not exists tests;
create or replace function tests.authenticate_as(p_user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin perform set_config('role', 'supabase_admin', true); perform set_config('request.jwt.claim.sub', '', true); end; $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------- reference seed ----------
select is((select count(*)::int from public.achievements), 5, 'the five badges are seeded (03 §2.18)');

-- ---------- item.created / item.photo_added triggers (rule 9) ----------
select tests.authenticate_as('83000000-0000-0000-0000-00000000000a');
insert into public.collection_items (id, owner_id, brand, model, qty)
  values ('83000000-0000-0000-0000-0000000000a1', '83000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Skyline', 1);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.domain_events
    where type = 'item.created' and entity_id = '83000000-0000-0000-0000-0000000000a1'
      and actor_id = '83000000-0000-0000-0000-00000000000a'),
  1, 'inserting a collection item emits item.created for its owner'
);
insert into public.media (owner_id, kind, entity_id, bucket, path, status) values
  ('83000000-0000-0000-0000-00000000000a', 'item', '83000000-0000-0000-0000-0000000000a1', 'item-media', '83000000-0000-0000-0000-00000000000a/a1/1.jpg', 'ready'),
  ('83000000-0000-0000-0000-00000000000a', 'item', '83000000-0000-0000-0000-0000000000a1', 'item-media', '83000000-0000-0000-0000-00000000000a/a1/2.jpg', 'ready');
select is(
  (select count(*)::int from public.domain_events
    where type = 'item.photo_added' and entity_id = '83000000-0000-0000-0000-0000000000a1'),
  1, 'only the FIRST photo on an item emits item.photo_added'
);

-- ---------- xp/level are read-only outside apply_gamification ----------
select tests.authenticate_as('83000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$update public.profiles set xp = 9999 where id = '83000000-0000-0000-0000-00000000000a'$$,
  '42501', 'xp_level_read_only', 'a user cannot write their own xp directly'
);
select lives_ok(
  $$update public.profiles set bio = 'still editable' where id = '83000000-0000-0000-0000-00000000000a'$$,
  'other profile columns stay editable by the owner'
);

-- ---------- gamification_events is scoped to the caller ----------
select is(
  (select count(*)::int from public.gamification_events() where type = 'item.created'),
  1, 'the owner sees their own item.created event through gamification_events()'
);
select tests.clear_authentication();
select tests.authenticate_as('83000000-0000-0000-0000-00000000000b');
select is(
  (select count(*)::int from public.gamification_events('83000000-0000-0000-0000-00000000000a')),
  0, 'another user asking for someone else''s events gets nothing'
);

-- ---------- apply_gamification: writes, events, unlock + notification, idempotent ----------
select tests.clear_authentication();
select tests.authenticate_as('83000000-0000-0000-0000-00000000000a');
select is(
  (select public.apply_gamification('83000000-0000-0000-0000-00000000000a', 15, 1,
     '[{"key":"first_add","progress":1,"unlocked":true},{"key":"growing_garage","progress":1,"unlocked":false}]'::jsonb)
     -> 'newly_unlocked'),
  '["first_add"]'::jsonb, 'apply_gamification returns the newly unlocked badge keys'
);
select is(
  (select xp from public.profiles where id = '83000000-0000-0000-0000-00000000000a'),
  15, 'xp is written through the RPC'
);
select is(
  (select count(*)::int from public.domain_events
    where type = 'xp.granted' and actor_id = '83000000-0000-0000-0000-00000000000a'),
  1, 'an xp.granted event is emitted for the delta'
);
select isnt(
  (select unlocked_at from public.user_achievements
    where user_id = '83000000-0000-0000-0000-00000000000a' and achievement_key = 'first_add'),
  null, 'first_add is unlocked'
);
select is(
  (select progress from public.user_achievements
    where user_id = '83000000-0000-0000-0000-00000000000a' and achievement_key = 'growing_garage'),
  1, 'progress is stored for a badge that is not yet unlocked'
);
select is(
  (select count(*)::int from public.notifications
    where user_id = '83000000-0000-0000-0000-00000000000a' and type = 'badge_unlocked'),
  1, 'a badge_unlocked notification is created for the unlock'
);
select is(
  (select public.apply_gamification('83000000-0000-0000-0000-00000000000a', 15, 1,
     '[{"key":"first_add","progress":1,"unlocked":true}]'::jsonb) -> 'newly_unlocked'),
  '[]'::jsonb, 'replaying the same state unlocks nothing new (idempotent)'
);
select is(
  (select count(*)::int from public.notifications
    where user_id = '83000000-0000-0000-0000-00000000000a' and type = 'badge_unlocked'),
  1, 'and creates no second notification'
);
select is(
  (select count(*)::int from public.domain_events
    where type = 'xp.granted' and actor_id = '83000000-0000-0000-0000-00000000000a'),
  1, 'and emits no second xp.granted when xp is unchanged'
);

-- another user cannot apply state to this user
select tests.clear_authentication();
select tests.authenticate_as('83000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.apply_gamification('83000000-0000-0000-0000-00000000000a', 1000, 6, '[]'::jsonb)$$,
  '42501', 'not_authorized', 'a user cannot apply gamification state to someone else'
);
select is(
  (select count(*)::int from public.user_achievements where user_id = '83000000-0000-0000-0000-00000000000a'),
  0, 'a user cannot read another user''s achievement progress'
);

-- ---------- feedback RLS ----------
select lives_ok(
  $$insert into public.feedback (user_id, kind, message, page)
      values ('83000000-0000-0000-0000-00000000000b', 'idea', 'More badges please', '/settings')$$,
  'a user can submit feedback as themselves'
);
select throws_ok(
  $$insert into public.feedback (user_id, kind, message)
      values ('83000000-0000-0000-0000-00000000000a', 'bug', 'spoofed')$$,
  '42501', null, 'a user cannot submit feedback as someone else'
);

-- ---------- public_profiles exposes the media ids (F-14 banner/avatar) ----------
select tests.clear_authentication();
select has_column('public', 'public_profiles', 'banner_media_id', 'public_profiles has banner_media_id');
select has_column('public', 'public_profiles', 'avatar_media_id', 'public_profiles has avatar_media_id');

-- ---------- delete_account cascade ----------
select tests.authenticate_as('83000000-0000-0000-0000-00000000000a');
select public.delete_account();
select tests.clear_authentication();
select is(
  (select display_name || '|' || coalesce(mobile, '-') || '|' || coalesce(bio, '-') || '|' || (deleted_at is not null)::text
     from public.profiles where id = '83000000-0000-0000-0000-00000000000a'),
  'Deleted collector|-|-|true', 'delete_account anonymises PII and soft-deletes the profile'
);
select is(
  (select count(*)::int from public.collection_items
    where owner_id = '83000000-0000-0000-0000-00000000000a' and deleted_at is null),
  0, 'delete_account soft-deletes every collection item'
);

select * from finish();
rollback;
