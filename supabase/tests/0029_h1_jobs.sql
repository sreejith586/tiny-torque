-- pgTAP for 0011_h1_jobs (MV-S9-01, F-19 / F-02 / D-080 / D-058 / D-095, D-009, D-021).
-- run_h1_job: backend / direct-session only, unknown job refused, 'all' runs the four SQL jobs in
-- order and logs one job_runs row each; expire_listings flips only active listings past expires_at
-- (event + seller notification); expire_offers flips only pending offers past expires_at (event +
-- buyer notification, decline_reason = expired); purge_trash hard-deletes items soft-deleted ≥ 30 d
-- ago and marks their media removed (hard item.deleted event); ensure_event_partitions is
-- idempotent; the Edge-side batch / done RPCs for purge_media / purge_accounts are backend-only;
-- deleting the auth.users row leaves the anonymised profile tombstone (FK dropped); record_job_run
-- / job_runs_recent_errors; a failing job is recorded and does not stop the others.

begin;
select plan(55);

insert into auth.users (id) values
  ('91000000-0000-0000-0000-00000000000a'),
  ('91000000-0000-0000-0000-00000000000b'),
  ('91000000-0000-0000-0000-00000000000c'),
  ('91000000-0000-0000-0000-00000000000d'),
  ('91000000-0000-0000-0000-00000000000e');
insert into public.profiles (id, display_name, account_type, handle, plan, role, country_code, deleted_at) values
  ('91000000-0000-0000-0000-00000000000a', 'Seller',  'individual', 'h_seller',  'free', 'user',  'AE', null),
  ('91000000-0000-0000-0000-00000000000b', 'Buyer',   'individual', 'h_buyer',   'free', 'user',  'IN', null),
  ('91000000-0000-0000-0000-00000000000c', 'Admin',   'individual', 'h_admin',   'free', 'admin', 'IN', null),
  ('91000000-0000-0000-0000-00000000000d', 'Deleted collector', 'individual', 'h_gone',  'free', 'user', 'AE', now() - interval '10 days'),
  ('91000000-0000-0000-0000-00000000000e', 'Deleted collector', 'individual', 'h_fresh', 'free', 'user', 'AE', now() - interval '2 days');

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
create or replace function tests.authenticate_backend() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end; $$;
create or replace function tests.clear_authentication() returns void language plpgsql as $$
begin
  perform set_config('role', 'supabase_admin', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;
create or replace function tests.h1_cron_jobs() returns integer language plpgsql as $$
declare n integer;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return -1; end if;
  execute $q$ select count(*)::int from cron.job where jobname like 'h1\_%' $q$ into n;
  return n;
end; $$;
grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------- fixtures ----------
-- Listings: L1 active + past expiry (expires), L2 active + future, L3 reserved + past (untouched).
insert into public.marketplace_listings (id, seller_id, brand, model, status, price, open_to_offers, expires_at) values
  ('91000000-0000-0000-0000-0000000000f1', '91000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Skyline', 'active',   100, true, now() - interval '1 hour'),
  ('91000000-0000-0000-0000-0000000000f2', '91000000-0000-0000-0000-00000000000a', 'Matchbox',   'Mini',    'active',   80,  true, now() + interval '30 days'),
  ('91000000-0000-0000-0000-0000000000f3', '91000000-0000-0000-0000-00000000000a', 'Tomica',     'Civic',   'reserved', 60,  true, now() - interval '2 days');
-- Offers: O1 pending + past (expires), O2 pending + future, O3 accepted + past (untouched).
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, status, expires_at) values
  ('91000000-0000-0000-0000-0000000000e1', '91000000-0000-0000-0000-0000000000f2', '91000000-0000-0000-0000-00000000000b', '91000000-0000-0000-0000-00000000000a', 'cash', 70, 'pending',  now() - interval '5 minutes'),
  ('91000000-0000-0000-0000-0000000000e2', '91000000-0000-0000-0000-0000000000f1', '91000000-0000-0000-0000-00000000000b', '91000000-0000-0000-0000-00000000000a', 'cash', 90, 'pending',  now() + interval '48 hours'),
  ('91000000-0000-0000-0000-0000000000e3', '91000000-0000-0000-0000-0000000000f3', '91000000-0000-0000-0000-00000000000b', '91000000-0000-0000-0000-00000000000a', 'cash', 55, 'accepted', now() - interval '3 days');
