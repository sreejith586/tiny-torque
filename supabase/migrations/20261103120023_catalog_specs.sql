-- 0022_catalog_specs — MV-W08-prep, F-25 (07 §2.4), D-075, D-008 (proposed→verified), D-009, D-021.
--
-- Real-car performance specs on the canonical catalogue so the W08 racing stats model
-- (`domain/races/stats.ts`) can derive a car's base stats from the actual model instead of a
-- segment guess. Diecast castings of real cars get specs; fantasy castings keep `{}` and race on
-- their archetype. Everything here ships dark — nothing reads `specs` until `world_races` is on.
--
-- Shape of `catalog_models.specs` (all keys optional; `{}` = no specs known):
--   power_kw       numeric  > 0,  ≤ 2500     engine/motor peak power
--   torque_nm      numeric  > 0,  ≤ 5000
--   weight_kg      numeric  ≥ 300, ≤ 10000   kerb weight
--   zero_to_100_s  numeric  ≥ 1,  ≤ 60       0–100 km/h
--   top_speed_kmh  numeric  ≥ 30, ≤ 600
--   drivetrain     text     'fwd' | 'rwd' | 'awd'
--   drag_cd        numeric  ≥ 0.1, ≤ 1.5
--   model_year     integer  1880..2100        the real car's model year (≠ casting `year`)
-- The same rules live in `carSpecsSchema` (zod, src/domain/catalog/specs.ts); this function is
-- the DB backstop (D-013) and the CHECK constraint makes the column shape-safe for every writer.
--
-- Write paths (D-021 pattern): specs change ONLY through
--   propose_catalog_specs(model, specs, source)  — any signed-in member or the AI scan (service
--                                                   role); refused once specs are verified
--   verify_catalog_specs(model, specs, source)   — admin only; overwrites, stamps verified_by/at
-- A guard trigger blocks direct writes to the specs columns (even by admins through RLS), the
-- same `mv.*_rpc` GUC pattern 0012 uses for world_garages.level/score.

-- ---------- columns ----------
alter table public.catalog_models
  add column specs             jsonb not null default '{}'::jsonb,
  add column specs_source      text,
  add column specs_proposed_by uuid references public.profiles(id) on delete set null,
  add column specs_verified_by uuid references public.profiles(id) on delete set null,
  add column specs_verified_at timestamptz;

comment on column public.catalog_models.specs is
  'Real-car performance specs (F-25). Keys: power_kw, torque_nm, weight_kg, zero_to_100_s, top_speed_kmh, drivetrain (fwd|rwd|awd), drag_cd, model_year. {} = unknown (fantasy castings).';
comment on column public.catalog_models.specs_source is
  'Where the current specs came from: manufacturer, wiki, ai, member, admin … (free text, ≤ 80).';
comment on column public.catalog_models.specs_verified_at is
  'NULL = the specs are a proposal (D-008); set by verify_catalog_specs only.';

-- ---------- shape validator (immutable so it can back a CHECK) ----------
create or replace function public.catalog_specs_valid(p jsonb)
returns boolean
language sql
immutable
strict
set search_path = public
as $$
  select
    jsonb_typeof(p) = 'object'
    -- no unknown keys
    and not exists (
      select 1 from jsonb_object_keys(p) k
      where k not in ('power_kw', 'torque_nm', 'weight_kg', 'zero_to_100_s',
                      'top_speed_kmh', 'drivetrain', 'drag_cd', 'model_year')
    )
    -- numeric ranges (a present key must be a number inside its range)
    and (p->'power_kw'      is null or (jsonb_typeof(p->'power_kw')      = 'number' and (p->>'power_kw')::numeric      >  0   and (p->>'power_kw')::numeric      <= 2500))
    and (p->'torque_nm'     is null or (jsonb_typeof(p->'torque_nm')     = 'number' and (p->>'torque_nm')::numeric     >  0   and (p->>'torque_nm')::numeric     <= 5000))
    and (p->'weight_kg'     is null or (jsonb_typeof(p->'weight_kg')     = 'number' and (p->>'weight_kg')::numeric     >= 300 and (p->>'weight_kg')::numeric     <= 10000))
    and (p->'zero_to_100_s' is null or (jsonb_typeof(p->'zero_to_100_s') = 'number' and (p->>'zero_to_100_s')::numeric >= 1   and (p->>'zero_to_100_s')::numeric <= 60))
    and (p->'top_speed_kmh' is null or (jsonb_typeof(p->'top_speed_kmh') = 'number' and (p->>'top_speed_kmh')::numeric >= 30  and (p->>'top_speed_kmh')::numeric <= 600))
    and (p->'drag_cd'       is null or (jsonb_typeof(p->'drag_cd')       = 'number' and (p->>'drag_cd')::numeric       >= 0.1 and (p->>'drag_cd')::numeric       <= 1.5))
    and (p->'model_year'    is null or (jsonb_typeof(p->'model_year')    = 'number' and (p->>'model_year')::numeric = floor((p->>'model_year')::numeric)
                                        and (p->>'model_year')::numeric >= 1880 and (p->>'model_year')::numeric <= 2100))
    -- enum-ish text
    and (p->'drivetrain'    is null or (jsonb_typeof(p->'drivetrain') = 'string' and (p->>'drivetrain') in ('fwd', 'rwd', 'awd')))
