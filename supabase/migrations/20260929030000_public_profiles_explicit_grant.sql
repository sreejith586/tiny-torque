-- 20260929030000_public_profiles_explicit_grant — MV-S1-07 (PGRST205 follow-up)
--
-- Research (docs.postgrest.org/schema_cache, PostgREST/postgrest#4613, supabase/supabase#39446/#42183,
-- supabase.com/docs/guides/database/hardening-data-api): PostgREST's schema cache is built from an
-- introspection query that only lists a relation at all when at least one of its configured roles
-- (here: anon, authenticated) holds a privilege on it. A relation with zero grants for those roles
-- doesn't produce a 42501 permission error — PostgREST reports PGRST205 "Could not find the table
-- ... in the schema cache", exactly the error MV-S1-07's `/u/{handle}` page hit on every request.
--
-- `public.public_profiles` (20260928000100_identity_v2.sql) never received an explicit GRANT of its
-- own — it relied entirely on 20260928000000_grants.sql's
--   alter default privileges for role postgres in schema public
--     grant select, insert, update, delete on tables to anon, authenticated;
-- to cover it once created. Per PostgreSQL docs, ALTER DEFAULT PRIVILEGES ... ON TABLES does cover
-- views created afterward, but ONLY for objects created by the exact role named in `FOR ROLE` — and
-- only that role. `countries`, a plain table added in the same migration, is confirmed reachable via
-- PostgREST on the live Vercel preview + Supabase Branching DB (PR #15's Playwright run), while
-- `public_profiles`, a view added in that same file, is not — on a Branching-managed project we don't
-- control the exact role the migration-apply pipeline runs as, so relying on default-privilege
-- role-matching for this one relation is fragile. A prior fix (20260929020000, `notify pgrst, 'reload
-- schema'`) assumed the object already had grants and just needed PostgREST to notice them; two
-- diagnostic round-trips showed no change, consistent with the view never having had the grant to
-- notice in the first place.
--
-- This migration grants SELECT explicitly and unconditionally, independent of default-privilege
-- inheritance, then re-sends the reload notification so PostgREST picks it up without waiting on its
-- timer. Idempotent / safe to run against an environment where the grant already exists.

grant select on public.public_profiles to anon, authenticated;

notify pgrst, 'reload schema';
