# 02 — Architecture Blueprint & Decision Records

> Status: DRAFT v1 — 2026-09-27. Each ADR states **reversibility** explicitly. Change an ADR only by adding a superseding entry, never by editing history.

---

## 1. What we inherit (as-built audit of Varun's handover)

| Layer | As handed over | Verdict |
|---|---|---|
| Framework | Next.js 14.2 App Router, React 18, TS 5.5, plain CSS + CSS variables, no UI lib, no Tailwind | Upgrade in place (Sprint 0) |
| Auth | Supabase phone OTP; `middleware.ts` refreshes session + guards routes; `COUNTRY_CODE = '+91'` hardcoded in login | Keep mechanism; make multi-country |
| Data access | `src/lib/api.ts` — one flat module, every fn takes `SupabaseClient`, called directly from client components | Keep the "client passed in" pattern; split by domain; move mutations server-side |
| Schema | `supabase/schema.sql` pasted by hand; 6 tables; RLS on all; `car-photos` public bucket. Denormalised seller fields + `offers jsonb` on listings | Convert to CLI migrations; normalise offers; keep RLS-first posture |
| Types | `src/types/database.ts` hand-written mirror of schema | Replace with `supabase gen types` |
| AI | Edge Function `scan-photo` (Deno) → Anthropic Messages API, one image, JSON array parse with fence stripping | Keep shape; add metering, structured output, downscale, retries |
| Theming | 6 themes as CSS variable sets in `theme.ts`, localStorage persisted, `.theme-3d` / `.theme-leather` classes | Preserve exactly as design tokens; map into Tailwind |
| Tests / CI / envs | None | Add in Sprint 0 |
| Working features | Landing, login, onboarding, garage CRUD (3 photos), detail/edit/delete, client-side search/filter/sort, profile edit + theme switcher, batch scan review flow. `/market`, `/offers` are stubs | Regression baseline for Sprint 0 |

Known defects to fix early: `/market` and `/offers` are public in middleware (fine for market, not for offers); `photos` bucket allows any authenticated user to upload anywhere (no per-user path policy); no `updated_at` anywhere; no soft delete; `saveProfile` upsert can null-out fields on partial edit.

## 2. Target architecture (H1)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Clients                                                              │
│  Next.js 16 web app (PWA) ── later: Three.js garage viewer, Unity/    │
│                                     Godot world client (H3)           │
└───────────────┬───────────────────────────────────────┬───────────────┘
                │ Server Components / Server Actions     │ /api/v1 (thin, H3-facing,
                │ (same process, Vercel)                 │  added only when a 2nd client exists)
