-- 0016_reports_rpc_and_blocking — MV-S6-05, F-15, 03-data-model.md §2.19/§2.21.
--
-- `create_report`: the only insert path for `reports` from here — a plain insert already worked
-- (RLS: "Reporters can insert their own reports", reporter_id = auth.uid()) but had no rate limit
-- at all; F-15 says 10/day. A definer RPC adds that check atomically and emits `report.created`
-- (rule 9). `blocks` itself needs no RPC — its existing "Users manage their own blocks" policy
-- (for all, blocker_id = auth.uid()) is a plain table the client can insert/delete directly, same
-- as favorites/wishlist.
--
-- Blocking's "hides their listings/profile from you" (F-15) wires into the two read paths that
-- weren't blocked-aware yet: `marketplace_listings`' public SELECT policy and `public_profiles`.
-- `is_blocked()` is already symmetric (20261004000000_messaging_trust.sql), so this hides a listing
-- or profile from EITHER side of a block, matching the AC's "blocked pair cannot see each other's
-- listings". Offers/chat were already blocked both ways in that same migration.

create or replace function public.create_report(
  p_target_type text,
  p_target_id   text,
  p_target_name text default null,
  p_reason      text default null,
  p_notes       text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_report public.reports;
begin
  if v_uid is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'notes_too_long' using errcode = 'P0001';
  end if;

  select count(*) into v_count
    from public.reports
    where reporter_id = v_uid and created_at > now() - interval '24 hours';
  if v_count >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.reports (target_type, target_id, target_name, reason, notes, reporter_id)
    values (p_target_type, p_target_id, p_target_name, p_reason, p_notes, v_uid)
    returning * into v_report;

  insert into public.domain_events (actor_id, type, entity, entity_id, payload)
    values (v_uid, 'report.created', 'report', v_report.id, jsonb_build_object('target_type', p_target_type));

  return v_report;
end; $$;

grant execute on function public.create_report(text, text, text, text, text) to authenticated;

-- ---------- marketplace_listings: hide a blocked seller's listings from the blocker (both ways) ----------
drop policy "Active listings are publicly readable" on public.marketplace_listings;
create policy "Active listings are publicly readable"
  on public.marketplace_listings for select
  using (
    (
      status = 'active'
      or seller_id = auth.uid()
      or exists (
        select 1 from public.offers o
        where o.listing_id = marketplace_listings.id and o.buyer_id = auth.uid()
      )
    )
    and not public.is_blocked(auth.uid(), seller_id)
  );

-- ---------- public_profiles: hide a blocked user's profile from the blocker (both ways) ----------
create or replace view public.public_profiles as
select id, handle, display_name, account_type, store_name, country_code, city, bio, level, xp, created_at,
       (pro_until is not null and pro_until > now()) as is_pro,
       rating_avg, rating_count
from public.profiles
where deleted_at is null
  and not public.is_blocked(auth.uid(), id);

notify pgrst, 'reload schema';
