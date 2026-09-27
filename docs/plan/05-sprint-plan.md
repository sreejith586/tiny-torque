# 05 — Sprint Plan & Task Backlog

> Status: DRAFT v1 — 2026-09-27. Generated from `backlog.json` (source of truth) — edit the JSON and re-run `docs/plan/tools/render.py`; `backlog.csv` is Jira-importable (Summary, Description, Epic/Feature, Sprint, Estimate, Dependencies).

## Cadence & capacity

- **Cadence:** 1-week sprints, Mon–Sun, planning Monday, demo/retro Sunday evening (Dubai time)
- **Planned capacity:** ≈ 20 h of your focused time per sprint (you driving Claude Code). Sprints are planned to 18–21 h; the rest is slack for review, surprises and life. Items marked STRETCH are pulled only when a sprint is ahead.
- **Estimates:** Hours are wall-clock for you driving Claude Code, including review and testing. S≈1–1.5h, M≈2–3h, L≈3.5–4h. Anything > 4h was split.
- **Sequencing rule:** DB migration → domain service (+ tests) → UI → Playwright smoke, inside every sprint. Never UI before the migration is on staging.
- **Locking rule:** a sprint is 'locked' on its Monday. New asks go to the next sprint or the stretch register — never into a running sprint (buffer sprint 11 exists so this holds).
- **Release rule (D-028):** Every sprint ends with a production deploy (Sunday, after demo). Unfinished features ship dark behind their flag; nothing half-built is reachable by users. Migrations follow the two-release rule so the previous app version keeps working. The demo runs on production, not staging.

## Definition of Done (every task)

- PROGRESS.md updated; any new decision appended to DECISIONS.md; guard.sh green
- Deployed to production (dark behind its flag if incomplete); prod smoke passed
- Migration applied on local + staging; pgTAP/RLS tests for touched tables green
- Domain service has Vitest coverage for rules; zod schema at every boundary
- UI matches Varun's prototype screen/flow; no new UI patterns (D-027)
- UI works in all 6 themes at 360px and 1280px; loading/empty/error states present
- Domain events emitted; PostHog event mirrored where the feature is a KPI
- Feature behind a flag if it touches money, messaging, AI or ranking
- Playwright smoke updated when a critical flow changes; CI green on the PR
- Docs: CLAUDE.md / ADR / feature spec updated if behaviour or structure changed
- Sreejith reviewed the diff (no self-merge by Claude Code)

## Timeline at a glance

| Sprint | Theme | Planned h | Stretch h | Key migration(s) | Flags introduced |
|---|---|---|---|---|---|
| S0 | Foundation — modern stack, CI, environments | 22.5 | 0 | 0000 baseline, 0001 housekeeping | — |
| S1 | Identity, multi-country, platform primitives | 20 | 0 | 0002 identity_v2 | invite_only, email_otp |
| S2 | Garage v2 — media, server-side search, CSV import | 20.5 | 1 | 0003 media, 0004 garage_v2 | csv_import |
| S3 | AI scanning v2, canonical catalogue, metering | 20 | 0 | 0005 catalog | ai_scan, ai_scan_group |
| S4 | Marketplace — publish & browse | 19.5 | 0.5 | 0006 marketplace_v2 | marketplace_publish |
| S5 | Deals — offers, buy now, trades | 18.5 | 0 | 0007 deals | offers |
| S6 | Deal chat, reviews, trust & safety, notifications | 20 | 0 | 0008 messaging_trust | deal_chat |
| S7 | Tokens, Pro & entitlements | 19.5 | 0 | 0009 tokens | token_purchase, pro_purchase |
| S8 | Gamification & profile completeness | 15.5 | 3 | 0010 gamification | — |
| S9 | PWA, performance, accessibility, scheduled jobs | 17 | 3 | 0011 jobs | — |
| S10 | Hardening & pilot readiness | 18.5 | 0 | — | — |
| S11 | Launch + buffer | 20 | 0 | — | — |
| **Total** | 12 sprints ≈ 12 weeks build + launch | **231.5** | 7.5 | | |

Pilot runs 8–12 weeks after S11 with a weekly maintenance sprint capped at 10 h. H2 planning starts at pilot week 6 using real data.

## What is live in production after each sprint (D-028)

| Sprint | Production increment |
|---|---|
| S0 | Production URL is live on the new stack with everything Varun shipped (landing, sign-in, garage, scan). You and Varun are the only users. Prod DB created from migrations 0000–0001. This is the baseline every later sprint promotes onto. |
| S1 | Multi-country sign-in (phone or email), onboarding v2, /u/{handle} profiles. `invite_only` ON — founders cohort (you, Varun, 3–5 trusted collectors) invited to prod. Flags default OFF for anything not yet built. |
| S2 | Garage v2 with media, server-side search and CSV import live. Founders start loading real collections; the 3–5 pilot shops can be invited early to bulk-load stock (cold-start mitigation). |
| S3 | AI scan v2 with quotas live behind `ai_scan`/`ai_scan_group` ON for founders. Catalogue starts filling from real scans; admin catalogue page live. |
| S4 | Marketplace browse (public, anon-visible) and publish live behind `marketplace_publish` ON for founders. First real listings on prod. |
| S5 | Offers / buy-now / trades live behind `offers` ON for founders. Listings can be reserved and sold. |
| S6 | Deal chat, reviews, report/block and admin moderation live behind `deal_chat`. Notifications bell live. |
| S7 | Token store live. Stripe in **test mode** until D-024 pricing is confirmed, then flipped to live keys with `token_purchase` ON. Paywalls become spendable. |
| S8 | XP, levels, badges, full public profile and complete settings live. Onboarding tutorial on. |
| S9 | Installable PWA, performance/a11y budgets met, scheduled expiry jobs running in prod. |
| S10 | Hardened prod: full RLS matrix, backups drilled, KPI dashboards, legal pages, flags editor. No new user features — this sprint's 'deployable' is the readiness itself. |
| S11 | `invite_only` cohorts opened to the full pilot (30–80). Production is now the pilot. |

