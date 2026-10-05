-- 0005_catalog — MV-S3-01, F-05, ADR-06, 03-data-model.md §2.3/2.17
--
-- Canonical catalogue (catalog_brands, catalog_models) + ai_scan_jobs + the rolling-30d scan
-- quota function, and the collection_items.catalog_model_id FK (the column was added nullable in
-- 0004 ahead of this table existing). Brand seed is inline; the ~200 starter castings CSV is
-- Varun's (loaded separately). Scan base limits are placeholders — see the function note.

create extension if not exists pg_trgm;

-- ---------- enums ----------
create type public.catalog_status as enum ('proposed', 'verified');
create type public.model_status as enum ('proposed', 'verified', 'merged');
create type public.scan_kind as enum ('single', 'group', 'visual_search');
create type public.scan_status as enum ('queued', 'running', 'done', 'failed');

-- ---------- catalog_brands ----------
create table public.catalog_brands (
  id            uuid primary key default gen_random_uuid(),
  name          citext not null unique,
  slug          text not null unique,
  logo_media_id uuid references public.media(id) on delete set null,
  status        public.catalog_status not null default 'proposed',
  proposed_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.catalog_brands enable row level security;

-- ---------- catalog_models ----------
create table public.catalog_models (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.catalog_brands(id) on delete cascade,
  name           text not null,
  series         text,
  scale          text,
  year           integer,
  casting_code   text,
  color_variants jsonb not null default '[]'::jsonb,
  status         public.model_status not null default 'proposed',
  merged_into_id uuid references public.catalog_models(id) on delete set null,
  proposed_by    uuid references public.profiles(id) on delete set null,
  verified_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(series, '') || ' ' || coalesce(casting_code, ''))
  ) stored
);
alter table public.catalog_models enable row level security;

-- one canonical model per brand+name+series+scale
create unique index catalog_models_unique_idx
  on public.catalog_models (brand_id, lower(name), coalesce(series, ''), coalesce(scale, ''));
create index catalog_models_search_idx on public.catalog_models using gin (search);
create index catalog_models_name_trgm_idx on public.catalog_models using gin (name gin_trgm_ops);
create index catalog_models_brand_idx on public.catalog_models (brand_id);

-- Now that catalog_models exists, point collection_items.catalog_model_id at it (nullable; set
-- null if a model is deleted — the item keeps its free-text fields).
alter table public.collection_items
  add constraint collection_items_catalog_model_fk
  foreign key (catalog_model_id) references public.catalog_models(id) on delete set null;

-- ---------- RLS: everyone reads verified + own proposals; admins write; service role upserts ----------
create policy "Verified catalogue + own proposals are readable" on public.catalog_brands for select
  using (status = 'verified' or proposed_by = auth.uid() or public.is_admin());
create policy "Admins write brands" on public.catalog_brands for all
  using (public.is_admin()) with check (public.is_admin());

create policy "Verified models + own proposals are readable" on public.catalog_models for select
  using (status = 'verified' or proposed_by = auth.uid() or public.is_admin());
create policy "Admins write models" on public.catalog_models for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.catalog_brands, public.catalog_models to anon, authenticated;

-- ---------- ai_scan_jobs ----------
create table public.ai_scan_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  kind           public.scan_kind not null,
  media_id       uuid references public.media(id) on delete set null,
  status         public.scan_status not null default 'queued',
  candidates     jsonb not null default '[]'::jsonb,
  accepted_count integer not null default 0,
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  cost_usd       numeric(8, 5),
  latency_ms     integer,
  error          text,
  created_at     timestamptz not null default now()
);
create index ai_scan_jobs_user_idx on public.ai_scan_jobs (user_id, created_at desc);
alter table public.ai_scan_jobs enable row level security;

create policy "Users read their own scan jobs" on public.ai_scan_jobs for select
  using (user_id = auth.uid());
create policy "Admins read all scan jobs" on public.ai_scan_jobs for select
  using (public.is_admin());
-- Inserts/updates come from the ai-scan Edge Function (service role, bypasses RLS).

grant select on public.ai_scan_jobs to authenticated;

-- ---------- scan quota (rolling 30 days) ----------
-- Remaining scans = base-plan limit + bonus grants − `done` jobs in the last 30 days. The base
-- limits (free 10 / pro 100) are PLACEHOLDERS pending Sreejith's call (relates to D-024 pricing).
create or replace function public.entitlement_scan_quota(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    (case (select plan from public.profiles where id = p_user) when 'pro' then 100 else 10 end)
    + coalesce((select scan_quota_bonus from public.profiles where id = p_user), 0)
    - (
        select count(*)
        from public.ai_scan_jobs
        where user_id = p_user and status = 'done' and created_at > now() - interval '30 days'
      )
  )::integer;
$$;

-- ---------- brand seed (verified starter list; F-05) ----------
insert into public.catalog_brands (name, slug, status) values
  ('Hot Wheels', 'hot-wheels', 'verified'),
  ('Matchbox', 'matchbox', 'verified'),
  ('Tomica', 'tomica', 'verified'),
  ('Majorette', 'majorette', 'verified'),
  ('Mini GT', 'mini-gt', 'verified'),
  ('Tarmac Works', 'tarmac-works', 'verified'),
  ('Kyosho', 'kyosho', 'verified'),
  ('AUTOart', 'autoart', 'verified'),
  ('Maisto', 'maisto', 'verified'),
  ('Bburago', 'bburago', 'verified'),
  ('Greenlight', 'greenlight', 'verified'),
  ('M2 Machines', 'm2-machines', 'verified'),
  ('Johnny Lightning', 'johnny-lightning', 'verified'),
  ('Inno64', 'inno64', 'verified'),
  ('Pop Race', 'pop-race', 'verified'),
  ('Kaido House', 'kaido-house', 'verified')
on conflict (name) do nothing;

notify pgrst, 'reload schema';