-- Items: I1 in the trash 40 d (purged), I2 in the trash 5 d, I3 live.
insert into public.collection_items (id, owner_id, brand, model, qty) values
  ('91000000-0000-0000-0000-0000000000a1', '91000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Old', 1),
  ('91000000-0000-0000-0000-0000000000a2', '91000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Recent', 1),
  ('91000000-0000-0000-0000-0000000000a3', '91000000-0000-0000-0000-00000000000a', 'Hot Wheels', 'Live', 1);
update public.collection_items set deleted_at = now() - interval '40 days' where id = '91000000-0000-0000-0000-0000000000a1';
update public.collection_items set deleted_at = now() - interval '5 days'  where id = '91000000-0000-0000-0000-0000000000a2';
-- Media: M1 ready on I1 (→ removed by purge_trash), M2 already removed (→ purge_media batch), M3 ready on I3.
insert into public.media (id, owner_id, kind, entity_id, bucket, path, status) values
  ('91000000-0000-0000-0000-0000000000d1', '91000000-0000-0000-0000-00000000000a', 'item', '91000000-0000-0000-0000-0000000000a1', 'item-media', '91000000-0000-0000-0000-00000000000a/old.jpg',  'ready'),
  ('91000000-0000-0000-0000-0000000000d2', '91000000-0000-0000-0000-00000000000d', 'avatar', null,                                   'profile-media', '91000000-0000-0000-0000-00000000000d/avatar.jpg', 'removed'),
  ('91000000-0000-0000-0000-0000000000d3', '91000000-0000-0000-0000-00000000000a', 'item', '91000000-0000-0000-0000-0000000000a3', 'item-media', '91000000-0000-0000-0000-00000000000a/live.jpg', 'ready');

-- ---------- who may run jobs ----------
select tests.authenticate_anon();
select throws_ok($$select * from public.run_h1_job('all')$$, '42501', null, 'anon cannot run H1 jobs');
select tests.authenticate_as('91000000-0000-0000-0000-00000000000a');
select throws_ok($$select * from public.run_h1_job('all')$$, '42501', null, 'authenticated cannot run H1 jobs');
select throws_ok($$select public.expire_listings()$$, '42501', null, 'authenticated cannot call expire_listings directly');
select throws_ok($$select public.expire_offers()$$, '42501', null, 'authenticated cannot call expire_offers directly');
select throws_ok($$select public.purge_trash()$$, '42501', null, 'authenticated cannot call purge_trash directly');
select throws_ok($$select public.ensure_event_partitions()$$, '42501', null, 'authenticated cannot call ensure_event_partitions directly');
select tests.authenticate_as('91000000-0000-0000-0000-00000000000c');
select throws_ok($$select * from public.run_h1_job('all')$$, '42501', null, 'an admin JWT cannot run H1 jobs either (Edge Function / psql is the admin path)');
select tests.authenticate_backend();
select throws_ok($$select * from public.run_h1_job('quest_reset')$$, 'P0001', 'unknown_job', 'a World job name is refused by the H1 dispatcher');
select tests.clear_authentication();

-- ---------- 'all' from a direct session: four jobs, four rows ----------
create temp table h1run1 as select * from public.run_h1_job('all', now());
select is((select count(*)::int from h1run1), 4, 'all = four job runs');
select is((select string_agg(job, ',' order by id) from h1run1),
  'expire_listings,expire_offers,purge_trash,ensure_event_partitions', 'the four jobs run in the documented order');
select is((select count(*)::int from h1run1 where status = 'ok' and finished_at is not null), 4, 'every job finished ok');
select is((select distinct triggered_by from h1run1), 'cron', 'a direct session with no JWT is labelled cron');

-- expire_listings
select is((select result from h1run1 where job = 'expire_listings'), '{"expired": 1}'::jsonb, 'one listing expired');
select is((select status::text from public.marketplace_listings where id = '91000000-0000-0000-0000-0000000000f1'), 'expired', 'the active listing past its expires_at is now expired');
select is((select string_agg(status::text, ',' order by id) from public.marketplace_listings where id in ('91000000-0000-0000-0000-0000000000f2', '91000000-0000-0000-0000-0000000000f3')),
  'active,reserved', 'the future-dated active listing and the reserved one are untouched');
