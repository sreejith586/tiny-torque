-- Mini Vault — Supabase schema
--
-- Paste this into the Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- for a fresh project, then run it once. It's written to match the exact
-- object shapes already used in js/app.js (see the field-by-field notes),
-- not a redesign of the data model.
--
-- NOT executed against a live database by me — I don't have network access
-- in this environment to test it against real Postgres. Standard, common
-- syntax throughout; still worth a first real run being your own sanity
-- check, same as with the build step.

-- ---------------------------------------------------------------------
-- profiles
-- One row per user. id matches auth.users.id (Supabase Auth's own table),
-- so profile creation should happen right after a successful phone-OTP
-- sign-up. Mirrors the object built in completeOnboarding() (app.js).
-- ---------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  account_type  text not null check (account_type in ('individual', 'shop')),
  store_name    text,
  location      text,
  mobile        text,
  photo_url     text,
  plan          text not null default 'free' check (plan in ('free', 'pro')),
  tokens        integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Profiles are publicly readable"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------
-- collection_items
-- A user's personal garage. Mirrors the object built when adding a car
-- (app.js, ~line 4241). photos is a plain array of Storage URLs.
-- ---------------------------------------------------------------------
create table collection_items (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references profiles(id) on delete cascade,
  brand            text not null,
  model            text,
  series           text,
  scale            text,
  variant          text,
  card_type        text,
  rarity           text,
  condition        text,
  qty              integer not null default 1,
  price_paid       numeric(10,2) not null default 0,
  source           text,
  photo            text,
  photos           jsonb not null default '[]'::jsonb,
  is_public        boolean not null default false,
  for_sale         boolean not null default false,
  open_to_offers   boolean not null default false,
  open_to_trade    boolean not null default false,
  ask_price        numeric(10,2) default 0,
  created_at       timestamptz not null default now()
);

alter table collection_items enable row level security;

create policy "Public items are readable by anyone"
  on collection_items for select
  using (is_public = true or owner_id = auth.uid());

create policy "Owners can insert their own items"
  on collection_items for insert
  with check (owner_id = auth.uid());

create policy "Owners can update their own items"
  on collection_items for update
  using (owner_id = auth.uid());

create policy "Owners can delete their own items"
  on collection_items for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- marketplace_listings
-- Mirrors the listingObj built in publishListing() (app.js, ~line 3583).
-- Seller fields (name/photo/location) are denormalized copies from
-- profiles at publish time, matching how the current code already
-- builds this object - kept as-is rather than "fixed" to a join, since
-- that's a data-modeling call for whoever owns the schema going forward.
-- ---------------------------------------------------------------------
create table marketplace_listings (
  id                uuid primary key default gen_random_uuid(),
  source_item_id    uuid references collection_items(id) on delete set null,
  seller_id         uuid not null references profiles(id) on delete cascade,
  seller_type       text,
  seller_photo      text,
  seller_name       text,
  seller_location   text,
  seller_mobile     text,
  brand             text not null,
  model             text,
  variant           text,
  rarity            text,
  condition         text,
  price             numeric(10,2) not null default 0,
  qty               integer not null default 1,
  open_to_offers    boolean not null default false,
  open_to_trade     boolean not null default false,
  photo             text,
  photos            jsonb not null default '[]'::jsonb,
  offers            jsonb not null default '[]'::jsonb,
  status            text not null default 'active' check (status in ('active', 'sold', 'removed')),
  created_at        timestamptz not null default now()
);

alter table marketplace_listings enable row level security;

create policy "Active listings are publicly readable"
  on marketplace_listings for select
  using (status = 'active' or seller_id = auth.uid());

create policy "Sellers can insert their own listings"
  on marketplace_listings for insert
  with check (seller_id = auth.uid());

create policy "Sellers can update their own listings"
  on marketplace_listings for update
  using (seller_id = auth.uid());

create policy "Sellers can delete their own listings"
  on marketplace_listings for delete
  using (seller_id = auth.uid());

-- ---------------------------------------------------------------------
-- seller_reviews
-- Mirrors the object at app.js ~line 2250.
-- ---------------------------------------------------------------------
create table seller_reviews (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references profiles(id) on delete cascade,
  offer_id     text,
  buyer_id     uuid references profiles(id) on delete set null,
  buyer_name   text,
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now()
);

alter table seller_reviews enable row level security;

create policy "Reviews are publicly readable"
  on seller_reviews for select
  using (true);

create policy "Buyers can leave a review as themselves"
  on seller_reviews for insert
  with check (buyer_id = auth.uid());

-- ---------------------------------------------------------------------
-- wishlist_items
-- Mirrors the object at app.js ~line 2641. Private to the owner - a
-- wishlist is not a public-facing feature in the current UI.
-- ---------------------------------------------------------------------
create table wishlist_items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  brand        text,
  model        text,
  notes        text,
  created_at   timestamptz not null default now()
);

alter table wishlist_items enable row level security;

create policy "Owners can read their own wishlist"
  on wishlist_items for select
  using (owner_id = auth.uid());

create policy "Owners can insert their own wishlist entries"
  on wishlist_items for insert
  with check (owner_id = auth.uid());

create policy "Owners can delete their own wishlist entries"
  on wishlist_items for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- reports
-- Mirrors the object at app.js ~line 5541 (user-submitted reports on
-- listings/users/etc). Deliberately NOT publicly readable - only the
-- reporter can see their own submission; moderation access is handled
-- separately (service-role key from an admin tool, not the public client).
-- ---------------------------------------------------------------------
create table reports (
  id            uuid primary key default gen_random_uuid(),
  target_type   text not null,
  target_id     text,
  target_name   text,
  reason        text,
  notes         text,
  reporter_id   uuid not null references profiles(id) on delete cascade,
  status        text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at    timestamptz not null default now()
);

alter table reports enable row level security;

create policy "Reporters can read their own reports"
  on reports for select
  using (reporter_id = auth.uid());

create policy "Reporters can insert their own reports"
  on reports for insert
  with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage
-- Run once in the dashboard (Storage tab) or via the SQL below:
-- a public bucket for car photos and profile/listing images.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', true)
on conflict (id) do nothing;

create policy "Car photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'car-photos');

create policy "Authenticated users can upload car photos"
  on storage.objects for insert
  with check (bucket_id = 'car-photos' and auth.role() = 'authenticated');
