-- 0008b_listing_view — MV-S4-05, F-06. Debounced view counter for listing detail.
--
-- Anon-callable definer RPC that bumps marketplace_listings.view_count for an active listing. The
-- UI debounces the call (once per view); a direct UPDATE isn't exposed (RLS update is seller-only),
-- so this is the only way an anon viewer increments the counter.
create or replace function public.increment_listing_view(p_listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.marketplace_listings
    set view_count = view_count + 1
    where id = p_listing_id and status = 'active' and deleted_at is null;
$$;
grant execute on function public.increment_listing_view(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