select is((select count(*)::int from public.domain_events where type = 'listing.expired' and entity = 'listing'
             and entity_id = '91000000-0000-0000-0000-0000000000f1' and actor_id = '91000000-0000-0000-0000-00000000000a'),
  1, 'listing.expired emitted for the seller');
select is((select count(*)::int from public.notifications where type = 'listing_expired'
             and user_id = '91000000-0000-0000-0000-00000000000a' and payload ->> 'listing_id' = '91000000-0000-0000-0000-0000000000f1'),
  1, 'the seller gets one listing_expired notification carrying the listing id');

-- expire_offers
select is((select result from h1run1 where job = 'expire_offers'), '{"expired": 1}'::jsonb, 'one offer expired');
select is((select status::text || ':' || coalesce(decline_reason, '') || ':' || (responded_at is not null)::text
             from public.offers where id = '91000000-0000-0000-0000-0000000000e1'),
  'expired:expired:true', 'the pending offer past its 72 h is expired with decline_reason + responded_at');
select is((select string_agg(status::text, ',' order by id) from public.offers where id in ('91000000-0000-0000-0000-0000000000e2', '91000000-0000-0000-0000-0000000000e3')),
  'pending,accepted', 'the future-dated pending offer and the accepted one are untouched');
select is((select payload ->> 'buyer_id' from public.domain_events where type = 'offer.expired' and entity_id = '91000000-0000-0000-0000-0000000000e1'),
  '91000000-0000-0000-0000-00000000000b', 'offer.expired emitted with the buyer in the payload');
select is((select count(*)::int from public.notifications where type = 'offer_expired'
             and user_id = '91000000-0000-0000-0000-00000000000b' and payload ->> 'offer_id' = '91000000-0000-0000-0000-0000000000e1'),
  1, 'the buyer gets one offer_expired notification carrying the offer id');

-- purge_trash
select is((select result from h1run1 where job = 'purge_trash'), '{"items": 1, "media": 1}'::jsonb, 'one item and its one media row purged');
select is((select string_agg(id::text, ',' order by id) from public.collection_items where owner_id = '91000000-0000-0000-0000-00000000000a'),
  '91000000-0000-0000-0000-0000000000a2,91000000-0000-0000-0000-0000000000a3', 'the 40-day item is gone; the 5-day and the live one remain');
select is((select count(*)::int from public.domain_events where type = 'item.deleted' and entity_id = '91000000-0000-0000-0000-0000000000a1'
             and (payload ->> 'hard')::boolean), 1, 'the hard delete emitted item.deleted {hard: true}');
select is((select status::text from public.media where id = '91000000-0000-0000-0000-0000000000d1'), 'removed', 'the purged item''s media row is marked removed');
select is((select status::text from public.media where id = '91000000-0000-0000-0000-0000000000d3'), 'ready', 'the live item''s media is untouched');

-- ensure_event_partitions (pinned month so the result is deterministic whenever this runs)
select is((select result -> 'created' from public.run_h1_job('ensure_event_partitions', '2031-03-15 00:00+00')),
  '["domain_events_2031_03", "domain_events_2031_04", "domain_events_2031_05"]'::jsonb, 'three missing monthly partitions are created');
select ok(to_regclass('public.domain_events_2031_04') is not null, 'the partition table really exists');
select is((select result -> 'created' from public.run_h1_job('ensure_event_partitions', '2031-03-20 00:00+00')),
  '[]'::jsonb, 'a second run for the same month creates nothing');

-- idempotence of the expiries
create temp table h1run2 as select * from public.run_h1_job('all', now());
select is((select result from h1run2 where job = 'expire_listings'), '{"expired": 0}'::jsonb, 'nothing left to expire (listings)');
select is((select result from h1run2 where job = 'expire_offers'), '{"expired": 0}'::jsonb, 'nothing left to expire (offers)');
select is((select result from h1run2 where job = 'purge_trash'), '{"items": 0, "media": 0}'::jsonb, 'nothing left to purge');

-- ---------- Edge-side RPCs: purge_media ----------
select tests.authenticate_as('91000000-0000-0000-0000-00000000000a');
select throws_ok($$select * from public.h1_purge_media_batch(200)$$, '42501', null, 'a member cannot read the media purge batch');
select throws_ok($$select public.h1_purge_media_done(array['91000000-0000-0000-0000-0000000000d2']::uuid[])$$, '42501', null, 'a member cannot mark media purged');
select tests.authenticate_backend();
select is((select string_agg(id::text, ',' order by id) from public.h1_purge_media_batch(200)),
  '91000000-0000-0000-0000-0000000000d1,91000000-0000-0000-0000-0000000000d2', 'the backend batch lists both removed media rows (bucket + path)');