## Dependency spine (critical path)

S0 stack/migrations → S1 identity+events+flags → S2 media+garage → S3 catalogue+AI → S4 listings → S5 offers → S6 chat/trust → S7 tokens (retro-wires S2/S3/S4 gates) → S8/S9 polish → S10 hardening → S11 launch. S8 and S9 are the only sprints that could swap order without breaking dependencies.

---

## Sprint 0 — Foundation — modern stack, CI, environments

**Goal.** Everything Varun shipped still works, on Next 16 / React 19 / Tailwind / shadcn, with Supabase CLI migrations, generated types, a domain-layer skeleton, three environments and a green CI. No new user features.

**Demo at end of sprint.** Same app as handover running on staging URL from `main`; PR preview with passing Playwright sign-in smoke; `supabase db reset` rebuilds the DB from migrations.

**Ships to production.** Production URL is live on the new stack with everything Varun shipped (landing, sign-in, garage, scan). You and Varun are the only users. Prod DB created from migrations 0000–0001. This is the baseline every later sprint promotes onto.

**Risks / watch-outs.** Next 16 breaking changes (async request APIs, middleware.ts → proxy.ts, Turbopack default); Tailwind theme mapping fidelity for Aurora/Leather. Time-box the visual fidelity — pixel polish is Sprint 9.

**Decisions locked this sprint:** ADR-01..05, 11–13; Region ap-south-1 (irreversible-ish — confirm before creating prod project); D-023 session protocol, D-027 UX fidelity; D-028 deploy to production every sprint

