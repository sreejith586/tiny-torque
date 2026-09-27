# 04 — Feature Specifications (pilot scope)

> Status: DRAFT v1 — 2026-09-27. Each feature: purpose · rules · acceptance criteria (AC, testable) · events emitted · flags · out of scope. Screen behaviour follows Varun's prototype unless a rule below overrides it. **UX fidelity (D-027):** every user-facing screen reuses the prototype's layouts, components and flows; 'sheet', 'chips', 'carousel', 'toggle row' below refer to the prototype's existing patterns, not new ones. The admin console (F-16) is internal and exempt from prototype fidelity but uses the same tokens and plain tables/forms — no dashboards beyond simple number tiles. IDs (F-xx) are referenced by backlog tasks in `05-sprint-plan.md` / `backlog.csv`.

---

## F-01 Identity & onboarding
**Rules**
- Login screen: country picker (AE, IN prominent; full E.164 list behind "other"), phone input, "Use email instead" toggle. OTP 6 digits, 10-min validity, resend after 30 s, max 5 sends/hour/number (Supabase rate limits + our own counter).
- First login → onboarding: invite code (while `invite_only` flag on) → account type (collector/shop) → display name (+ store name for shop) → handle (auto-suggested, editable, uniqueness check live) → country (prefilled from dial code) + city (typeahead from a static city list per country) → optional avatar. Skippable tutorial after.
- Profile edit uses PATCH semantics (never nulls untouched fields — fixes current upsert bug).
- Account deletion: anonymise PII, soft-delete items/listings, keep ledger rows (finance) with user pseudonymised.
**AC**
- Given an IN number with valid DLT template, OTP arrives < 30 s in staging test; given SMS fails, email OTP path completes sign-in.
- Handle collision shows inline error before submit; profile URL `/u/{handle}` resolves after onboarding.
- `mobile` is never present in any API response to another user (RLS test).
**Events** `user.signed_up`, `user.onboarded`, `profile.updated`, `user.deleted`
**Flags** `invite_only`, `email_otp`

## F-02 Garage (My Garage)
**Rules**
- Fields: brand*, model, variant, series, scale, colour, condition (enum: mint/near-mint/good/played/damaged), packaging (enum: carded/blister/loose/boxed), rarity (enum: common/uncommon/rare/super-rare/treasure-hunt/chase), qty, price paid + currency, source, notes, photos, public toggle, favourite.
- Photo limit = entitlement: free 1, Pro 8. Free users adding more see paywall inline (not blocking the save of the first).
- Server-side search (tsvector) + filters (brand, rarity, condition, public, favourite, for sale) + sort (newest, brand, qty, price paid, value) with cursor pagination (24/page). Grid/list toggle persisted per device.
- Duplicate warning: same `catalog_model_id` OR (brand ilike + model ilike + variant ilike); non-blocking; offers "increase qty instead".
- Soft delete with 30-day undo from Settings › Trash (stretch: undo toast only).
- Stats: total items, total qty, duplicates, estimated value (Σ price paid; later catalogue value), top brands (top 5 by qty), badges earned.
- JSON export (all items + media URLs) and restore (import JSON from Mini Vault only; CSV import is F-04).
**AC**
- Adding item with 1 photo on free plan succeeds; adding 2nd photo shows paywall; Pro adds 8.
- Search "skyline" returns items with model/series containing it across 500-item garage in < 300 ms p95 (index test).
- Deleting an item that backs an active listing prompts: "Remove listing too?" — never leaves an orphan active listing.
**Events** `item.created/updated/deleted/restored`, `item.made_public/private`, `item.favorited`

## F-03 AI photo scan (single + group)
**Rules**
- Entry points: "Scan" tab in add flow (single-car → prefills form) and `/garage/scan` (group photo → review list). Both call Edge Function `ai-scan` with `kind`.
- Client downsizes image to ≤ 1600 px longest side, JPEG q0.82, ≤ 400 KB before upload to `item-media` (status `uploading`); function receives `media_id`, fetches from Storage (never base64 in request body — fixes payload/size issue), calls Anthropic with **tool_use structured output** (schema = candidate array) so no fence-stripping is needed.
- Quota: free 10 scans/30-day rolling; Pro unlimited (soft cap 300/day for abuse); scan pack grants +25. Group scan = 1 scan regardless of cars found. Check quota **before** calling the model; return 402-style error with paywall payload.
- Each candidate: brand, model, variant, series, scale, colour, packaging guess, confidence, notes, `catalog_match {model_id, score}` (fuzzy match against verified catalogue by trigram; ≥ 0.85 auto-link, 0.6–0.85 suggest, < 0.6 none).
- Review UI: edit any field, toggle include, confidence badge, "add N to garage". On accept, unknown brand/model upserted to catalogue as `proposed`.
- Log every job to `ai_scan_jobs` with token usage and cost.
- Retry once on 5xx/parse failure; surface a friendly error with "add manually" fallback.
**AC**
- Free user at 10/10 sees paywall without a model call (assert no `ai_scan_jobs` row with status ≠ `failed_quota`).
- Group photo of 6 cars returns ≥ 5 candidates in staging fixture set; accepted candidates create rows with `catalog_model_id` when match ≥ 0.85.
- Cost per scan logged; monthly cost view in admin.
**Events** `scan.requested`, `scan.completed`, `scan.accepted` (count)
**Flags** `ai_scan` (kill switch), `ai_scan_group`

