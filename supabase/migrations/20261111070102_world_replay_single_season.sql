-- World: replay_quest_progress credits ONE season per completion (MV-W04 follow-up, F-26, D-071).
--
-- world_quest_complete() (the live consumer) adds a quest's reward_xp to the single season that
-- contains the completion time, latest starts_at first. replay_quest_progress() joined EVERY
-- season whose window contains completed_at, so with overlapping seasons a replay produced
-- different season_points than the consumer (F-26 AC: "same values after drop + replay").
-- Seen on 2026-11-10 when the placeholder Founders' Season started and overlapped the pgTAP
-- fixture season. Body is otherwise identical to 20261106092928_earn_engine.sql; signature and
-- grants unchanged (no generated-types change).

create or replace function public.replay_quest_progress(p_user uuid, p_from date default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_from   date := p_from;
  v_today  date := public.mv_utc_day(now());
  v_period date;
  v_value  integer;
  v_target integer;
  v_done   timestamptz;
  v_count  integer := 0;
  q record;
begin
  if not public.is_admin() and not public.mv_is_backend_caller() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_from is null then
    select public.mv_utc_day(min(occurred_at)) into v_from from public.domain_events where actor_id = p_user;
  end if;
  if v_from is null then return 0; end if;
  -- start on the Monday of p_from's week so the weekly rows that overlap it are rebuilt whole
  v_from := public.quest_period_start('weekly', public.mv_utc_day_start(least(v_from, v_today)));

  delete from public.quest_progress where user_id = p_user and period_start >= v_from;

  -- daily periods
  for v_period in select d::date from generate_series(v_from, v_today, interval '1 day') d loop
    for q in select * from public.current_quests(public.mv_utc_day_start(v_period)) where cadence = 'daily' loop
      v_target := (q.rule->>'threshold')::integer;
      v_value  := least(public.quest_progress_value(p_user, q.rule, q.period_start, q.period_end), v_target);
      if v_value > 0 then
        v_done := case when v_value >= v_target
          then public.quest_completed_at(p_user, q.rule, q.period_start, q.period_end) end;
        insert into public.quest_progress (user_id, quest_key, period_start, progress, completed_at)
          values (p_user, q.key, q.period_start, v_value, v_done);
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  -- weekly periods (Mondays)
  for v_period in select d::date from generate_series(v_from, v_today, interval '7 days') d loop
    for q in select * from public.current_quests(public.mv_utc_day_start(v_period)) where cadence = 'weekly' loop
      v_target := (q.rule->>'threshold')::integer;
      v_value  := least(public.quest_progress_value(p_user, q.rule, q.period_start, q.period_end), v_target);
      if v_value > 0 then
        v_done := case when v_value >= v_target
          then public.quest_completed_at(p_user, q.rule, q.period_start, q.period_end) end;
        insert into public.quest_progress (user_id, quest_key, period_start, progress, completed_at)
          values (p_user, q.key, q.period_start, v_value, v_done);
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  -- season points = Σ reward_xp of quests completed inside a season window. A completion belongs
  -- to exactly ONE season: the latest-starting one that contains completed_at — the same pick
  -- world_quest_complete() makes — so overlapping seasons replay to the consumer's values.
  delete from public.season_points where user_id = p_user;
  insert into public.season_points (season_id, user_id, points)
    select s.id, p_user, sum(qu.reward_xp)
    from public.quest_progress qp
    join public.quests qu on qu.key = qp.quest_key
    cross join lateral (
      select se.id from public.seasons se
      where qp.completed_at >= se.starts_at and qp.completed_at < se.ends_at
      order by se.starts_at desc limit 1
    ) s
    where qp.user_id = p_user and qp.completed_at is not null
    group by s.id
    having sum(qu.reward_xp) > 0;

  return v_count;
end; $$;
revoke execute on function public.replay_quest_progress(uuid, date) from public, anon, authenticated;
grant execute on function public.replay_quest_progress(uuid, date) to authenticated, service_role; -- admin check inside
