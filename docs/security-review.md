# Security review — Sprint 10 (MV-S10-01, F-19)

Reviewed 2026-11-12 against `staging` @ `434c004` (= what prod runs since #116). Scope: every table and view in `public`, the SECURITY DEFINER functions, rate limits, response headers, dependencies, service-role usage, secrets. Method: migrations applied to the CI pgTAP image (`supabase/postgres:15.14.1.178`), then each claim tested as `anon`, as an unrelated signed-in collector, as the owner and as an admin.

The fixes are in `supabase/migrations/20261112100000_s10_security_hardening.sql`; the tests that pin them are `supabase/tests/0031_s10_rls_matrix.sql` (83 assertions).

## 1. Findings

Severity is the impact on prod **as deployed before this PR**. All seven are fixed in this PR; findings 1–3 are exploitable on prod until it is promoted.

| #   | Severity     | Finding                                                                                                                                                                                                                                                                                                                                                                                                              | Evidence                                                               | Fix                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6   | **Critical** | **Any signed-in collector could make themselves admin.** `authenticated` has table-level `UPDATE`/`INSERT` on `profiles` and the only policies are "own row", so `update profiles set role = 'admin', tokens = 999999, plan = 'pro', suspended_until = null where id = auth.uid()` succeeded through PostgREST. Admin opens every profile's `mobile`, the reports queue, feedback, `admin_adjust_tokens`, the flags. | `UPDATE 1` and `is_admin() = t` as a fresh test user.                  | Trigger `profiles_guard_privileged`: an API role (`authenticated` / `anon`) cannot change `role`, `tokens`, `plan`, `pro_until`, `suspended_until`, `scan_quota_*`, `rating_*`, `deleted_at`, `purged_at`, `created_at`, `id`, nor insert a profile with non-default values. Definer RPCs, the service role and psql are unaffected. |
| 5   | **High**     | **The event log was readable and writable by anyone.** RLS on the partitioned parent `domain_events` does not cover a partition addressed directly; `domain_events_2026_11` etc. had no RLS and full grants. `anon` could read every event (actor ids, payloads — invite codes, flag changes) and insert forged events, which feed XP, badges and the World earn consumer.                                           | `anon` read 1 row and inserted a `forged.event` row via the partition. | `lock_event_partitions()` enables RLS (no policy) and revokes API grants on every partition; `ensure_event_partitions()` calls it for each partition it creates. Writes through the parent still work.                                                                                                                               |
| 1   | **High**     | **Private garage items were public.** The compat view `collection_items_v1` ran with its owner's rights, so `anon` could read every collector's private and trashed cars including `price_paid`.                                                                                                                                                                                                                     | `anon` saw the private row via the view, 0 via the table.              | View set to `security_invoker`; `anon` grant revoked. Nothing in the app reads the view. Dropping it waits for the `photo`/`photos` column drop (D-006).                                                                                                                                                                             |
| 2   | Medium       | Report rate limit (10 / 24 h, F-15) only lived in the `create_report` RPC; the S0 `INSERT` policy on `reports` let a direct insert skip it.                                                                                                                                                                                                                                                                          | 11th direct insert succeeded.                                          | Limit moved into trigger `reports_rate_limit` (covers both paths).                                                                                                                                                                                                                                                                   |
| 3   | Medium       | `feedback` had no rate limit — and from S10 every row notifies all admins.                                                                                                                                                                                                                                                                                                                                           | —                                                                      | Trigger `feedback_rate_limit`, 10 / 24 h, same `rate_limited` error; the Settings form shows a friendly message.                                                                                                                                                                                                                     |
| 7   | Medium       | **`token_purchase` kill switch was never read.** The flag was seeded in S1 and documented as "dark until real Stripe keys" (D-018, D-064), but no code checked it: checkout would have opened the moment keys were added.                                                                                                                                                                                            | `grep` — no reference outside the flag catalogue.                      | `buyPackAction` checks the flag server-side before creating a Checkout session. The webhook is deliberately not gated (a paid session must be credited). `pro_purchase` is still unread — see §7.                                                                                                                                    |
| 4   | Low          | `anon` held `EXECUTE` on `admin_search_users`, `admin_set_suspension`, `admin_adjust_tokens` (each re-checks `is_admin()`, so not exploitable).                                                                                                                                                                                                                                                                      | `has_function_privilege`.                                              | Revoked from `public` / `anon`.                                                                                                                                                                                                                                                                                                      |

**Follow-up for Sreejith after promotion** (cannot be checked from here): on prod, look for evidence that findings 5/6 were used — `select id, handle, role, tokens, plan from profiles where role = 'admin' or tokens > 500 or plan = 'pro';` and `select type, count(*) from domain_events where actor_id is null or type not like '%.%' group by 1;`. Any admin row you did not create by hand is an incident (runbook §2).

### Addendum — Sprint 11 (2026-11-13)

Two more, found while preparing the beta (`20261113200000_invite_gate.sql`, `20261113201000_scan_metering.sql`, D-112 / D-113):

| #   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                     | Fix                                                                                                                                                                                                                                                                      |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8   | **High** | **The scan screen used the Phase-1 `scan-photo` Edge Function.** It checks no user (the gateway's JWT check accepts the public anon key), has no quota, ignores the `ai_scan` kill switch and logs no cost — anyone could spend the project's Anthropic key, and `ai_scan_jobs` stayed empty, so the scan KPIs and the admin cost tile read 0. The metered `ai-scan` function from S3 was never wired to the screen.        | The screen now uploads to private storage and calls `ai-scan` only; `scan-photo` answers 410 in the repo. **The deployed copy must be deleted by the owner** (`docs/pilot/launch-checklist.md` §1) — until then the hole is still open on prod.                          |
| 9   | Medium   | **`invite_only` was a screen, not a gate.** Onboarding could be completed without a code by inserting the `profiles` row directly. Separately the flow itself was broken for new collectors: `redeem_invite` logged an event whose actor must reference `profiles`, so redeeming before the profile existed failed; and each call spent a seat, so closing the tab after entering a one-seat code locked the collector out. | `invite_redemptions` (one row per collector), `redeem_invite` idempotent and case-insensitive, trigger `profiles_require_invite` refuses an API insert without a redemption while the flag is on, `invite.redeemed` is logged when the profile is created. pgTAP `0033`. |

## 2. RLS matrix (what `0031_s10_rls_matrix.sql` asserts)

Catalogue-driven, so tables added later by either track are covered without editing the test:

- every table in `public` has RLS enabled, and every non-partition table has at least one policy;
- no partition is reachable by the API roles;
- every SECURITY DEFINER function pins `search_path`;
- no view bypasses RLS except the two reviewed projections `public_profiles` and `world_open_garages`;
- no materialised view is readable by the API roles; `anon` holds `EXECUTE` on no admin / job RPC;
- `public_profiles` has no `mobile`, `role` or `tokens` column.

Behavioural, one seeded row per table, read as four roles:

| Table                                                                                                                     | anon                | other collector       | owner        | admin                    |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------- | ------------ | ------------------------ |
| `profiles` (PII, `mobile`)                                                                                                | none                | own row only          | own          | all                      |
| `collection_items` private · `collection_items_v1`                                                                        | none · no privilege | none                  | own          | none                     |
| `media` (private item)                                                                                                    | none                | none                  | own          | all                      |
| `ai_scan_jobs`                                                                                                            | none                | none                  | own          | all                      |
| `offers`, `deal_messages`                                                                                                 | none                | none (unless a party) | party        | none                     |
| `notifications`, `token_ledger`, `token_purchases`, `entitlement_grants`, `blocks`, `wishlist_items`, `listing_favorites` | none                | none                  | own          | none                     |
| `feedback`                                                                                                                | none                | none                  | write-only   | all                      |
| `invites`                                                                                                                 | none                | none                  | none         | all                      |
| `reports`                                                                                                                 | none                | none                  | own          | all                      |
| `job_runs`, `domain_events`                                                                                               | none                | none                  | none         | all                      |
| `marketplace_listings` (active)                                                                                           | read                | read unless blocked   | own          | read                     |
| `pilot_kpis_weekly`                                                                                                       | no privilege        | no privilege          | no privilege | via `admin_pilot_kpis()` |

Writes asserted refused: another collector's items / listings, own `role` / `tokens` / plan / scan quota, `token_ledger` insert, offer status (D-021), invites, notifications to someone else, flags, token packs, `job_runs`; `anon` writes anywhere.

World tables are covered by the catalogue invariants here and by their own files (`0020_world_core` … `0029_clubs_meetups`).

## 3. Rate limits

| Limit                                          | Where enforced                                                                                                                                                                                       | Test               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| OTP email / SMS                                | Supabase Auth (`[auth.rate_limit]` in `supabase/config.toml` for local + branches; **the hosted project's values are set in the dashboard — verify they are not the defaults before pilot**, see §7) | config review      |
| Offers (per buyer)                             | DB trigger `check_offer_rate_limit`                                                                                                                                                                  | `0009_deals.sql`   |
| Reports 10 / 24 h                              | DB trigger `reports_rate_limit` (+ the RPC's own check)                                                                                                                                              | `0016…`, `0031…`   |
| Feedback 10 / 24 h                             | DB trigger `feedback_rate_limit`                                                                                                                                                                     | `0031…`            |
| Scans                                          | `entitlement_scan_quota` in the `ai-scan` Edge Function (402 when exhausted)                                                                                                                         | `0006_catalog.sql` |
| World visits / guestbook / meetup chat / RSVPs | DB triggers                                                                                                                                                                                          | World pgTAP files  |
| Read endpoints `/api/v1/world/*`               | `src/lib/rate-limit.ts` (process-local, best effort)                                                                                                                                                 | unit               |

## 4. Response headers

`src/lib/security-headers.mjs`, applied to every route in `next.config.mjs`; unit-tested (`security-headers.test.ts`) and checked on real responses plus for violations on four screens (`e2e/security.spec.ts`).

- **Content-Security-Policy** — `default-src 'self'`; scripts from self + PostHog only; connections to Supabase (https + wss), PostHog, Sentry; images from self / data / blob / Supabase storage; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self' https://checkout.stripe.com`. `'unsafe-inline'` stays for scripts and styles (App Router bootstrap, theme boot script, inline style attributes); nonces would make every page dynamic. `'unsafe-eval'` is dev-only. Preview deployments additionally allow `vercel.live`.
- **Strict-Transport-Security** `max-age=63072000; includeSubDomains` · **X-Content-Type-Options** `nosniff` · **X-Frame-Options** `DENY` · **Referrer-Policy** `strict-origin-when-cross-origin` · **Cross-Origin-Opener-Policy** `same-origin` · **Permissions-Policy** camera self only.
- zod probes `new Function("")` once; under this CSP that was reported as a violation on every page. The root layout now sets zod's documented `jitless` global before any schema runs.

If a new third-party origin is ever added (payment widget, map, video), add it in `security-headers.mjs` in the same PR — `e2e/security.spec.ts` fails otherwise.

## 5. Dependencies

`pnpm audit --prod --audit-level=high` is a CI step (`checks` job, `pnpm audit:prod`).

- Upgraded in this PR: `next` 16.3.6 → 16.4.6 (two critical unauthenticated-RCE advisories, SSRF, DoS and five cache / disclosure advisories), `zod` 4.6.5 → 4.6.7 (memory exhaustion), `posthog-js` → 1.447.12 (brings `dompurify` 3.4.17, one critical). `sharp` and `source-map-js` are patched transitively.
- **Accepted exception** (`package.json › pnpm.auditConfig.ignoreGhsas`): `xlsx` 0.18.5 — GHSA-4r6h-8v6p-xvw6 (prototype pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS). No fixed version is published to npm (SheetJS ships fixes from its own CDN only). Exposure: the library parses a spreadsheet the collector picked themselves, in their own browser tab, loaded on demand on `/garage/import` only; nothing parsed server-side. Decision needed on moving to the vendor tarball or a CSV-only import (§7).
- Not gated (moderate, build-time only): `glob` / `minimatch` under `@sentry/bundler-plugins`.

## 6. Service role and secrets

Service-role usage (audited by `grep`, enforced by `guard.sh` D-014 for `src/`):

| Where                               | Why                                                    |
| ----------------------------------- | ------------------------------------------------------ |
| `supabase/functions/ai-scan`        | writes scan jobs, quota                                |
| `supabase/functions/stripe-webhook` | credits the ledger after a verified Stripe signature   |
| `supabase/functions/jobs`           | scheduled jobs, `auth.admin.deleteUser`, storage purge |
| `scripts/gamification-replay.ts`    | manual backstop, run from a laptop                     |

None in the Next.js runtime. `STRIPE_SECRET_KEY` is read server-side only (`src/lib/payments`).

Secret inventory and the rotation procedure: `docs/runbook.md` §6.

## 7. Open items (need an owner decision or dashboard access)

1. **Promote this PR to prod promptly** — findings 1, 5 and 6 are live there. Then run the two checks under §1.
2. Hosted Auth rate limits and OTP expiry: confirm in the Supabase dashboard (Auth › Rate limits) — email OTPs per hour, verify attempts, OTP lifetime ≤ 10 min.
3. `pro_purchase` flag is seeded but read nowhere. Decide what it gates (spending tokens on Pro-30d?) or retire it.
4. `xlsx`: vendor tarball vs CSV-only import vs keep the exception.
5. `follows` allows public `SELECT` of raw follower pairs; the spec says count only (carried from S8).
6. Supabase default grants give `anon` / `authenticated` `TRUNCATE` / `REFERENCES` / `TRIGGER` on tables; PostgREST exposes none of them, so this is hygiene, not a hole. A blanket revoke belongs in a release of its own.
7. `world_open_garages` is a definer view by design (public projection); the World track owns it.