## F-04 CSV / spreadsheet import
**Rules**
- Download template (xlsx + csv) with the F-02 columns and an example row; upload csv/xlsx (papaparse / SheetJS client-side); map columns if headers differ; preview table with per-row validation (zod) and error highlighting; commit inserts in batches of 100 via server action; report created/skipped.
- Duplicate rows (same brand+model+variant within file or vs garage) flagged, user chooses skip/increase qty/add anyway.
- No photos via CSV (optional `photo_url` column deferred).
**AC** 500-row file imports in < 20 s with progress; a row with invalid `qty` blocks only that row.
**Events** `import.completed {rows}` · **Flags** `csv_import`

## F-05 Catalogue (internal in H1)
**Rules** Admin screen lists `proposed` models grouped by brand with occurrence count; actions: verify, merge into existing (re-points items/listings via `merged_into_id`), edit, reject. Seed script loads a starter list of brands (Hot Wheels, Matchbox, Tomica, Majorette, Mini GT, Tarmac Works, Kyosho, AUTOart, Maisto, Bburago, Greenlight, M2, Johnny Lightning, Inno64, Pop Race, Kaido House, Hot Wheels Premium/RLC as series) and ~200 common castings (CSV maintained by Varun).
**AC** Merging two models updates all referencing rows in one transaction; item free-text is untouched.

## F-06 Marketplace — listings & browse
**Rules**
- Publish from item detail: choose sale/trade/both, price + currency (from profile country, editable), min offer (default = price; "open to offers" sets min offer < price), qty, description; requires ≥ 1 photo; listing inherits item's media (references, not copies) and `catalog_model_id`.
- Active listing limit = entitlement (free 2, +slots, Pro unlimited). Attempt beyond limit → paywall (buy slot with tokens or go Pro).
- Browse `/market`: default filter country = mine; filters brand, type (sale/trade), condition, seller type, price range, "favourites", search; sort newest / price asc-desc / most offers (stretch "Trending"); cursor pagination; card carousel through photos; listing detail with seller card (avatar, handle, rating, country, member since), share link (OG image from first photo).
- Listing expires after 60 days (renewable one tap); `view_count` incremented via debounced RPC.
- Public (anon) can browse and view listings; interacting requires sign-in.
**AC** Free user with 2 active listings gets paywall on 3rd; buying a slot immediately allows it (no reload). Anon user sees active listings; `mobile` never in payload.
**Events** `listing.published/updated/renewed/expired/removed/sold`, `listing.viewed` (sampled)
**Flags** `marketplace_publish`

## F-07 Wishlist & favourites
Wishlist entry: brand/model free text or catalogue pick, max price, notify toggle. Favourite listings (heart) → "Favourites" filter. Stretch: nightly match → notification.
**AC** Wishlist private (RLS test); favourite count on listing updates via trigger.

## F-08 Deals — offers, buy now, trades
**Rules** (state machine in `domain/deals`; enforced by RPC `transition_offer`)
```
pending ─accept→ accepted ─complete(seller marks sold)→ completed
   │        └decline→ declined            └cancel(either)→ cancelled
   ├withdraw(buyer)→ withdrawn
   └72h→ expired
```
- Cash offer allowed only if `open_to_offers`; amount ≥ min offer, ≤ 3× price (sanity). Buy Now creates an `accepted` offer directly at price (skips pending) and reserves listing.
- Trade proposal: pick 1–3 of your **public** items (optionally + cash top-up); seller sees item cards.
- One pending offer per buyer per listing; rate limits (≤ 5/h, ≤ 20/day); blocked users cannot offer.
- Accept → listing `reserved`, other pending offers auto-declined with reason, chat opens (F-09). Seller may "release" (cancel) → listing back to `active`.
- Seller inbox `/offers`: tabs Received / Sent, grouped by listing, badges for pending. Notifications for every transition (F-12).
- Mark sold → `completed`, listing `sold`, review window opens for buyer (F-10). Seller can also mark sold "outside app" (no offer) — allowed, no review.
**AC** Two buyers accept race: second accept fails with clear error (row lock in RPC). Rate-limit test: 6th offer in an hour rejected. Trade proposal with a private item rejected server-side.
**Events** `offer.created/accepted/declined/withdrawn/expired/completed/cancelled`
**Flags** `offers` (kill switch)

## F-09 Deal chat
Thread per accepted offer; Realtime subscription; text only (≤ 2000 chars), clean-language check; read receipts basic (`read_at`); thread stays readable after completion; blocked → cannot send. Push/email notification on new message when the other side is offline (email via Resend, stretch).
**AC** Message appears on other client < 1 s in staging; sending on a `declined` offer rejected by RLS.

## F-10 Reviews & seller rating
Buyer reviews seller once per completed offer (1–5 + ≤ 500 chars); rating aggregate on `public_profiles`; seller may reply (stretch). Review visible on seller profile and listing seller card.
**AC** Second review on same offer rejected (unique). Aggregate updates within the same transaction.