┌───────────────▼───────────────────────────────────────▼───────────────┐
│  Domain layer  src/domain/*  (pure TS, no React, no fetch)            │
│  garage · catalog · marketplace · deals · messaging · tokens ·        │
│  entitlements · gamification · trust · identity · flags · analytics   │
│  Each module: types.ts · schema.ts (zod) · service.ts · repo.ts       │
└───────────────┬───────────────────────────────────────────────────────┘
                │ repo.ts is the ONLY place Supabase is called
┌───────────────▼───────────────────────────────────────────────────────┐
│  Supabase (region ap-south-1 Mumbai)                                  │
│  Postgres + RLS · Auth (phone/email OTP) · Storage (private buckets   │
│  + signed/transform URLs) · Realtime (deal chat, notifications) ·     │
│  Edge Functions: ai-scan · stripe-webhook · scheduled-jobs (quota      │
│  reset, expiry) · pg_cron for DB-only jobs                            │
└───────────────┬───────────────────────────────────────────────────────┘
                │
   Anthropic API (vision)   Stripe (Checkout + webhooks)   SMS provider (Twilio / MSG91)
   Sentry · PostHog · Vercel Analytics · Resend (transactional email, optional)
```

### Request patterns

| Concern | Pattern |
|---|---|
| Reads for pages | Server Components call `domain/*.service` with a server Supabase client → RLS enforced by user JWT. Lists that need client interactivity (filters, infinite scroll) use TanStack Query hitting Route Handlers that call the same service. |
| Mutations | Server Actions → zod parse → `service` → `repo`. Never a raw Supabase write from a component. Client-side Supabase is used only for Auth, Realtime subscriptions, and direct Storage uploads (signed). |
| Cross-cutting side effects | `service` emits `domain_events` (see 03). XP, badges, notifications, analytics are **consumers** of events, not inline code in the mutation path. |
| AI & payments | Edge Functions (secrets never reach the browser). App calls them via `supabase.functions.invoke` with the user JWT; the function re-verifies the JWT and checks entitlements server-side. |
| Entitlements | Single `domain/entitlements` module answers "can user X do Y?" from `plan`, `pro_until`, token balance, quotas. UI *and* server both ask it; DB constraints back the critical ones (active listing count via trigger). |
| Feature flags | `feature_flags` table (name, enabled, audience jsonb) read server-side, cached 60 s, exposed to client via a `useFlag()` provider. Kill-switches for: ai-scan, offers, deal-chat, token-purchase, csv-import. |

## 3. Decision records

### ADR-01 Keep Supabase as the backend
- **Decision:** Postgres + Auth + Storage + Edge Functions + Realtime on Supabase, Pro plan from Sprint 0 (needed for PITR, no pausing, 8 GB).
- **Why:** Already in place; RLS-first fits a marketplace; Realtime covers chat; solo builder should not run infra. Postgres is the one thing every future client (including a game server) can sit on.
- **Reversibility:** Medium. Data is plain Postgres (portable). Auth and Storage URLs are the sticky parts — mitigated by keeping all Supabase calls inside `repo.ts` and storing storage *paths*, not full URLs.

### ADR-02 Region: `ap-south-1` (Mumbai)
- **Why:** Dubai↔Mumbai ~35 ms, serves both pilot countries; India likely the larger user base; Bahrain (`me-south-1`) is the alternative with worse India latency.
- **Reversibility:** **Low** (region migration = dump/restore with downtime). Decide before creating the production project. Vercel functions region set to `bom1` to match.

### ADR-03 Upgrade app layer in place: Next.js 16.x / React 19 / Tailwind 4 / shadcn-ui
- **Why:** Component library removes ~40 % of UI effort for a solo builder; Tailwind tokens let the 6 themes survive as CSS variables mapped to semantic classes; RSC + Server Actions are the mutation path.
- **How themes survive:** `theme.ts` variables become `--mv-bg`, `--mv-panel`… on `[data-theme]`; Tailwind config maps `bg-panel`, `text-cream`, etc. to them. Six themes remain exactly six CSS variable sets. Aurora/Leather extras stay as `.theme-3d`/`.theme-leather` utility overrides.
- **Reversibility:** High.

### ADR-04 Migrations via Supabase CLI, types generated
- **Decision:** `supabase/migrations/*.sql` as the only way schema changes happen; `supabase db diff` for authoring, `supabase gen types typescript` into `src/types/supabase.ts` in CI; hand-written `database.ts` deleted. Baseline migration = Varun's schema verbatim; every change after is a new file.
- **Reversibility:** High.

### ADR-05 Domain layer with repo boundary (multiverse insurance #1)
- **Decision:** `src/domain/<module>/{types,schema,service,repo}.ts`. Components import `service` only. No Supabase types leak above `repo`.
- **Why:** When the H3 world client needs "load garage for collector X", it calls the same service via a thin `/api/v1` — no logic duplication. Also makes Vitest unit tests trivial (mock repo).
- **Reversibility:** High (but the value only exists if the rule is enforced — ESLint `no-restricted-imports` rule for `@supabase/*` outside `repo.ts` and `lib/supabase/*`).

### ADR-06 Canonical catalogue (multiverse insurance #2)
- **Decision:** Introduce `catalog_brands` and `catalog_models` (canonical brand + model + scale + series + year, one row per real-world casting/release). `collection_items.catalog_model_id` and `marketplace_listings.catalog_model_id` are nullable FKs. AI scan proposes a canonical match; accepted scans upsert unknowns as `status='proposed'`; admin promotes to `verified`.
- **Why:** Everything downstream keys off it: dedupe, wishlist alerts, visual search ("find listings of this casting"), value stats, and in H3 exactly one 3D asset per canonical model. Without it, H3 needs a retroactive normalisation of free-text brand/model — the expensive rewrite this plan exists to avoid. (Reusable with the item-canonicalisation engine you've been designing separately — same shape of problem.)
- **Reversibility:** Medium-High. FK is nullable; free-text fields stay as the user typed them.

### ADR-07 Append-only `domain_events` (multiverse insurance #3)
- **Decision:** Every service mutation writes a row `(actor_id, type, entity, entity_id, payload jsonb, created_at)`. XP, badges, notifications, admin activity, analytics mirroring all consume it (Postgres trigger or Edge Function).
- **Why:** Cheap now (one insert), and it is how the world later replays "what happened to this garage" and how gamification stays out of the mutation hot path.
- **Reversibility:** High.

### ADR-08 Private storage with signed + transformed URLs
- **Decision:** Replace the public `car-photos` bucket with private buckets `item-media`, `profile-media`; object key convention `items/{item_id}/{media_id}.jpg`; store paths in a `media` table; render via Supabase image transforms (`?width=`) with signed URLs (public items get long-lived signatures via a cached helper). Client downsizes to ≤ 1600 px / ≤ 400 KB before upload.
- **Why:** Plan limits, deletion, moderation and later 3D texture pipelines all need media as first-class rows, not URL strings in jsonb. Public bucket + `Date.now()-filename` keys is the current state and is not moderatable.
- **Reversibility:** Medium (a one-off migration script moves existing URLs into `media`).

### ADR-09 Payments: Stripe Checkout, one-time token packs, `PaymentProvider` interface
- **Decision:** Stripe (Hypermax FZE, UAE) for Checkout Sessions; pack prices in AED with INR/USD display via Stripe's multi-currency presentment where available; `stripe-webhook` Edge Function credits `token_ledger` idempotently on `checkout.session.completed`. Provider code lives behind `domain/tokens/providers/{stripe,razorpay}.ts` — only Stripe implemented in H1.
- **Why:** One-time purchases avoid RBI recurring-mandate complexity for Indian cards and avoid subscription billing plumbing; Stripe is the fastest route live from a UAE entity.
- **Reversibility:** Medium. Merchant of record and price currency are hard to change after customers have paid; the provider interface makes adding Razorpay/UPI additive.
- **Open item for you:** confirm Hypermax FZE Stripe account eligibility and whether pilot tokens are priced in AED only.

### ADR-10 Auth: phone OTP primary, email OTP fallback
- **Decision:** Supabase phone OTP via Twilio Verify (UAE + India, DLT-registered template for India) with email OTP as a first-class alternative on the login screen. If Twilio's India delivery proves poor, switch to MSG91 through Supabase's **Send SMS Auth Hook** (custom provider, no app-code change). Country picker (UAE/India first, full E.164 list) replaces the `+91` constant.
- **Reversibility:** High.

### ADR-11 Observability & analytics
- Sentry (client + server + Edge), PostHog (product events, funnels, feature-flag mirroring optional), Vercel Analytics for web vitals. Pilot success metrics (01 §6) are defined as PostHog insights before launch.

### ADR-12 Testing posture
- Vitest for domain services (repo mocked) and zod schemas; RLS integration tests run against a local `supabase start` DB with two JWTs (owner / stranger) for every table; Playwright smoke suite on the 6 critical flows (sign-in, add item, scan, publish listing, make offer, buy tokens with Stripe test mode) run against Vercel preview in CI.

### ADR-13 Hosting & environments
- Vercel (Pro) with three environments: `dev` (local + `supabase start`), `staging` (Supabase project `mini-vault-staging`, Vercel preview branch `staging`), `prod`. Secrets only in Vercel/Supabase, never in repo. Branch → preview URL for every PR.

## 4. Module map (`src/`)

```
app/                      routes only; thin. (auth)/ garage/ market/ offers/ deals/ profile/ u/[handle]/ settings/ tokens/ admin/ api/
domain/
  identity/    profiles, handles, onboarding, country
  garage/      collection items, media, favourites, CSV import, stats
  catalog/     brands, models, matching, proposals
  ai/          scan orchestration (client side of Edge Function), quotas
  marketplace/ listings, browse queries, wishlist, favourites
  deals/       offers state machine, trades, rate limits, mark sold
  messaging/   deal threads, Realtime helpers
  tokens/      ledger, packs, purchases, providers/
  entitlements/ can(user, action) — the single gate
  gamification/ xp rules, levels, badges (event consumers)
  trust/       reports, blocks, clean-language, moderation
  flags/       feature flags
  events/      domain_events writer + typed event catalogue
components/   ui/ (shadcn), garage/, market/, deals/, shared/
lib/          supabase clients, auth helpers, image utils, format (money, country)
types/        supabase.ts (generated), shared enums
supabase/     migrations/ functions/{ai-scan,stripe-webhook,jobs}/ seed/ tests/
```

## 5. Non-functional requirements (pilot)

| NFR | Target |
|---|---|
| Performance | p95 TTFB < 600 ms (Mumbai/Dubai), LCP < 2.5 s on mid-range Android/4G; list pages paginate at 24 |
| Availability | Supabase Pro + Vercel; no custom infra; RTO 1 h via PITR |
| Security | RLS on every table incl. new ones; service-role key only in Edge Functions; signed uploads; rate limits on OTP, offers, reports, scans; CSP headers; dependency audit in CI |
| Privacy | Phone numbers never exposed via API to other users (remove `seller_mobile` denorm); data export + account deletion flows |
| Cost ceiling (pilot) | Supabase Pro ~$25 + Vercel Pro ~$20 + Anthropic scans (≤ $0.02/scan × quota) + SMS (~$0.03–0.05/OTP) + Sentry/PostHog free tiers → budget ≈ $150–250/month at 80 users |
| Accessibility | WCAG AA contrast for all 6 themes (verify programmatically in Sprint 9), keyboard nav, labels |

## 6. Security model (summary; detail per table in 03)

- Row ownership via `auth.uid()` on every table; public read only where the product needs it (`profiles` public fields via a **view**, not the base table; listings with `status='active'`; verified catalogue).
- Admin via `profiles.role = 'admin'` checked in a `is_admin()` SQL function used in policies; admin routes additionally guarded in middleware.
- Storage: policies on object key prefix (`items/{item_id}` owned via join, `profiles/{uid}`).
- Edge Functions verify the caller JWT and re-check entitlements; Stripe webhook verifies signature and is idempotent on `event.id`.

## 7. Delivery pipeline

PR → GitHub Actions (typecheck, lint incl. import-boundary rule, Vitest, `supabase db lint`, build) → Vercel preview → Playwright smoke → review → squash-merge to `main` → auto-deploy staging → manual promote to prod (Vercel promote) with `supabase db push` gated by a checklist (06 §5).

## 8. Multiverse readiness — what is baked in now vs deferred

**Baked in during H1 (all cheap, all listed in 03):** canonical catalogue (ADR-06); event log (ADR-07); domain layer (ADR-05); media as rows with stable keys (ADR-08); structured `country_code`/`city` on profiles and listings; `follows` table (schema only, minimal UI in Sprint 8 stretch); stable public `handle`; soft deletes everywhere; UUIDs everywhere.

**Deliberately deferred to H3 (do not build early):** 3D assets or viewer; realtime presence; world/plot ownership; engine choice (Three.js/R3F in-browser vs Unity WebGL vs Godot — decide when H2 is stable; the data model above is engine-agnostic); any "virtual currency" beyond the token ledger (the ledger *is* the future world currency if you want it to be — one more `reason` enum value, not a new system).

**Guardrail:** no H3 feature enters the backlog until the pilot success gate is met. Anything "for the multiverse" in H1 must be justifiable as a pilot benefit too (each item above is).
