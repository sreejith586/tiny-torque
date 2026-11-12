-- MV-S10-06 (F-17) — load sanity: the three hot spots found by EXPLAIN (ANALYZE) on the seeded
-- volume (scripts/load/seed-load.sql: 5 000 items / 1 000 listings / 500 offers), measured under
-- RLS as a signed-in collector. Numbers and method: docs/load-test.md.
--
-- All three are the market browse (F-06). Without an index in the browse's own sort order the
-- planner read EVERY live listing, ran the RLS predicate on each (is_blocked() is a definer
-- function, ~8 µs a row) and then sorted for the top 25 — cost linear in the number of live
-- listings. With these, the scan walks the index in order and stops after one page.
--
--   1. default browse  — own country, newest first        7.4 ms → 0.9 ms
--   2. "All countries" — newest first                      6.6 ms → 0.4 ms
--   3. price sort      — own country, price asc / desc     3.5 ms → 0.5 ms
--
-- Partial on the browse's fixed predicate (status = 'active' and deleted_at is null), keyed on
-- the keyset columns (sort column, id) so cursor pages use them too.
create index if not exists marketplace_listings_live_country_newest_idx
  on public.marketplace_listings (country_code, created_at desc, id desc)
  where status = 'active' and deleted_at is null;

create index if not exists marketplace_listings_live_newest_idx
  on public.marketplace_listings (created_at desc, id desc)
  where status = 'active' and deleted_at is null;

create index if not exists marketplace_listings_live_country_price_idx
  on public.marketplace_listings (country_code, price, id)
  where status = 'active' and deleted_at is null;

-- `marketplace_listings_seller_status_idx` (20261108130000_perf_indexes) duplicates the older
-- `marketplace_listings_seller_idx` — same (seller_id, status) key, twice the write cost.
drop index if exists public.marketplace_listings_seller_status_idx;
