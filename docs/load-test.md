# Load sanity (MV-S10-06, F-17)

Target volume from the sprint plan: **5 000 garage items / 1 000 listings / 500 offers**, i.e. several times what the 30–80 collector pilot will hold. Two parts: what was measured locally in this sprint (query plans on the seeded volume), and the k6 run against staging that the owner does.

## 1. Files

| File                            | What                                                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/load/seed-load.sql`    | 100 collectors, 5 000 items, 1 000 listings, 500 offers. Refuses to run without `-v confirm=staging`. Triggers are off for the session, so no events, XP or notifications are created. Idempotent.         |
| `scripts/load/cleanup-load.sql` | Deletes exactly those rows (ids `10ad000x-…`, handles `load_NNNN`).                                                                                                                                        |
| `scripts/load/k6-browse.js`     | k6 scenario: pages (`/`, `/market`, search, a listing) and the PostgREST calls behind browse / search / garage, with the repos' own filters and keyset order. Refuses the production host and project ref. |

## 2. Measured locally (2026-11-12)

Setup: every migration applied to `supabase/postgres:15.14.1.178` (the CI pgTAP image, on a laptop), seed loaded, `ANALYZE`, each query run with `EXPLAIN (ANALYZE)` **as a signed-in collector under RLS** — the policies are part of the cost. Times are execution time of a warm single run; they show plan shape and growth, not production latency.

| #   | Query (repo function)                                      | Before         | After  | Plan before → after                                                                  |
| --- | ---------------------------------------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------ |
| 1   | Market browse, own country, newest (`browsePage`, default) | 7.4 ms         | 0.9 ms | read all 350 live rows of the country + sort → index scan in order, stops at 26 rows |
| 2   | Market browse, all countries, newest                       | 6.6 ms         | 0.4 ms | read all 750 live rows + sort → index scan in order                                  |
| 3   | Market browse, own country, price sort                     | 3.5 ms         | 0.5 ms | bitmap scan + sort → index scan in order                                             |
| 4   | Market search (`q`), all countries                         | 6.9 ms         | 6.9 ms | reads every live listing — **not fixed, see below**                                  |
| 5   | Garage list (`listPage`)                                   | 0.16 ms        | —      | already index-backed (`collection_items_owner_created_idx`, S9)                      |
| 6   | Garage search                                              | 0.06 ms        | —      | owner index, 50 rows filtered                                                        |
| 7   | Offers received / sent                                     | 0.26 / 0.02 ms | —      | index-backed                                                                         |
| 8   | Garage stats rows                                          | 0.03 ms        | —      | index-backed                                                                         |

**The three hot spots fixed** (`supabase/migrations/20261112092000_load_hotspot_indexes.sql`) are the three browse orders. Cause: no index matched the browse's sort order, so Postgres read every live listing, evaluated the RLS predicate on each (it calls `is_blocked()`, a definer function, about 8 µs a row) and sorted for one page — cost linear in the number of live listings. Three partial indexes on `status = 'active' and deleted_at is null`, keyed on the keyset columns, make it one page of index entries regardless of table size. The same migration drops a duplicate index (`marketplace_listings_seller_status_idx`).

**Known and left alone — search (#4).** A text search still evaluates the RLS predicate on every live listing before the text match, because Postgres must run RLS quals before a non-leakproof operator (`@@`). 7 ms at 1 000 listings; expect it to grow linearly (≈ 70 ms at 10 000). Fine for the pilot. The fix is structural (a block-aware search RPC, or a cheaper block check) and belongs with the first sign that listings pass a few thousand.

Not measured here: page render time, network, cold starts, image delivery — that is what the k6 run is for.

## 3. Staging run (owner)

Prerequisites: [k6](https://k6.io) installed; the staging database URL (pooler) and anon key; a quiet moment on staging; optionally a test collector's access token for the garage calls (sign in on staging, copy `access_token` from the `sb-…-auth-token` cookie / local storage).

```bash
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=staging -f scripts/load/seed-load.sql
```

The seed sets `session_replication_role = replica` (triggers off), which needs the `postgres` role. If Supabase refuses that statement, do not fall back to the dashboard SQL editor (project rule: no SQL pasted in the dashboard); delete that one line in a local copy, accept that staging gets the extra events and that the per-plan listing limit and offer rate limit may reject part of the seed, and note it in the run record.

```bash
k6 run -e BASE_URL=https://<staging-host> -e SUPABASE_URL=https://bjhowyyyypeacfkgxwqr.supabase.co -e SUPABASE_ANON_KEY=<staging anon key> -e VERCEL_BYPASS=<bypass secret> scripts/load/k6-browse.js
```

```bash
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=staging -f scripts/load/cleanup-load.sql
```

The scenario ramps to 30 virtual users (≈ the whole cohort online at once) and then to 60 for a minute, about 4 minutes in total. Pass criteria (k6 thresholds, from 01 §6): page p95 < 2.5 s, REST p95 < 500 ms, errors < 0.5 %.

While it runs, watch: Supabase › Reports (CPU, connections — the pooler limit is the usual first wall), Vercel › Functions (duration, cold starts), Sentry.

If a threshold fails: `rest_duration` high → Supabase › Query Performance, take the slowest statement, `EXPLAIN (ANALYZE)` it locally on the seeded volume, add the index as a migration. `page_duration` high with fast REST → the server render (too many sequential queries on a page) or cold starts.

## 4. Run record

| Date          | Environment | Commit | Peak VUs | Page p95 | REST p95 | Error rate | Verdict / notes |
| ------------- | ----------- | ------ | -------- | -------- | -------- | ---------- | --------------- |
| _not yet run_ | staging     |        |          |          |          |            |                 |