**Planned hours:** 22.5

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S0-01 | Infra | infra | Repo hygiene & tooling | git init (if needed), pnpm, .nvmrc (Node 22 LTS), editorconfig, prettier, eslint strict + import-order, husky + lint-staged, CODEOWNERS, PR template. | 1.5 | — |
| MV-S0-02 | Infra | infra | Upgrade to Next.js 16.x / React 19 | Codemods (next@16); fix async cookies()/headers()/params; rename middleware.ts → proxy.ts; Turbopack build; verify @supabase/ssr latest; app boots; all Phase 1 pages render. | 3 | MV-S0-01 |
| MV-S0-03 | Infra | frontend | Tailwind 4 + shadcn/ui + theme tokens | Convert theme.ts variable sets into [data-theme] CSS blocks; Tailwind semantic colours (bg, panel, panel-alt, cream, orange, teal, gold, muted, border, danger, violet); shadcn init using tokens; no-flash theme init script; ThemeSwitcher on shadcn Select. Aurora/Leather extras as utility overrides. | 3 | MV-S0-02 |
| MV-S0-04 | Infra | db | Supabase CLI + baseline migrations | supabase init; 0000_baseline.sql = Varun's schema verbatim; 0001_housekeeping.sql (updated_at trigger everywhere, deleted_at, enums replacing text checks, is_admin()); local supabase start; seed skeleton; `db reset` works. | 2.5 | MV-S0-01 |
| MV-S0-05 | Infra | backend | Generated types + domain layer skeleton | supabase gen types → src/types/supabase.ts; delete database.ts; zod; create src/domain/{identity,garage}/{types,schema,service,repo}.ts by splitting api.ts; ESLint no-restricted-imports for @supabase outside repo.ts & lib/supabase; components import services only. | 3 | MV-S0-04 |
| MV-S0-06 | Infra | ops | Environments (Mumbai) + Vercel + first production deploy | Create mini-vault-staging & mini-vault-prod (ap-south-1, Pro plan on prod), Vercel project (bom1), env vars per env, branch protection on main, staging branch auto-deploy. First production deploy of the upgraded app at the end of the sprint; prod smoke checklist (sign-in, garage add, scan) executed. | 2 | — |
| MV-S0-07 | Infra | test | CI pipeline + Playwright scaffold | GitHub Actions: typecheck, lint, vitest, build, supabase db lint, gen-types drift check; Playwright against Vercel preview with Supabase test phone numbers (fixed OTP) for sign-in smoke. | 3 | MV-S0-05,MV-S0-06 |
| MV-S0-08 | F-18 | ops | Sentry + PostHog + Vercel Analytics | Client/server/edge Sentry with source maps; PostHog identify/capture wrapper in lib/analytics; Vercel Analytics; PII scrubbing rules (no phone numbers). | 1.5 | MV-S0-02 |
| MV-S0-09 | Infra | backend | Fix inherited defects | Middleware: /offers requires auth; storage insert policy scoped to `${auth.uid()}/` prefix; saveProfile → PATCH (no null-out); remove seller_mobile from any client read path. | 1.5 | MV-S0-04 |
| MV-S0-10 | Docs | docs | Plan docs into repo + CLAUDE.md + regression checklist | docs/plan/* committed; CLAUDE.md live at root; ADR index; execute Phase-1 regression checklist on staging and record results. | 1 | MV-S0-07 |
| MV-S0-11 | Docs | infra | Decision guard + session protocol wired | tools/guard.sh runs in CI and as a husky pre-push hook; DECISIONS.md and PROGRESS.md in repo; CLAUDE.md session protocol live; PR template includes 'D-xxx touched' and 'Reversible: yes/no' fields; reviewer checklist item 'no accepted decision contradicted'. | 0.5 | MV-S0-01 |

---

## Sprint 1 — Identity, multi-country, platform primitives

**Goal.** Sign in from UAE or India by phone or email, complete a real onboarding with invite code and handle, land on a public profile URL. Events, flags and admin role exist for every later sprint.

**Demo at end of sprint.** Sign up with an Indian and a UAE number (and one email) on staging; /u/{handle} renders; toggle a flag in Supabase and see the app react within 60 s.

**Ships to production.** Multi-country sign-in (phone or email), onboarding v2, /u/{handle} profiles. `invite_only` ON — founders cohort (you, Varun, 3–5 trusted collectors) invited to prod. Flags default OFF for anything not yet built.

**Risks / watch-outs.** Twilio/DLT approval lead time for India (start the paperwork on day 1 of the sprint; email OTP is the fallback so the sprint is not blocked).

**Decisions locked this sprint:** ADR-07, ADR-10

**Planned hours:** 20

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S1-01 | F-01 | db | Migration 0002 identity_v2 | profiles columns (handle citext, country_code, city, bio, pro_until, role, xp/level, quotas, onboarding_completed_at, deleted_at), countries ref + seed AE/IN, public_profiles view, invites, follows, feature_flags, domain_events (monthly partitions). Regenerate types. | 2.5 | MV-S0-04 |
| MV-S1-02 | F-01 | test | pgTAP RLS tests for identity tables | Owner/stranger/anon/admin matrix for profiles, public_profiles, invites, feature_flags, domain_events, follows. Runs in CI via supabase test db. | 2 | MV-S1-01 |
| MV-S1-03 | F-01 | frontend | Login v2: country picker, phone/email OTP | Twilio Verify configured for AE+IN (DLT template submitted), email OTP enabled; UI: country select (AE/IN first, full list), E.164 formatting, 'use email instead', 6-digit input, resend timer 30 s, error copy; Supabase rate limits tuned. | 3 | MV-S1-01 |
| MV-S1-04 | F-01 | frontend | Onboarding v2 | Steps: invite code (flag invite_only) → account type → names → handle (auto-suggest, live uniqueness via server action) → country/city typeahead (static per-country list) → avatar (temporary URL; media in S2) → done. Progress indicator; resumable. | 3.5 | MV-S1-01 |
| MV-S1-05 | F-01 | backend | domain/identity service | zod schemas, PATCH profile, handle rules (regex, reserved words, 30-day change cooldown), invite redemption (atomic), country/currency helpers. Vitest. | 2 | MV-S1-01 |
| MV-S1-06 | Infra | backend | domain/events + domain/flags + admin shell | Typed event catalogue & writer; flags repo with 60 s cache, audience evaluation (plans/countries/user_ids/percent), useFlag() provider + server helper; /admin layout gated by role in middleware + RLS. | 2.5 | MV-S1-01 |
| MV-S1-07 | F-14 | frontend | Public profile v1 /u/[handle] | Header (avatar, name, handle, shop badge, country/city, member since) + public items grid from public_profiles + collection_items; OG meta; 404 for unknown handle. | 2 | MV-S1-05 |
| MV-S1-08 | F-14 | backend | Settings: export JSON + delete account (stub) | Settings page skeleton; export all items as JSON download; delete account server action that anonymises PII + soft-deletes (full effects finalised S8). | 1.5 | MV-S1-05 |
| MV-S1-09 | F-01 | test | Playwright: sign-in → onboarding → profile | Test phone number flow; assert handle URL renders; assert mobile absent from public_profiles fetch. | 1 | MV-S1-04,MV-S1-07 |

---

## Sprint 2 — Garage v2 — media, server-side search, CSV import

**Goal.** The garage is production-grade: photos as first-class media with plan limits, fast server-side search/filter/sort over large collections, enum-driven fields, and shops can bulk-load stock via CSV.

**Demo at end of sprint.** Import a 300-row CSV, search it instantly, add an item with photos (free-plan gate visible), see Top Brands stats.

**Ships to production.** Garage v2 with media, server-side search and CSV import live. Founders start loading real collections; the 3–5 pilot shops can be invited early to bulk-load stock (cold-start mitigation).

**Risks / watch-outs.** Media migration from jsonb URLs; image compression quality on low-end Android; CSV edge cases (Excel encodings).

**Decisions locked this sprint:** ADR-08

**Planned hours:** 20.5

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S2-01 | F-02 | db | Migration 0003 media + private buckets | media table, buckets item-media/profile-media (private), storage policies by key prefix via ownership fn, backfill script photos→media (idempotent), compat view collection_items_v1. | 2.5 | MV-S1-01 |
| MV-S2-02 | F-02 | frontend | Client image pipeline + <MediaImage> | Downscale ≤1600px, JPEG q0.82, ≤400KB; signed upload URL flow; progress; media row create/finalise; <MediaImage> using Supabase transforms + signed URL cache (public items long-lived). | 3 | MV-S2-01 |
| MV-S2-03 | F-02 | db | Migration 0004 garage_v2 | collection_items: catalog_model_id, color, is_favorite, notes, currency, enums (condition/packaging/rarity), tsvector + GIN, indexes; drop photo/photos after backfill verified. pgTAP. | 1.5 | MV-S2-01 |
| MV-S2-04 | F-02 | backend | domain/garage service | list(query, filters, sort, cursor) server-side; add/update/softDelete/restore; findDuplicates (catalog id OR ilike triple); stats (totals, dupes, value, top brands). Vitest with repo mock + one integration test against local DB. | 3 | MV-S2-03 |
| MV-S2-05 | F-02 | frontend | Garage UI v2 | Toolbar: search (debounced, URL state), filter sheet (brand, rarity, condition, public, favourite, for sale), sort, grid/list persisted; infinite scroll via TanStack Query + route handler; CarCard with photo carousel; empty states. | 3 | MV-S2-04 |
| MV-S2-06 | F-02 | frontend | Add/Edit item form v2 | shadcn form + zod; progressive disclosure; enum selects; colour; notes; multi-photo uploader with entitlement gate (photoLimit) → Paywall placeholder; duplicate banner with 'increase qty instead'. | 3 | MV-S2-02,MV-S2-04 |
| MV-S2-07 | F-02 | frontend | Item detail v2 | Gallery, edit, public toggle, favourite, delete (checks active listing → prompt), stats chips. Server component + actions. | 1.5 | MV-S2-06 |
| MV-S2-08 | F-04 | frontend | CSV / XLSX import | Template download (csv+xlsx); papaparse + SheetJS; header mapping UI; zod row validation preview with errors; duplicate handling choice; batched server action (100/row batches) with progress; summary; flag csv_import. | 3 | MV-S2-04 |
| MV-S2-09 | F-02 | frontend | STRETCH: Trash with 30-day restore | Settings › Trash lists soft-deleted items; restore; purge job later (S9). | 1 | MV-S2-04 |

---

## Sprint 3 — AI scanning v2, canonical catalogue, metering

**Goal.** Scanning is reliable, metered and cheap: structured output, quota enforced before spend, every job costed, and every accepted scan strengthens the canonical catalogue.

**Demo at end of sprint.** Scan a group photo of 6 cars → review list with confidence + catalogue match chips → add to garage; free user hits quota at 10 and sees paywall; admin sees cost per scan and proposed models to verify.

**Ships to production.** AI scan v2 with quotas live behind `ai_scan`/`ai_scan_group` ON for founders. Catalogue starts filling from real scans; admin catalogue page live.

**Risks / watch-outs.** Model accuracy on blurry/angled photos; catalogue fuzzy-match false positives (keep auto-link threshold high at 0.85).

**Decisions locked this sprint:** ADR-06

**Planned hours:** 20

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S3-01 | F-05 | db | Migration 0005 catalog + ai_scan_jobs | catalog_brands, catalog_models (unique idx, tsvector, pg_trgm), ai_scan_jobs, entitlement_scan_quota(uid) rolling-30d fn; seed loader for brands + starter castings CSV (Varun maintains). pgTAP. | 2.5 | MV-S2-03 |
| MV-S3-02 | F-03 | backend | Edge Function ai-scan v2 | Verify JWT; check quota (402 + paywall payload); fetch media from Storage by media_id; Anthropic tool_use structured output (candidate schema); one retry; trigram match to catalogue with score bands; write ai_scan_jobs (tokens, cost, latency); kill-switch flag check. Deno unit tests with mocked fetch. | 4 | MV-S3-01 |
| MV-S3-03 | F-03 | backend | domain/ai + domain/catalog + entitlements.scanQuota | Client-side orchestration (upload → invoke → candidates), acceptance → items + propose unknown brand/model, quota read model for UI, typed errors. | 2 | MV-S3-02 |
| MV-S3-04 | F-03 | frontend | Single-car scan → prefill add form | 'Scan' tab in add flow: camera/file, progress, prefill fields + match chip (link/unlink), confidence hint, fallback to manual on failure. | 2.5 | MV-S3-03 |
| MV-S3-05 | F-03 | frontend | Group scan review flow v2 | Port /garage/scan to v2 components: per-candidate edit sheet, include toggles, confidence badge, match chip, 'Add N to garage', post-add summary; flag ai_scan_group. | 3 | MV-S3-03 |
| MV-S3-06 | F-11 | frontend | Paywall for scan quota (pre-tokens) | Reusable <Paywall context> component; scan variant shows quota state; 'buy scan pack' disabled with 'coming soon' until S7 (flag token_purchase). | 1 | MV-S3-03 |
| MV-S3-07 | F-16 | frontend | Admin › Catalogue proposals + Scan jobs | Proposed models grouped by brand w/ counts; verify / merge (transactional re-point) / edit / reject; scan jobs table (last 100) with cost and month total. | 2.5 | MV-S3-01 |
| MV-S3-08 | F-03 | test | Scan accuracy harness | 20-photo fixture set (Varun supplies) with expected labels; script runs ai-scan on staging and writes precision/recall CSV → baseline for the 60 % acceptance KPI. | 1.5 | MV-S3-02 |
| MV-S3-09 | F-03 | test | Playwright scan smoke (mocked function) | Intercept functions.invoke with fixture candidates; complete review → items exist. | 1 | MV-S3-05 |

---

## Sprint 4 — Marketplace — publish & browse

**Goal.** Collectors publish from their garage within plan limits and anyone (including signed-out visitors) can browse a fast, filterable, country-aware marketplace with wishlists and favourites.

**Demo at end of sprint.** Publish 2 listings on free plan, 3rd hits paywall; browse from an anon window filtered to UAE then All; favourite; wishlist; share link shows OG image.

**Ships to production.** Marketplace browse (public, anon-visible) and publish live behind `marketplace_publish` ON for founders. First real listings on prod.

**Risks / watch-outs.** Listing v2 migration drops denormalised fields — verify no reads remain; browse query performance with combined filters (test with 5k seeded rows).

**Planned hours:** 19.5

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S4-01 | F-06 | db | Migration 0006 marketplace_v2 | Listings rewrite (drop seller_* & offers jsonb; add catalog_model_id, listing_type, currency, country_code, min_offer, description, counters, expires_at, sold fields, tsvector), listing_favorites, wishlist changes, enforce_active_listing_limit trigger + entitlement_listing_slots(uid) (base 2, Pro unlimited; grants in S7). pgTAP incl. limit test. | 3 | MV-S2-03 |
| MV-S4-02 | F-06 | backend | domain/marketplace service | publish/update/renew/remove; browse(filters, sort, cursor, country default = viewer's); wishlist CRUD; favourites; entitlements.listingSlots + can('publish_listing'). Vitest + integration test for browse filters. | 3 | MV-S4-01 |
| MV-S4-03 | F-06 | frontend | Publish flow from item detail | Sheet: type (sale/trade/both), price + currency, open-to-offers → min offer, qty, description, photo requirement notice, preview card; paywall at limit; flag marketplace_publish. | 3 | MV-S4-02 |
| MV-S4-04 | F-06 | frontend | /market browse UI | Filter sheet + active chips (brand, type, condition, seller type, price range, favourites, search), country toggle (mine/all), sort, infinite scroll, card photo carousel, skeletons, anon-friendly. | 3.5 | MV-S4-02 |
| MV-S4-05 | F-06 | frontend | Listing detail + seller card + share | Public route; gallery; seller card (public_profiles: avatar, handle, rating placeholder, country, member since); share (Web Share API) + /og route rendering first photo; view_count debounced RPC; CTA placeholders for offers (S5). | 2.5 | MV-S4-02 |
| MV-S4-06 | F-07 | frontend | Wishlist + favourites UI | Wishlist page (add free-text or catalogue pick, max price, notify toggle), heart on cards/detail, favourites filter. | 2 | MV-S4-02 |
| MV-S4-07 | F-06 | frontend | My listings management | /market/mine tabs active/reserved/sold/expired; renew, edit, remove; expiry countdown. | 1.5 | MV-S4-02 |
| MV-S4-08 | F-06 | test | Playwright: publish → visible to anon | Publish in authed context; assert visible in anon browse with country filter; assert no mobile in payload. | 1 | MV-S4-04 |
| MV-S4-09 | F-06 | frontend | STRETCH: Trending sort | Sort by offer_count over last 7 days (counter exists; offers arrive in S5). | 0.5 | MV-S4-04 |

---

## Sprint 5 — Deals — offers, buy now, trades

**Goal.** Buyers make cash offers, buy now, or propose trades; sellers manage them in an inbox; the offer state machine is enforced in the database, race-safe and rate-limited.

**Demo at end of sprint.** Two buyers offer on one listing; seller accepts one → other auto-declined, listing reserved; seller marks sold; 6th offer in an hour is rejected.

**Ships to production.** Offers / buy-now / trades live behind `offers` ON for founders. Listings can be reserved and sold.

**Risks / watch-outs.** State-machine edge cases; concurrency on accept (use row lock in RPC); UX clarity of reserved vs sold.

**Planned hours:** 18.5

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S5-01 | F-08 | db | Migration 0007 offers + transition RPC + notifications table | offers table + partial unique (pending per buyer/listing), transition_offer(offer_id, action) SECURITY DEFINER w/ role checks + FOR UPDATE lock + auto-decline + events; check_offer_rate_limit trigger; seller_reviews.offer_id→uuid unique; notifications table (early, for S5 consumers). pgTAP incl. concurrent accept test. | 3.5 | MV-S4-01 |
| MV-S5-02 | F-08 | backend | domain/deals service | createCashOffer / buyNow / proposeTrade (validate min offer, ≤3× price, trade items public & owned, block check), transitions via RPC, inbox queries. Vitest table-driven state tests. | 3 | MV-S5-01 |
| MV-S5-03 | F-08 | frontend | Make-offer UI on listing | Sheet with tabs Cash / Buy now / Trade (public-item picker 1–3 + cash top-up), message, min-offer hint, rate-limit and pending-offer messaging; success state. | 3.5 | MV-S5-02 |
| MV-S5-04 | F-08 | frontend | /offers inbox | Received / Sent tabs grouped by listing; pending badges; actions accept / decline / withdraw / cancel / mark sold with confirmations; auto-decline explanations; empty states. | 3.5 | MV-S5-02 |
| MV-S5-05 | F-08 | frontend | Listing status UX | Reserved/Sold badges in browse & detail; disable CTAs appropriately; 'mark sold outside app' on my listings. | 1.5 | MV-S5-02 |
| MV-S5-06 | F-12 | backend | Notification consumer for offer events | Postgres trigger on domain_events (offer.*) → notifications rows; in-app toast via Realtime subscription hook (bell UI in S6). | 1.5 | MV-S5-01 |
| MV-S5-07 | F-08 | test | Flag `offers` + Playwright deal flow | offer → accept → mark sold across two browser contexts; kill switch hides CTAs. | 1.5 | MV-S5-04 |
| MV-S5-08 | Infra | backend | Route guards for /offers, /deals | Middleware auth; suspended users blocked (field lands S6, guard ready). | 0.5 | MV-S5-04 |

---

## Sprint 6 — Deal chat, reviews, trust & safety, notifications

**Goal.** After a deal is agreed the two parties talk in-app, the buyer reviews the seller after completion, and abuse has a path: report, block, admin queue, suspension.

**Demo at end of sprint.** Accept an offer → chat in real time between two browsers → mark sold → buyer reviews → rating shows on seller profile; report a listing → admin resolves; blocked user can't offer.

**Ships to production.** Deal chat, reviews, report/block and admin moderation live behind `deal_chat`. Notifications bell live.

**Risks / watch-outs.** Realtime auth on private channels; clean-language false positives on car names (allowlist).

**Planned hours:** 20

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S6-01 | F-09 | db | Migration 0008 messaging + trust | deal_messages (insert only when offer accepted/completed & party & not blocked), blocks, reports v2 (resolution fields, admin policies), profiles.suspended_until, Realtime publication for deal_messages & notifications. pgTAP. | 2.5 | MV-S5-01 |
| MV-S6-02 | F-09 | frontend | domain/messaging + chat UI | Thread per offer (/deals/[offerId]); Realtime subscription hook with reconnect; optimistic send; read receipts; offline banner; blocked/closed states. | 3.5 | MV-S6-01 |
| MV-S6-03 | F-10 | frontend | Reviews | Prompt after completion; form (1–5 + text); recompute_seller_rating trigger; display on public profile + listing seller card; unique per offer enforced. | 2.5 | MV-S6-01 |
| MV-S6-04 | F-15 | backend | Clean-language validator | Server-side word list + car-name allowlist; zod refinement applied to name, handle, bio, listing text, messages, reviews; friendly error copy; unit tests with tricky cases. | 2 | MV-S1-05 |
| MV-S6-05 | F-15 | frontend | Report + block flows | Report sheet (listing/user/message; reason enum + notes; 10/day limit); block/unblock; effects: hide listings/profile both ways, deny offers & messages (queries + RLS). | 2.5 | MV-S6-01 |
| MV-S6-06 | F-12 | frontend | Notifications centre | Bell with Realtime unread count; list; mark read; consumer trigger extended to message/review/report events; deep links. | 3 | MV-S5-06,MV-S6-01 |
| MV-S6-07 | F-16 | frontend | Admin › Reports queue + Users | Queue with target preview; actions dismiss / remove listing / warn / suspend (sets suspended_until, emits event); Users search + view; suspended-user screen + middleware block. | 3 | MV-S6-01 |
| MV-S6-08 | F-09 | test | Flag `deal_chat` + Playwright chat smoke | Two contexts exchange messages; message on declined offer rejected. | 1 | MV-S6-02 |

---

## Sprint 7 — Tokens, Pro & entitlements

**Goal.** Money works: buy token packs via Stripe, spend tokens on listing slots, scan packs and Pro; every gate in the app reads one entitlements module; the ledger is append-only and idempotent.

**Demo at end of sprint.** Buy a pack in Stripe test mode → balance updates → spend on a listing slot → 3rd listing publishes; replay the webhook → no double credit; refund → negative ledger row.

**Ships to production.** Token store live. Stripe in **test mode** until D-024 pricing is confirmed, then flipped to live keys with `token_purchase` ON. Paywalls become spendable.

**Risks / watch-outs.** Stripe account approval timing for Hypermax FZE (start now); pricing decision needed from you + Varun by sprint start.

**Decisions locked this sprint:** ADR-09 (merchant of record, pack prices, AED pricing) — low reversibility once customers pay

**Planned hours:** 19.5

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S7-01 | F-11 | ops | Stripe setup + pricing decision | Stripe account (Hypermax FZE), products/prices for 2 packs, test mode keys, webhook endpoint registered; record pack tokens/prices and spend costs (slot, scan pack, Pro 30d) in 04 F-11 + seed. | 1.5 | — |
| MV-S7-02 | F-11 | db | Migration 0009 tokens | token_packs (seed), token_ledger (append-only, idempotency_key), token_purchases, entitlement_grants, spend_tokens RPC (atomic), recompute_token_balance trigger, entitlement fns read grants + pro_until. pgTAP: idempotency, balance = Σ ledger property, insufficient balance. | 3 | MV-S4-01 |
| MV-S7-03 | F-11 | backend | Edge Function stripe-webhook | Signature verification; checkout.session.completed → purchase paid + ledger credit (idempotent on event.id); charge.refunded → negative row; failures alert Sentry. Deno tests with recorded fixtures. | 2.5 | MV-S7-02 |
| MV-S7-04 | F-11 | backend | domain/tokens + entitlements final | createCheckoutSession (server action, provider interface, Stripe impl), purchase status poll, history; entitlements: photoLimit, listingSlots, scanQuota, isPro, can(...) reading grants/pro_until; spend actions for slot/scan pack/Pro. Vitest. | 3 | MV-S7-02 |
| MV-S7-05 | F-11 | frontend | Tokens UI | /tokens store (packs, what tokens buy), Checkout redirect, success/cancel pages polling balance, Settings › Tokens history, balance chip in nav. | 3 | MV-S7-04 |
| MV-S7-06 | F-11 | frontend | Paywall final + Pro purchase | Contextual paywall (photo/listing/scan) offering spend-now (if balance) or buy tokens; Pro purchase flow with pro_until display and benefits list. | 2.5 | MV-S7-04 |
| MV-S7-07 | F-11 | frontend | Retro-wire gates to spendable entitlements | Photo limit (S2), listing limit (S4 trigger + UI), scan quota (S3 function + UI) now honour grants/Pro; remove 'coming soon'. | 1.5 | MV-S7-04 |
| MV-S7-08 | F-11 | test | Flags + Playwright Stripe test-mode E2E | token_purchase / pro_purchase flags; E2E: buy pack (Stripe test card) → balance → spend slot → publish 3rd listing. | 2 | MV-S7-05 |
| MV-S7-09 | F-11 | docs | Token T&Cs + refund policy copy | Varun drafts, you review; linked from store and settings. | 0.5 | — |

---

## Sprint 8 — Gamification & profile completeness

**Goal.** Collecting feels rewarding (XP, levels, badges computed from the event log) and the public profile is something people want to share. Settings are complete.

**Demo at end of sprint.** Add items/publish/complete a deal → XP and badge unlocks appear; replay script recomputes identical XP; share a profile with banner and OG image.

**Ships to production.** XP, levels, badges, full public profile and complete settings live. Onboarding tutorial on.

**Risks / watch-outs.** Over-investing in polish — keep to Varun's five badges; daily quest only if slack.

**Planned hours:** 15.5

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S8-01 | F-13 | db | Migration 0010 gamification | achievements ref (seed 5), user_achievements, xp/level columns already on profiles; indexes. | 1.5 | MV-S1-01 |
| MV-S8-02 | F-13 | backend | domain/gamification consumers | XP rules + daily caps, level table/tiers, badge evaluators as event consumers (trigger or scheduled Edge job), replay script; Vitest proves replay determinism. | 3.5 | MV-S8-01 |
| MV-S8-03 | F-13 | frontend | Stats dashboard + badges + level bar | Profile tab with totals, value, dupes, top brands chart (tokens-aware), badge grid with progress, unlock toast + notification. | 3 | MV-S8-02 |
| MV-S8-04 | F-14 | frontend | Public profile v2 | Banner upload (media), bio, tabs Collection / Listings / Reviews, level/tier, rating, share sheet with OG image route. | 3 | MV-S6-03 |
| MV-S8-05 | F-14 | frontend | Settings completeness | Switch account type, blocked users list, theme, export, delete account (full anonymisation + cascade), tokens history link, legal links, feedback form. | 2.5 | MV-S6-05 |
| MV-S8-06 | F-01 | frontend | Onboarding tutorial + first-run states | 4-step skippable tour; tutorial_dismissed_at; contextual empty states pointing to scan/import. | 2 | MV-S1-04 |
| MV-S8-07 | F-13 | frontend | STRETCH: daily quest · Pro flair · follow button | Pick in that order if slack remains. | 3 | MV-S8-02 |

---

## Sprint 9 — PWA, performance, accessibility, scheduled jobs

**Goal.** The app feels native on a mid-range Android over 4G, passes AA contrast in all six themes, installs as a PWA, and background housekeeping (expiry) runs itself.

**Demo at end of sprint.** Install to home screen; Lighthouse ≥ 90 perf/a11y on staging; screenshot matrix of every screen × 6 themes; expired listing flips status overnight.

**Ships to production.** Installable PWA, performance/a11y budgets met, scheduled expiry jobs running in prod.

**Risks / watch-outs.** Service-worker caching bugs (keep it to app shell + read-only garage cache).

**Planned hours:** 17

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S9-01 | F-19 | db | Migration 0011 pg_cron jobs | expire_listings (hourly), expire_offers (hourly), purge trash (daily, 30d), job run log table; alert on failure. | 2 | MV-S5-01 |
| MV-S9-02 | F-17 | frontend | PWA | Manifest + icons, install prompt (2nd visit), service worker (app shell + last garage page read-only, offline banner), iOS meta/splash. | 3 | MV-S2-05 |
| MV-S9-03 | F-17 | frontend | Performance pass | Bundle analysis, RSC/client boundaries, image sizes & transforms, cursor pagination audit, pg_stat_statements review + indexes, Lighthouse CI budget in GH Actions. | 4 | MV-S4-04,MV-S5-04 |
| MV-S9-04 | F-17 | frontend | Accessibility pass | Contrast script over 6 themes (fix failing tokens), focus traps in sheets/dialogs, labels, reduced-motion, axe checks in Playwright. | 3 | MV-S0-03 |
| MV-S9-05 | F-17 | test | Theme QA screenshot matrix | Playwright screenshots every route × 6 themes × 2 widths; fix regressions; Aurora glass / Leather chrome extras verified. | 3 | MV-S9-04 |
| MV-S9-06 | F-17 | frontend | Error / empty / loading audit | Every route has loading.tsx, error.tsx, empty state; Sentry breadcrumbs; user-facing error copy; retry affordances. | 2 | — |
| MV-S9-07 | F-07 | backend | STRETCH: wishlist match job + email notifications | Nightly match → notifications; Resend transactional email for offers/messages when offline. | 3 | MV-S9-01 |

---

## Sprint 10 — Hardening & pilot readiness

**Goal.** You can defend the security posture, restore from backup, read the KPIs, flip any risky feature off, and onboard a cohort with a repeatable kit.

**Demo at end of sprint.** Full RLS matrix green; restore drill documented with timing; PostHog funnels live; admin Overview shows users/items/listings/offers/scan cost/token revenue; prod promote + rollback rehearsed.

**Ships to production.** Hardened prod: full RLS matrix, backups drilled, KPI dashboards, legal pages, flags editor. No new user features — this sprint's 'deployable' is the readiness itself.

**Risks / watch-outs.** Discovering RLS gaps late — the matrix has been growing since S1, so this is completion, not discovery.

**Planned hours:** 18.5

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S10-01 | F-19 | test | Security review | Complete pgTAP matrix for all tables; rate limits (OTP/offers/reports/scans) verified; CSP + security headers; pnpm audit gate; secrets rotation procedure; service-role usage audit (Edge only). | 3.5 | MV-S9-01 |
| MV-S10-02 | F-19 | ops | Backup/restore drill + runbook | PITR restore to a scratch project, timed; runbook: incident severity, rollback (Vercel promote previous + migration down strategy), key rotation, on-call contacts. | 2 | — |
| MV-S10-03 | F-18 | backend | Analytics & KPI views | PostHog funnels/insights for every 01 §6 metric; pilot_kpis_weekly materialised view; admin Overview numbers from views. | 3 | MV-S7-04 |
| MV-S10-04 | F-16 | frontend | Admin › Flags editor, Invites, Overview costs | Flags toggle + audience JSON with schema validation + audit (updated_by); invite codes/cohorts; Overview cost tiles (scan $, token revenue, SMS est.). | 2.5 | MV-S1-06 |
| MV-S10-05 | F-15 | docs | Legal & policy pages + feedback form | T&Cs, privacy, offline-deal disclaimer, abuse policy; feedback/bug form → admin notifications. | 2 | — |
| MV-S10-06 | F-17 | test | Load sanity | Seed staging with 5k items / 1k listings / 500 offers; simple k6 script on browse/search/garage; fix top 3 hot spots. | 2.5 | MV-S9-03 |
| MV-S10-07 | F-19 | ops | Release process dry run | staging → prod promote with db push gated by checklist (06 §5); rollback rehearsal; on-call Sentry alert routing. | 1.5 | MV-S10-02 |
| MV-S10-08 | F-19 | docs | Pilot ops kit | Invite codes per cohort, onboarding message templates (WhatsApp/email), feedback channel, weekly KPI report template, known-issues page. | 1.5 | MV-S10-04 |

---

## Sprint 11 — Launch + buffer

**Goal.** Real collectors are in. Cohort 1 shadowed closely, cohort 2 once stable. Explicit buffer absorbs carry-over so earlier sprints never silently overflow.

**Demo at end of sprint.** Production live; first offers and first token purchase observed; KPI dashboard populated.

**Ships to production.** `invite_only` cohorts opened to the full pilot (30–80). Production is now the pilot.

**Risks / watch-outs.** Support load; OTP delivery in the wild; cost surprises — daily check for week 1.

**Planned hours:** 20

| ID | Feature | Type | Task | What done looks like | Est (h) | Depends on |
|---|---|---|---|---|---|---|
| MV-S11-01 | F-19 | ops | Seed production | countries, token packs, brands/castings, flag defaults (invite_only on), admin users, Stripe live keys. | 1 | MV-S10-07 |
| MV-S11-02 | F-19 | ops | Cohort 1 onboarding (10–15 users incl. 2 shops) | Shadow sessions, hotfix loop, daily KPI/cost check. | 6 | MV-S11-01 |
| MV-S11-03 | F-19 | ops | Cohort 2 onboarding | Remaining invites; monitor; weekly report #1. | 4 | MV-S11-02 |
| MV-S11-04 | Infra | infra | Buffer for carry-over | Reserved. Anything not done in S0–S10 lands here; if unused, pull from stretch register. | 8 | — |
| MV-S11-05 | Docs | docs | Pilot retro #1 + H2 grooming | What the data says vs 01 §6; decide priority-placement stance; groom H2 backlog. | 1 | MV-S11-03 |

---
