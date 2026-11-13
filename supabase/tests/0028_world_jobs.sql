-- pgTAP for 0014d_world_jobs (MV-W04-04, F-26, D-070 / D-071, D-009).
-- run_world_job: backend / direct-session only (anon, authenticated and even an admin JWT are
-- refused; the admin path is the Edge Function `jobs` or psql), unknown job refused, 'all' runs the
-- five jobs in order and writes one job_runs row each; every job is idempotent on a second run at
-- the same p_at (quest.reset once per window, the T-14 d notice once per batch, expiry once,
-- season.started once); a failing job is recorded as status = error and does not stop the others;
-- job_runs is admin-read-only and never client-writable; the pg_cron schedules exist wherever the
-- extension does. Ledger rows are created through credit_tokens as the backend, then backdated.

begin;
select plan(41);

insert into auth.users (id) values
  ('76000000-0000-0000-0000-00000000000a'),
  ('76000000-0000-0000-0000-00000000000b'),
  ('76000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, display_name, account_type, handle, plan, role, tokens, level, country_code) values
  ('76000000-0000-0000-0000-00000000000a', 'Earner', 'individual', 'j_earner', 'free', 'user',  0, 1, 'AE'),
  ('76000000-0000-0000-0000-00000000000b', 'Buyer',  'individual', 'j_buyer',  'free', 'user',  0, 1, 'IN'),
  ('76000000-0000-0000-0000-00000000000c', 'Admin',  'individual', 'j_admin',  'free', 'admin', 0, 1, 'IN');

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
-- pg_cron may be absent (plain Postgres): count the World schedules only where the schema exists.
create or replace function tests.world_cron_jobs() returns integer language plpgsql as $$
declare n integer;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return -1; end if;
  execute $q$ select count(*)::int from cron.job where jobname like 'world\_%' $q$ into n;
  return n;
end; $$;
grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------- ledger fixture: three earned credits + one purchased, backdated ----------
select tests.authenticate_backend();
select public.credit_tokens('76000000-0000-0000-0000-00000000000a', 5, 'earn_quest', null, null, 'j:a:soon');    -- expires in 10 d
select public.credit_tokens('76000000-0000-0000-0000-00000000000a', 3, 'earn_daily', null, null, 'j:a:later');   -- expires in 80 d
select public.credit_tokens('76000000-0000-0000-0000-00000000000a', 4, 'earn_quest', null, null, 'j:a:old');     -- past 180 d
select public.credit_tokens('76000000-0000-0000-0000-00000000000b', 50, 'purchase',  null, null, 'j:b:pack');    -- never expires
select tests.clear_authentication();
update public.token_ledger set created_at = now() - interval '170 days' where idempotency_key in ('j:a:soon', 'j:b:pack');
update public.token_ledger set created_at = now() - interval '100 days' where idempotency_key = 'j:a:later';
update public.token_ledger set created_at = now() - interval '200 days' where idempotency_key = 'j:a:old';

-- ---------- who may run jobs ----------
select tests.authenticate_anon();
select throws_ok($$select * from public.run_world_job('all')$$, '42501', null, 'anon cannot run jobs');
select tests.authenticate_as('76000000-0000-0000-0000-00000000000a');
select throws_ok($$select * from public.run_world_job('all')$$, '42501', null, 'authenticated cannot run jobs');
select throws_ok($$select public.world_job_quest_reset()$$, '42501', null, 'authenticated cannot call the quest reset job directly');
select throws_ok($$select public.world_job_earned_expiry_notice()$$, '42501', null, 'authenticated cannot call the notice job directly');
select tests.authenticate_as('76000000-0000-0000-0000-00000000000c');
select throws_ok($$select * from public.run_world_job('all')$$, '42501', null,
  'an admin JWT cannot run jobs either (the admin path is the Edge Function / psql)');
select tests.authenticate_backend();
select throws_ok($$select * from public.run_world_job('nope')$$, 'P0001', 'unknown_job', 'an unknown job name is refused');
select tests.clear_authentication();

-- ---------- 'all' from a direct session (pg_cron / psql): five jobs, five rows, nothing to do yet ----------
-- p_at is pinned to a Tuesday in January 2026 so the quest windows, the notice horizon and the
-- season calendar are all deterministic (no season starts before 2026-11-10; no credit expires
-- inside [2026-01-06, 2026-01-20)). expire_earned_tokens() reasons about now(), so the 200-day row
-- goes in this very run.
create temp table run1 as select * from public.run_world_job('all', '2026-01-06 00:05+00');
select is((select count(*)::int from run1), 5, 'all = five job runs');
select is((select string_agg(job, ',' order by id) from run1),
  'quest_reset,earned_expiry_notice,earned_expiry,season_rollover,score_recompute',
  'the five jobs run in the documented order');
select is((select count(*)::int from run1 where status = 'ok' and finished_at is not null), 5, 'every job finished ok');
-- Only rows written since this transaction began: where pg_cron really runs (the CI image), a
-- `meetups_tick` / hourly tick that fired before the test leaves committed rows in job_runs.
select is((select count(*)::int from public.job_runs where started_at >= now()), 5, 'one job_runs row per job');
select is((select distinct triggered_by from run1), 'cron', 'a direct session with no JWT is labelled cron');
select is((select result from run1 where job = 'quest_reset'), jsonb_build_object('emitted', 2, 'skipped', 0, 'day', '2026-01-06'),
  'quest_reset announced the daily and the weekly window');
select is((select result from run1 where job = 'earned_expiry_notice'), '{"notified": 0, "users": 0, "amount": 0}'::jsonb,
  'nothing expires inside a January horizon');
select is((select result from run1 where job = 'earned_expiry'), '{"expired": 1}'::jsonb, 'the 200-day earned credit expired');
select is((select result from run1 where job = 'season_rollover'), '{"started": 0, "ended": 0}'::jsonb, 'no season has started in January 2026');
select is((select result from run1 where job = 'score_recompute'), '{"changed": 0}'::jsonb, 'no garages, nothing recomputed');

-- ---------- quest_reset: once per window ----------
select is((select count(*)::int from public.domain_events where type = 'quest.reset'), 2, 'one quest.reset per cadence');
select is(
  (select payload - 'quests' from public.domain_events where type = 'quest.reset' and payload ->> 'cadence' = 'daily'),
  jsonb_build_object('cadence', 'daily', 'period_start', '2026-01-06', 'period_end', '2026-01-07',
                     'previous_period_start', '2026-01-05', 'previous_rows', 0, 'previous_completed', 0),
  'the daily reset carries its window and the previous window''s stats');
select is((select jsonb_array_length(payload -> 'quests') from public.domain_events where type = 'quest.reset' and payload ->> 'cadence' = 'weekly'),
  3, 'the weekly reset lists the three quests on offer');
select is((select payload ->> 'period_start' from public.domain_events where type = 'quest.reset' and payload ->> 'cadence' = 'weekly'),
  '2026-01-05', 'the weekly window starts on the Monday');
select is((select result from public.run_world_job('quest_reset', '2026-01-06 09:00+00')),
  jsonb_build_object('emitted', 0, 'skipped', 2, 'day', '2026-01-06'), 'a second run inside the same windows emits nothing');
select is((select result from public.run_world_job('quest_reset', '2026-01-07 00:05+00')),
  jsonb_build_object('emitted', 1, 'skipped', 1, 'day', '2026-01-07'), 'the next day announces only the daily window');
select is((select count(*)::int from public.domain_events where type = 'quest.reset'), 3, 'three quest.reset events in all');

-- ---------- earned_expiry_notice: T-14 d, once per (user, expiry day) batch ----------
select is((select result from public.run_world_job('earned_expiry_notice', now())),
  '{"notified": 1, "users": 1, "amount": 5}'::jsonb, 'the credit expiring in 10 days is notified; 80 days out and purchased are not');
select is((select count(*)::int from public.domain_events where type = 'tokens.expiring_soon'
             and actor_id = '76000000-0000-0000-0000-00000000000a' and entity = 'profile'),
  1, 'tokens.expiring_soon emitted for the earner');
select is((select (payload ->> 'amount')::int from public.domain_events where type = 'tokens.expiring_soon'), 5, 'the notice carries the batch amount');
select is((select (payload ->> 'days_left')::int from public.domain_events where type = 'tokens.expiring_soon'), 10, 'and the days left');
select is((select count(*)::int from public.notifications where type = 'tokens_expiring'
             and user_id = '76000000-0000-0000-0000-00000000000a' and (payload ->> 'amount')::int = 5),
  1, 'one tokens_expiring notification');
select is((select result from public.run_world_job('earned_expiry_notice', now())),
  '{"notified": 0, "users": 0, "amount": 0}'::jsonb, 'a second run never notifies the same batch again');
select is((select count(*)::int from public.notifications where type = 'tokens_expiring'), 1, 'still one notification');

-- ---------- earned_expiry: once ----------
select is((select delta from public.token_ledger where user_id = '76000000-0000-0000-0000-00000000000a' and reason = 'expire_earned'),
  -4, 'the expire_earned debit is the old credit''s remainder');
select is((select result from public.run_world_job('earned_expiry')), '{"expired": 0}'::jsonb, 'a second expiry run expires nothing');

-- ---------- season_rollover: once ----------
select is((select result from public.run_world_job('season_rollover', '2026-11-10 00:05+00')), '{"started": 1, "ended": 0}'::jsonb,
  'the founders season is announced once its start has passed');
select is((select result from public.run_world_job('season_rollover', '2026-11-10 01:05+00')), '{"started": 0, "ended": 0}'::jsonb,
  'and not again an hour later');

-- ---------- a failing job is recorded and does not block the others ----------
alter function public.world_recompute_all_scores() rename to world_recompute_all_scores_broken;
create temp table run2 as select * from public.run_world_job('all', '2026-01-08 00:05+00', 'manual');
select is((select status || ':' || coalesce(left(error, 5), '') from run2 where job = 'score_recompute'), 'error:42883',
  'the broken job is recorded as an error with its SQLSTATE');
select is((select count(*)::int from run2 where status = 'ok'), 4, 'the other four jobs still ran');
select is((select distinct triggered_by from run2), 'manual', 'p_source labels the run');
alter function public.world_recompute_all_scores_broken() rename to world_recompute_all_scores;

-- ---------- job_runs: admin-read, never client-writable ----------
select tests.authenticate_as('76000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.job_runs), 0, 'a member sees no job runs');
select throws_ok($$insert into public.job_runs (job, run_at) values ('x_job', now())$$, '42501', null, 'a member cannot write job runs');
select tests.authenticate_as('76000000-0000-0000-0000-00000000000c');
select ok((select count(*) from public.job_runs) >= 10, 'an admin reads every job run');
select tests.clear_authentication();

-- ---------- pg_cron schedules (where the extension exists) ----------
select ok(tests.world_cron_jobs() in (-1, 6), 'six World schedules where pg_cron exists, skipped cleanly where it does not');

select * from finish();
rollback;
