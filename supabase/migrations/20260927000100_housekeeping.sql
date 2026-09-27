-- 0001_housekeeping — D-006 (CLI migrations), 03-data-model.md §4 row 0001
-- Adds updated_at + trigger on every table, soft-delete columns, admin helper,
-- and converts text+check columns to real enums (03 conventions).
-- Non-destructive: no column drops; safe to run on the Phase-1 data set.

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- role lives on profiles (added below); is_admin() is used by later RLS policies
create type public.user_role as enum ('user', 'admin');

alter table public.profiles add column if not exists role public.user_role not null default 'user';

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ---------- enums replacing text + check ----------
create type public.account_type as enum ('individual', 'shop');
create type public.plan_tier as enum ('free', 'pro');
create type public.listing_status as enum ('active', 'sold', 'removed');
create type public.report_status as enum ('open', 'reviewed', 'dismissed');

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  alter column account_type drop default,
  alter column account_type type public.account_type using account_type::public.account_type,
  alter column plan drop default,
  alter column plan type public.plan_tier using plan::public.plan_tier,
  alter column plan set default 'free';

alter table public.marketplace_listings drop constraint if exists marketplace_listings_status_check;
drop policy "Active listings are publicly readable" on public.marketplace_listings;
alter table public.marketplace_listings
  alter column status drop default,
  alter column status type public.listing_status using status::public.listing_status,
  alter column status set default 'active';
create policy "Active listings are publicly readable"
  on public.marketplace_listings for select
  using (status = 'active' or seller_id = auth.uid());

alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports
  alter column status drop default,
  alter column status type public.report_status using status::public.report_status,
  alter column status set default 'open';

-- ---------- updated_at / deleted_at on every table ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','collection_items','marketplace_listings','seller_reviews','wishlist_items','reports'] loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- indexes the baseline was missing ----------
create index if not exists collection_items_owner_idx on public.collection_items (owner_id, created_at desc);
create index if not exists marketplace_listings_seller_idx on public.marketplace_listings (seller_id, status);
create index if not exists marketplace_listings_status_created_idx on public.marketplace_listings (status, created_at desc);
create index if not exists seller_reviews_seller_idx on public.seller_reviews (seller_id);
create index if not exists wishlist_items_owner_idx on public.wishlist_items (owner_id);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

-- ---------- inherited defect fixes (MV-S0-09) ----------
-- Storage: uploads must live under the uploader's own prefix "<uid>/..."
drop policy if exists "Authenticated users can upload car photos" on storage.objects;
create policy "Users upload car photos under their own prefix"
  on storage.objects for insert
  with check (
    bucket_id = 'car-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users manage their own car photos"
  on storage.objects for delete
  using (bucket_id = 'car-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Admin read access to reports (moderation happens in-app, not via service key)
create policy "Admins can read all reports" on public.reports for select using (public.is_admin());
create policy "Admins can update reports" on public.reports for update using (public.is_admin());
