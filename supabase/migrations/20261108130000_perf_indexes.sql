-- 0011b_perf_indexes — MV-S9-03 (F-17 performance pass, 05 S9 "index review"), D-006 (additive).
--
-- Index review done by reading every repo.ts query against the existing indexes (no
-- pg_stat_statements access from this sandbox; the hosted project's extension is the follow-up
-- check once this is live — 06 §5). Gaps closed, all `if not exists` and all partial / composite
-- so they stay small:
--   collection_items (owner_id, created_at desc) where deleted_at is null
--       the garage's default page (listPage: owner, live rows, newest-first keyset) — the only
--       owner index so far was (owner_id, deleted_at), which cannot serve the ORDER BY.
--   notifications (user_id) where read_at is null
--       countUnread() runs on every app-shell render (AppHeader) — a tiny partial index instead
--       of walking the user's whole notification history.
--   listing_favorites (user_id)
--       listFavoriteIds() on every /market render for a signed-in viewer; the table only had the
--       (listing_id) side (favourite_count trigger).
--   seller_reviews (seller_id, created_at desc) where deleted_at is null
--       listReviewsForSeller() ordered newest-first; (seller_id) alone existed.
--   marketplace_listings (seller_id, status)
--       My listings (listMine) + enforce_active_listing_limit()'s per-seller active count on every
--       publish — 03 §2.6 lists this index, it was never created.
create index if not exists collection_items_owner_created_idx
  on public.collection_items (owner_id, created_at desc) where deleted_at is null;
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;
create index if not exists listing_favorites_user_idx
  on public.listing_favorites (user_id);
create index if not exists seller_reviews_seller_created_idx
  on public.seller_reviews (seller_id, created_at desc) where deleted_at is null;
create index if not exists marketplace_listings_seller_status_idx
  on public.marketplace_listings (seller_id, status);
