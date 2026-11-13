-- MV-S10-06 — removes exactly what seed-load.sql created (ids `10ad000x-…`, handles `load_NNNN`).
--   psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=staging -f scripts/load/cleanup-load.sql
\if :{?confirm}
\else
  \echo 'Refusing to run: pass -v confirm=staging.'
  \quit
\endif
select :'confirm' = 'staging' as ok \gset
\if :ok
\else
  \echo 'Refusing to run: confirm must be exactly "staging".'
  \quit
\endif

begin;
set local session_replication_role = replica;
delete from public.offers where id::text like '10ad0003-%';
delete from public.marketplace_listings where id::text like '10ad0002-%';
delete from public.collection_items where id::text like '10ad0001-%';
delete from public.profiles where id::text like '10ad0000-%';
delete from auth.users where id::text like '10ad0000-%';
commit;

select 'left behind' as check, count(*) from public.profiles where handle like 'load\_%';
