-- 20260928000000_grants — restore standard Supabase table privileges (D-006)
--
-- The hosted project's default privileges had been narrowed (remote_schema scaffold from
-- Branching setup granted only REFERENCES/TRIGGER/TRUNCATE/MAINTAIN to anon/authenticated),
-- so tables created by our migrations were unreadable through PostgREST: 42501 on
-- GET /rest/v1/profiles after a successful sign-in. RLS remains the access-control layer;
-- these grants only restore the baseline every Supabase project normally has.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Future objects created by migrations (run as postgres) get the same baseline.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;
