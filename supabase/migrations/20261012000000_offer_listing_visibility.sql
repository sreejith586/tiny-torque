-- MV-S5-04 prerequisite fix. The /offers inbox (F-08) must show listing details for every offer a
-- buyer has sent, "grouped by listing" — including after the listing moves to reserved/sold, which
-- is exactly when the buyer most needs to see it ("your offer was accepted"). The marketplace_v2
-- SELECT policy only ever allowed `status = 'active' or seller_id = auth.uid()`, so a buyer whose
-- offer got accepted would have the listing vanish from under them once it left 'active'. Widen it
-- to also allow a buyer who has ANY offer on the listing — read-only, doesn't touch write policies.
drop policy "Active listings are publicly readable" on public.marketplace_listings;
create policy "Active listings are publicly readable"
  on public.marketplace_listings for select
  using (
    status = 'active'
    or seller_id = auth.uid()
    or exists (
      select 1 from public.offers o
      where o.listing_id = marketplace_listings.id and o.buyer_id = auth.uid()
    )
  );
