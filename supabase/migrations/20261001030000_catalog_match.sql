-- 0007_catalog_match — MV-S3-02, F-03/F-05, 03-data-model.md §2.3
--
-- Trigram lookup used by the ai-scan Edge Function to match a scanned model name against the
-- verified catalogue. Kept as an RPC (not an inline query) because PostgREST can't express
-- `similarity()` in a select, and so the threshold/ordering live in one place the function and
-- any future UI both call. Returns at most p_limit verified models above a low trigram floor,
-- best score first; the Edge Function bands the top score (see lib.ts bestMatch / scoreBand).
-- Verified-only + a SECURITY DEFINER owned by the table owner means it is safe for anon to call.

create or replace function public.match_catalog_models(p_name text, p_limit integer default 5)
returns table (id uuid, brand_id uuid, name text, score real)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.brand_id, m.name, similarity(m.name, p_name) as score
  from public.catalog_models m
  where m.status = 'verified'
    and p_name is not null
    and length(btrim(p_name)) > 1
    and similarity(m.name, p_name) > 0.2
  order by similarity(m.name, p_name) desc, m.name asc
  limit greatest(1, least(coalesce(p_limit, 5), 25));
$$;

grant execute on function public.match_catalog_models(text, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
