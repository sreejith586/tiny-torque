-- 0015_seller_reviews_v2 — MV-S6-03, F-10, 03-data-model.md §2.9.
--
-- `offer_id` becomes the real identity of a review (one per completed deal): not null + unique.
-- `buyer_name` dropped (join `profiles`/`public_profiles` instead, same as every other "who did
-- this" field in the app). The insert policy only ever checked `buyer_id = auth.uid()` — nothing
-- tied the review to a real completed offer the reviewer was actually the buyer on, so it's
-- redone to check that against `offers` directly (the spec's "insert allowed only when offer
-- completed and auth.uid() = buyer_id", 03 §2.9). `profiles.rating_avg`/`rating_count` are new
-- materialised columns, recomputed by a trigger so the aggregate updates in the same transaction
-- as the write (F-10 AC) rather than needing a background job.

do $$
begin
  if exists (select 1 from public.seller_reviews where offer_id is null) then
    raise exception 'seller_reviews has rows with a null offer_id — needs a backfill decision before this migration can run';
  end if;
end $$;

alter table public.seller_reviews
  alter column offer_id set not null,
  add constraint seller_reviews_offer_id_unique unique (offer_id),
  add constraint seller_reviews_comment_length check (comment is null or char_length(comment) <= 500);

alter table public.seller_reviews drop column if exists buyer_name;

alter table public.profiles
  add column if not exists rating_avg numeric(3,2),
  add column if not exists rating_count integer not null default 0;

-- Tighten insert: buyer_id must be the caller, and offer_id must be a completed offer where the
-- caller really is the buyer and seller_id really is that offer's seller (previously unchecked —
-- a signed-in user could otherwise attach a review to any offer/seller pair just by claiming it).
drop policy "Buyers can leave a review as themselves" on public.seller_reviews;
create policy "Buyer reviews seller once per completed offer" on public.seller_reviews for insert
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from public.offers o
      where o.id = offer_id
        and o.status = 'completed'
        and o.buyer_id = auth.uid()
        and o.seller_id = seller_reviews.seller_id
    )
  );

create or replace function public.recompute_seller_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_seller uuid := coalesce(new.seller_id, old.seller_id);
  v_cnt integer;
  v_avg numeric(3,2);
begin
  select count(*), avg(rating)::numeric(3,2) into v_cnt, v_avg
    from public.seller_reviews where seller_id = v_seller and deleted_at is null;
  update public.profiles set rating_count = v_cnt, rating_avg = v_avg where id = v_seller;
  return coalesce(new, old);
end; $$;

create trigger seller_reviews_recompute_rating
  after insert or update or delete on public.seller_reviews
  for each row execute function public.recompute_seller_rating();

-- Surface on public_profiles (§2.9: "visible on seller profile and listing seller card") — appended
-- at the end of the column list so this stays a CREATE OR REPLACE, not a drop+recreate, preserving
-- the explicit grant from 20260929030000 (views don't reliably inherit default privileges here).
create or replace view public.public_profiles as
select id, handle, display_name, account_type, store_name, country_code, city, bio, level, xp, created_at,
       (pro_until is not null and pro_until > now()) as is_pro,
       rating_avg, rating_count
from public.profiles
where deleted_at is null;

notify pgrst, 'reload schema';
