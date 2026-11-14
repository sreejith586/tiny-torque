-- pgTAP — MV-S11-04 (F-03, F-18): scan.completed from the job row, record_scan_accepted().

begin;
select plan(12);

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

insert into auth.users (id) values ('d4000000-0000-0000-0000-00000000000a'), ('d4000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, display_name, account_type, handle) values
  ('d4000000-0000-0000-0000-00000000000a', 'Scanner', 'individual', 'sm_scanner'),
  ('d4000000-0000-0000-0000-00000000000b', 'Other', 'individual', 'sm_other');

-- the Edge Function's two inserts: a finished job and a failed one
insert into public.ai_scan_jobs (id, user_id, kind, status, candidates, cost_usd) values
  ('d4000000-0000-0000-0000-0000000000a1', 'd4000000-0000-0000-0000-00000000000a', 'group', 'done',
   '[{"brand":"Hot Wheels"},{"brand":"Tomica"},{"brand":"Matchbox"}]', 0.012),
  ('d4000000-0000-0000-0000-0000000000a2', 'd4000000-0000-0000-0000-00000000000a', 'single', 'failed', '[]', 0.001);

select is(
  (select payload ->> 'candidates' from public.domain_events
    where type = 'scan.completed' and entity_id = 'd4000000-0000-0000-0000-0000000000a1'
      and actor_id = 'd4000000-0000-0000-0000-00000000000a'),
  '3', 'a finished scan job logs scan.completed with its candidate count');
select is(
  (select count(*)::int from public.domain_events where type = 'scan.completed' and entity_id = 'd4000000-0000-0000-0000-0000000000a2'),
  0, 'a failed job logs nothing');

select tests.authenticate_as('d4000000-0000-0000-0000-00000000000a');
select is(public.record_scan_accepted('d4000000-0000-0000-0000-0000000000a1', 2), 2, 'the scanner records 2 accepted candidates');
select is(public.record_scan_accepted('d4000000-0000-0000-0000-0000000000a1', 2), 2, 'saving the same review again changes nothing');
select is(public.record_scan_accepted('d4000000-0000-0000-0000-0000000000a1', 99), 3, 'the count is capped at what the scan proposed');
select is(public.record_scan_accepted('d4000000-0000-0000-0000-0000000000a1', 1), 3, 'and never goes down');
select throws_ok($$select public.record_scan_accepted('d4000000-0000-0000-0000-0000000000a2', 1)$$,
  'P0001', 'scan_job_not_found', 'a failed job cannot be accepted');
with u as (
  update public.ai_scan_jobs set accepted_count = 50
   where id = 'd4000000-0000-0000-0000-0000000000a1' returning 1)
select is((select count(*)::int from u), 0, 'the count cannot be written directly (no update policy)');

select tests.authenticate_as('d4000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.record_scan_accepted('d4000000-0000-0000-0000-0000000000a1', 1)$$,
  'P0001', 'scan_job_not_found', 'another collector cannot touch the job');
select tests.clear_authentication();

select is((select accepted_count from public.ai_scan_jobs where id = 'd4000000-0000-0000-0000-0000000000a1'), 3, 'accepted_count is stored on the job');
select is(
  (select array_agg((payload ->> 'count')::int order by id) from public.domain_events
    where type = 'scan.accepted' and entity_id = 'd4000000-0000-0000-0000-0000000000a1'),
  array[2, 3], 'scan.accepted is logged only when the count actually rises');

-- the KPI view picks it up
select public.refresh_pilot_kpis();
select ok(
  (select scan_accepted from public.pilot_kpis_weekly where week_start = date_trunc('week', now() at time zone 'utc')::date) >= 3,
  'pilot_kpis_weekly.scan_accepted reflects the recorded acceptances');

select * from finish();
rollback;
