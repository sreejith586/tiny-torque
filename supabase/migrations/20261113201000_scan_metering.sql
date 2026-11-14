-- MV-S11-04 (F-03, F-18) — close the scan loop before the beta.
--
-- The scan screen was still calling the Phase-1 `scan-photo` function (no quota, no kill switch,
-- no cost log); S11 moves it to the metered `ai-scan` function built in S3. Two things that
-- function's rows were missing:
--   * the events F-03 names — `scan.completed` is now written by a trigger when a finished job
--     row lands (the Edge Function uses the service role, so a trigger is the one place that
--     cannot be forgotten);
--   * `ai_scan_jobs.accepted_count`, which nothing ever set — so the pilot KPIs "scan share of
--     items" and "scan suggestions accepted" (pilot_kpis_weekly) would have read 0 forever.
--     `record_scan_accepted()` sets it for the caller's own job and logs `scan.accepted`.

create or replace function public.emit_scan_completed_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' then
    insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (new.user_id, 'scan.completed', 'scan', new.id,
            jsonb_build_object(
              'kind', new.kind,
              'candidates', case when jsonb_typeof(new.candidates) = 'array'
                                 then jsonb_array_length(new.candidates) else 0 end));
  end if;
  return new;
end; $$;
revoke execute on function public.emit_scan_completed_event() from public, anon, authenticated;
drop trigger if exists ai_scan_jobs_emit_completed on public.ai_scan_jobs;
create trigger ai_scan_jobs_emit_completed
  after insert on public.ai_scan_jobs
  for each row execute function public.emit_scan_completed_event();

-- The caller's own finished job only; the count is capped at what the scan proposed, and a
-- repeat call can only raise it (saving the same review twice never double-counts).
create or replace function public.record_scan_accepted(p_job uuid, p_count integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_job public.ai_scan_jobs;
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  select * into v_job from public.ai_scan_jobs
   where id = p_job and user_id = v_uid and status = 'done' for update;
  if not found then
    raise exception 'scan_job_not_found' using errcode = 'P0001';
  end if;
  v_n := least(greatest(coalesce(p_count, 0), 0),
               case when jsonb_typeof(v_job.candidates) = 'array'
                    then jsonb_array_length(v_job.candidates) else 0 end);
  if v_n <= v_job.accepted_count then
    return v_job.accepted_count;
  end if;
  update public.ai_scan_jobs set accepted_count = v_n where id = v_job.id;
  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
  values (v_uid, 'scan.accepted', 'scan', v_job.id,
          jsonb_build_object('count', v_n, 'kind', v_job.kind));
  return v_n;
end; $$;
revoke execute on function public.record_scan_accepted(uuid, integer) from public, anon;
grant execute on function public.record_scan_accepted(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