## F-11 Tokens, Pro & entitlements
**Rules**
- Packs (seeded, prices TBD): small / large. Purchase → Stripe Checkout (hosted) → webhook credits ledger (idempotent on `event.id`) → success page polls balance.
- Spend options (prices in tokens, TBD): extra listing slot (permanent), scan pack (+25, 30 days), Pro 30 days (unlimited listings, 8 photos, unlimited scans, flair stretch). All via `spend_tokens` RPC; insufficient balance → paywall with "buy tokens".
- Entitlements module is the single source: `can(user, 'add_photo', {count})`, `can(user, 'publish_listing')`, `can(user, 'scan')`, `photoLimit(user)`, `listingSlots(user)`, `scanQuota(user)`.
- Admin can grant tokens (`admin_adjust`) with a note; every ledger row is visible to the user in Settings › Tokens history.
- Refunds handled in Stripe dashboard → webhook `charge.refunded` → negative ledger row; entitlements already consumed are not clawed back (policy stated in T&Cs).
**AC** Webhook replay does not double-credit (idempotency test). Balance shown = Σ ledger (property test). Paywall appears in all 3 gates (photo, listing, scan). Stripe test-mode E2E passes in CI.
**Events** `tokens.purchased/spent/refunded/adjusted`, `pro.activated/expired`
**Flags** `token_purchase` (kill switch), `pro_purchase`

## F-12 Notifications (in-app)
Bell with unread count (Realtime on `notifications`); list with mark-read; types per 03 §2.20. Email digests deferred.
**AC** Offer received → seller notification row within the same event-consumer transaction.

## F-13 Gamification (lite)
XP rules (code): add item +10 (cap 50/day), first photo on item +5, publish listing +15, complete deal +50 (both sides), receive 5★ review +20, daily first open +5. Levels: 0/100/300/700/1500/3000 XP → tiers "Rookie / Collector / Serious Collector / Curator / Legend / Vault Master" (names from Varun's prototype where they exist; confirm). Five badges per 03 §2.18 with progress. Stats dashboard on profile. Daily quest = stretch.
**AC** XP computed only from `domain_events` (replayable: dropping `xp` and replaying yields same values — test).
**Events** `xp.granted`, `badge.unlocked`

## F-14 Profile & public page
`/u/{handle}`: banner, avatar, name, handle, shop badge, country/city, level/tier, rating, member since, follow button (stretch), tabs: Public collection · Listings · Reviews. Share sheet (Web Share API) with OG image. Settings: edit profile, switch account type, theme (6, per-device), export/backup, tokens history, blocked users, delete account, T&Cs/privacy, feedback/bug report.
**AC** Public page renders for anon with only `public_profiles` fields; private items absent.

## F-15 Trust & safety
Report (listing/user/message) with reason enum + notes; block user (hides their listings/profile from you and blocks offers/chat both ways); server-side clean-language validation (word list + allowlist for car names like "Shelby Cobra"…) on display name, handle, bio, listing text, messages — reject with friendly message; admin queue: open reports with target preview, actions: dismiss / remove listing / warn / suspend user (sets `profiles.suspended_until`; middleware blocks). Rate limit reports (10/day).
**AC** Suspended user gets a dedicated screen, cannot mutate; blocked pair cannot see each other's listings (RLS/query test).
**Events** `report.created/resolved`, `user.blocked/suspended`

## F-16 Admin mini-console `/admin`
Role-gated. Pages: Overview (users, items, listings, offers, scans, cost this month, token revenue), Reports queue (F-15), Users (search, view, grant tokens, suspend, set admin), Catalogue (F-05), Flags (toggle + audience JSON with validation), Invites (create codes/cohorts), Scan jobs (last 100 with cost). Read-only SQL views feed it; no custom BI.

## F-17 PWA, performance, a11y
Manifest, icons, install prompt (deferred until 2nd visit), service worker caching app shell + last-viewed garage (read-only offline banner), `next/image` with Supabase transforms, route-level loading states, skeletons; Lighthouse ≥ 90 perf/a11y on mid-tier Android profile; contrast check script over all 6 themes; focus management in dialogs; reduced-motion respect.

## F-18 Analytics & pilot instrumentation
PostHog events mirroring key domain events (client-side identify with `user_id`, country, plan; server-side capture from event consumer for money/scan events); funnels defined for 01 §6 metrics; weekly SQL report (materialised view `pilot_kpis_weekly`).

## F-19 Ops readiness
Runbook (incidents, rollback, restore from PITR, rotating keys), backups verified by restore drill in Sprint 10, status page (Vercel + Supabase status links in-app footer), Sentry alert routing to your email/Slack, cost alerts (Anthropic spend, Supabase usage).

## Stretch register (pull in only when a sprint has slack)
Daily quest · Trending sort · Pro profile flair · Follow button + follower counts · Wishlist match notifications · Email notifications via Resend · Seller reply to review · Visual search (camera → candidates → catalogue match → listings) · Undo-toast for delete · Photo URL column in CSV import.
