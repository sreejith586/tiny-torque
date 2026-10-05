-- 0007a_listing_reserved_enum — MV-S5-01, F-08.
-- Adds the 'reserved' listing status used when an offer is accepted. Isolated in its own migration
-- because Postgres forbids using a new enum value in the same transaction that adds it; the deals
-- migration (next) relies on 'reserved' existing already.
alter type public.listing_status add value if not exists 'reserved';
