-- 0003_media — MV-S2-01, F-02, ADR-08, 03-data-model.md §2.5
--
-- First-class media rows + private Storage buckets. Introduces:
--   * `media` table (one row per stored image; kind item/avatar/banner/listing/chat)
--   * private buckets `item-media` / `profile-media` with key-prefix ownership policies
--     (object path = '<owner-uid>/...', mirroring housekeeping's car-photos tightening)
--   * `media_is_public(id)` so anon can read the storage objects that back a PUBLIC item
--     (public-profile pages sign those URLs server-side with no session)
--   * idempotent backfill from `collection_items.photo`/`photos` (points at the existing
--     public `car-photos` objects; no-op where there is no data)
--   * `collection_items_v1` compat view — keeps the old photo/photos shape readable for one
--     release. The base columns are NOT dropped here: that is a second migration once the
--     backfill is verified on prod (D-006 two-release rule).

-- ---------- enums ----------
create type public.media_kind as enum ('item', 'avatar', 'banner', 'listing', 'chat');
create type public.media_status as enum ('uploading', 'ready', 'flagged', 'removed');

-- ---------- media table ----------
create table public.media (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  kind       public.media_kind not null,
  entity_id  uuid,
  bucket     text not null,
  path       text not null unique,
  width      integer,
  height     integer,
  bytes      integer,
  sort_order integer not null default 0,
  status     public.media_status not null default 'uploading',
  created_at timestamptz not null default now()
);

create index media_owner_idx on public.media (owner_id);
create index media_entity_idx on public.media (kind, entity_id);

alter table public.media enable row level security;

-- True when the media row backs a visible PUBLIC item. SECURITY DEFINER so the check can see the
-- parent row regardless of caller (used by anon reads). Only `item` media for now — avatar/banner
-- become public when F-14 media lands, listings in S4; extend the union then.
create or replace function public.media_is_public(p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.media m
    join public.collection_items ci on ci.id = m.entity_id
    where m.id = p_media_id
      and m.kind = 'item'
      and ci.is_public = true
      and ci.deleted_at is null
  );
$$;

create policy "Owners manage their media"
  on public.media for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Public item media is readable"
  on public.media for select
  using (public.media_is_public(id));

create policy "Admins read all media"
  on public.media for select
  using (public.is_admin());

-- Explicit grants (D-048: don't rely on default-privilege role matching for PostgREST visibility).
grant select on public.media to anon, authenticated;
grant insert, update, delete on public.media to authenticated;

-- ---------- private buckets ----------
insert into storage.buckets (id, name, public) values
  ('item-media', 'item-media', false),
  ('profile-media', 'profile-media', false)
on conflict (id) do nothing;

-- Owner CRUD by key prefix (path = '<uid>/...').
create policy "Owners read own item-media"
  on storage.objects for select
  using (bucket_id = 'item-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners write own item-media"
  on storage.objects for insert
  with check (bucket_id = 'item-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners update own item-media"
  on storage.objects for update
  using (bucket_id = 'item-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners delete own item-media"
  on storage.objects for delete
  using (bucket_id = 'item-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners read own profile-media"
  on storage.objects for select
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners write own profile-media"
  on storage.objects for insert
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners update own profile-media"
  on storage.objects for update
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners delete own profile-media"
  on storage.objects for delete
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Anyone may read the storage objects that back a PUBLIC item (so the public-profile page can
-- sign those URLs without a session). Matches the object to its media row by bucket + path.
create policy "Public item media objects are readable"
  on storage.objects for select
  using (
    bucket_id = 'item-media'
    and exists (
      select 1
      from public.media m
      join public.collection_items ci on ci.id = m.entity_id
      where m.bucket = 'item-media'
        and m.path = storage.objects.name
        and m.kind = 'item'
        and ci.is_public = true
        and ci.deleted_at is null
    )
  );

-- ---------- backfill photos → media (idempotent; no-op on empty data) ----------
-- Existing photos live in the public `car-photos` bucket as full Storage URLs. Represent each as
-- a media row pointing at that same object (bucket 'car-photos'), so the media table is the single
-- source of truth going forward while old objects keep working. `on conflict (path)` makes re-runs
-- safe. The storage path is everything after '/car-photos/' in the URL.
insert into public.media (owner_id, kind, entity_id, bucket, path, sort_order, status)
select
  ci.owner_id,
  'item'::public.media_kind,
  ci.id,
  'car-photos',
  substring(url from '/car-photos/(.+)$'),
  (ord - 1)::int,
  'ready'::public.media_status
from public.collection_items ci
cross join lateral (
  -- the single `photo` first (sort 0), then each element of the `photos` array
  select u.url, u.ord
  from (
    select ci.photo as url, 0 as ord
    where ci.photo is not null
    union all
    select p.value #>> '{}' as url, p.ord::int
    from jsonb_array_elements(ci.photos) with ordinality as p(value, ord)
  ) u
  where u.url like '%/car-photos/%'
) as src(url, ord)
on conflict (path) do nothing;

-- ---------- collection_items_v1 compat view ----------
-- Passthrough for now (the photo/photos columns still exist). When those columns drop in the
-- follow-up migration, redefine this view to reconstruct photo/photos from `media` so any
-- one-release-behind reader keeps working.
create view public.collection_items_v1 as
select * from public.collection_items;

grant select on public.collection_items_v1 to anon, authenticated;

notify pgrst, 'reload schema';