$$;

alter table public.catalog_models
  add constraint catalog_models_specs_shape_check check (public.catalog_specs_valid(specs)),
  add constraint catalog_models_specs_source_len_check check (specs_source is null or length(specs_source) <= 80);

-- ---------- guard: the specs columns change only inside the two RPCs ----------
create or replace function public.catalog_specs_guard()
returns trigger
language plpgsql
as $$
begin
  if (new.specs is distinct from old.specs
      or new.specs_source is distinct from old.specs_source
      or new.specs_proposed_by is distinct from old.specs_proposed_by
      or new.specs_verified_by is distinct from old.specs_verified_by
      or new.specs_verified_at is distinct from old.specs_verified_at)
     and current_setting('mv.catalog_specs_rpc', true) is distinct from 'on' then
    raise exception 'specs_rpc_only' using errcode = 'P0001';
  end if;
  return new;
end; $$;

create trigger catalog_models_specs_guard
  before update on public.catalog_models
  for each row execute function public.catalog_specs_guard();

-- ---------- propose_catalog_specs: member / AI proposal (D-008 proposed state) ----------
-- Callable by any signed-in member or by the service role (AI scan: proposed_by stays NULL, source
-- says 'ai'). Last proposal wins until an admin verifies; after verification proposals are refused
-- (`specs_already_verified`) — verified beats proposed, always. The model must be visible to the
-- caller (verified, their own proposal, or admin).
create or replace function public.propose_catalog_specs(p_model_id uuid, p_specs jsonb, p_source text default null)
returns public.catalog_models
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_role  text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_model public.catalog_models;
begin
  if v_uid is null and v_role <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_specs is null or jsonb_typeof(p_specs) <> 'object' or p_specs = '{}'::jsonb
     or not public.catalog_specs_valid(p_specs) then
    raise exception 'specs_invalid' using errcode = '22023';
  end if;
  if p_source is not null and length(p_source) > 80 then
    raise exception 'specs_invalid' using errcode = '22023';
  end if;

  select * into v_model from public.catalog_models where id = p_model_id for update;
  if not found or not (
       v_model.status = 'verified'
       or (v_uid is not null and v_model.proposed_by = v_uid)
       or v_role = 'service_role'
       or public.is_admin()
     ) then
    raise exception 'model_not_found' using errcode = 'P0002';
  end if;
  if v_model.specs_verified_at is not null then
    raise exception 'specs_already_verified' using errcode = 'P0001';
  end if;

  perform set_config('mv.catalog_specs_rpc', 'on', true);
  update public.catalog_models
     set specs = p_specs,
         specs_source = p_source,
         specs_proposed_by = v_uid,
         specs_verified_by = null,
         specs_verified_at = null
   where id = p_model_id
   returning * into v_model;
  perform set_config('mv.catalog_specs_rpc', 'off', true);

  perform public.emit_event(v_uid, 'catalog.specs_proposed', 'catalog_model', p_model_id,
    jsonb_build_object('specs', p_specs, 'source', p_source));
  return v_model;
end; $$;
grant execute on function public.propose_catalog_specs(uuid, jsonb, text) to authenticated, service_role;

-- ---------- verify_catalog_specs: admin verification (overwrites, D-008 verified state) ----------
create or replace function public.verify_catalog_specs(p_model_id uuid, p_specs jsonb, p_source text default null)
returns public.catalog_models
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_model public.catalog_models;
begin
  if not public.is_admin() then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_specs is null or jsonb_typeof(p_specs) <> 'object' or p_specs = '{}'::jsonb
     or not public.catalog_specs_valid(p_specs) then
    raise exception 'specs_invalid' using errcode = '22023';
  end if;
  if p_source is not null and length(p_source) > 80 then
    raise exception 'specs_invalid' using errcode = '22023';
  end if;

  select * into v_model from public.catalog_models where id = p_model_id for update;
  if not found then raise exception 'model_not_found' using errcode = 'P0002'; end if;

  perform set_config('mv.catalog_specs_rpc', 'on', true);
  update public.catalog_models
     set specs = p_specs,
         specs_source = coalesce(p_source, specs_source, 'admin'),
         specs_verified_by = v_uid,
         specs_verified_at = now()
   where id = p_model_id
   returning * into v_model;
  perform set_config('mv.catalog_specs_rpc', 'off', true);

  perform public.emit_event(v_uid, 'catalog.specs_verified', 'catalog_model', p_model_id,
    jsonb_build_object('specs', p_specs, 'source', v_model.specs_source,
                       'proposed_by', v_model.specs_proposed_by));
  return v_model;
end; $$;
grant execute on function public.verify_catalog_specs(uuid, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