select is(public.h1_purge_media_done(array['91000000-0000-0000-0000-0000000000d1', '91000000-0000-0000-0000-0000000000d2', '91000000-0000-0000-0000-0000000000d3']::uuid[]),
  2, 'done deletes only the removed rows it was given — the ready one is skipped');
select is((select count(*)::int from public.media where status = 'removed'), 0, 'no removed media rows are left');

-- ---------- Edge-side RPCs: purge_accounts (7-day grace, FK to auth.users gone) ----------
select is((select string_agg(id::text, ',') from public.h1_purge_accounts_batch(now(), 7, 50)),
  '91000000-0000-0000-0000-00000000000d', 'only the account deleted 10 days ago is due; the 2-day-old one waits');
select tests.authenticate_as('91000000-0000-0000-0000-00000000000c');
select throws_ok($$select public.h1_purge_account_done('91000000-0000-0000-0000-00000000000d')$$, '42501', null, 'even an admin JWT cannot mark an account purged');
select tests.authenticate_backend();
select throws_ok($$select public.h1_purge_account_done('91000000-0000-0000-0000-00000000000a')$$, 'P0001', 'not_purgeable', 'a live account cannot be marked purged');
select lives_ok($$select public.h1_purge_account_done('91000000-0000-0000-0000-00000000000d')$$, 'the due account is marked purged');
select is((select count(*)::int from public.domain_events where type = 'user.purged' and entity_id = '91000000-0000-0000-0000-00000000000d'), 1, 'user.purged emitted');
select throws_ok($$select public.h1_purge_account_done('91000000-0000-0000-0000-00000000000d')$$, 'P0001', 'not_purgeable', 'marking it twice is refused');
select is((select count(*)::int from public.h1_purge_accounts_batch(now(), 7, 50)), 0, 'the purged account leaves the batch');
select tests.clear_authentication();
delete from auth.users where id = '91000000-0000-0000-0000-00000000000d';
select is((select display_name || ':' || (purged_at is not null)::text from public.profiles where id = '91000000-0000-0000-0000-00000000000d'),
  'Deleted collector:true', 'deleting the auth.users row leaves the anonymised profile tombstone in place (no cascade)');

-- ---------- record_job_run + job_runs_recent_errors ----------
select tests.authenticate_backend();
select is((select triggered_by || ':' || status from public.record_job_run('purge_media', 'ok', '{"deleted": 2}'::jsonb)),
  'edge:ok', 'an Edge job records its finished run');
select throws_ok($$select public.record_job_run('purge_media', 'running')$$, 'P0001', 'invalid_status', 'only a finished status can be recorded');
select is((select count(*)::int from public.job_runs_recent_errors()), 0, 'no errors recorded yet');
select tests.clear_authentication();

-- ---------- a failing job is recorded and does not block the others ----------
alter function public.ensure_event_partitions(timestamptz, integer) rename to ensure_event_partitions_broken;
create temp table h1run3 as select * from public.run_h1_job('all', now(), 'manual');
select is((select status || ':' || coalesce(left(error, 5), '') from h1run3 where job = 'ensure_event_partitions'), 'error:42883',
  'the broken job is recorded as an error with its SQLSTATE');
select is((select count(*)::int from h1run3 where status = 'ok'), 3, 'the other three jobs still ran');
alter function public.ensure_event_partitions_broken(timestamptz, integer) rename to ensure_event_partitions;
select tests.authenticate_as('91000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.job_runs_recent_errors(interval '1 hour')), 1, 'an admin sees the failed run in the last hour');
select tests.authenticate_as('91000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.job_runs_recent_errors(interval '1 hour')), 0, 'a member sees no job errors');
select is((select count(*)::int from public.job_runs), 0, 'a member sees no job runs');
select tests.clear_authentication();

-- ---------- pg_cron schedules (where the extension exists) ----------
select ok(tests.h1_cron_jobs() in (-1, 4), 'four H1 schedules where pg_cron exists, skipped cleanly where it does not');

select * from finish();
rollback;
