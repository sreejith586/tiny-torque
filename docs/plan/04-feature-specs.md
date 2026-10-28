# 04 — Feature Specifications (pilot scope)

> Status: DRAFT v1 — 2026-09-27. Each feature: purpose · rules · acceptance criteria (AC, testable) · events emitted · flags · out of scope. Screen behaviour follows Varun's prototype unless a rule below overrides it. **UX fidelity (D-027):** every user-facing screen reuses the prototype's layouts, components and flows; 'sheet', 'chips', 'carousel', 'toggle row' below refer to the prototype's existing patterns, not new ones. The admin console (F-16) is internal and exempt from prototype fidelity but uses the same tokens and plain tables/forms — no dashboards beyond simple number tiles. IDs (F-xx) are referenced by backlog tasks in `05-sprint-plan.md` / `backlog.csv`.

---

## F-01 Identity & onboarding

**Rules**

- Login screen: country picker (AE, IN prominent; full E.164 list behind "other"), phone input, "Use email instead" toggle. OTP 6 digits, 10-min validity, resend after 30 s, max 5 sends/hour/number (Supabase rate limits + our own counter).
- First login → onboarding = the prototype's **single "Set up your profile" form** (D-027/D-041), extended with: invite code field (shown only while `invite_only` flag on), handle (auto-suggested from display name, editable, uniqueness checked on blur via server action, inline error), country (native `<select>`, prefilled from dial code / email default AE) replacing the free-text location, city (native `<datalist>` from a static per-country list, free text allowed). Existing fields stay: display name, account type (collector/shop), store name for shop. No steps, no progress bar, no avatar (media arrives in S2; avatar only if the prototype profile gets one via a D-row). Tutorial (S8) is skippable. ✅ MV-S8-06 — 4-step tour over `/garage` until `tutorial_dismissed_at` is stamped; garage empty state points at scan / manual / import.
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
**AC** XP computed only from `domain_events` (replayable: dropping `xp` and replaying yields same values — test). ✅ MV-S8-02 — `src/domain/gamification/rules.test.ts` ("replay determinism"), `scripts/gamification-replay.ts`, D-079.
**Events** `xp.granted`, `badge.unlocked`

## F-14 Profile & public page

`/u/{handle}`: banner, avatar, name, handle, shop badge, country/city, level/tier, rating, member since, follow button (stretch), tabs: Public collection · Listings · Reviews. Share sheet (Web Share API) with OG image. Settings: edit profile, switch account type, theme (6, per-device), export/backup, tokens history, blocked users, delete account, T&Cs/privacy, feedback/bug report.
**AC** Public page renders for anon with only `public_profiles` fields; private items absent. ✅ MV-S8-04 — `e2e/profile-settings.spec.ts` (public profile v2: tabs, level pill, share; mobile absent), `supabase/tests/0020_gamification.sql` (public_profiles avatar/banner columns). Settings list ✅ MV-S8-05 (`/settings`, D-080). Follow button = stretch (MV-S8-07, not built).

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

## Collectors World (H3) — F-20…F-28

> Added by MV-W01-01 (D-066). Source: `07-collectors-world.md` §2 (pillars), §3 (economy), §6 (architecture) and `08-collectors-world-sprint-plan.md`'s feature table. Everything below ships **dark** behind its flag (D-077) and is turned on per cohort/country by flag audience. Common rules for every F-2x: one identity/garage/ledger (D-068), closed-loop credits (D-069), server authority (D-071), 18+ (D-073), design-pack sign-off per screen (D-074), events on every mutation (D-009), blocks enforced everywhere, no PII ever (rule 15).

## F-20 Garage — the space

**Rules**

- A `world_garages` row is created lazily, 1:1 with `profiles`, by `ensure_world_garage()` on first World visit; name defaults to "{display name}'s Garage" (≤ 40 chars, rename costs credits after the first free one).
- **Levels** 1–5 (`world_levels`, seeded; placeholder names Shed → Garage → Showroom → Warehouse → Vault, Varun's call). A level sets display slots, decor slots, visitor cap and host cap. Bought one step at a time via `buy_world_level()`: credits (`spend_garage_level`, placeholder 40/90/180/350) **and** an XP tier gate (`min_xp_level` vs `profiles.level`, F-13) — money alone cannot skip progression. Level 1 is free.
- **Display slots** hold the owner's real `collection_items`; only `is_public` items may be displayed. A **featured car** (`featured_item_id`) renders large on the garage page and in share images.
- **Layout** is a zod-validated document (`world_garages.layout`, `{version:1, slots:[{slot,itemId}], decor:[{slot,itemId}]}`): slots ≤ level capacity, no duplicate slot or item, cars public + owned, decor owned (`world_inventory`). Saved by a server action; a malformed stored document renders empty rather than erroring.
- **Themes/decor** come from `world_items` (reference, platform art only — no user uploads); placement is layout; ownership is `world_inventory`.
- **Score** = f(items displayed, rarity mix, decor, kudos, visits, trophies), computed by an event consumer (replayable like XP, W05). `level` and `score` can only change inside the RPCs/consumers (guard trigger, D-071).
- **Marketplace bridge** (W02): a displayed car that is also listed shows the listing badge; `offer.completed` removes the car from the seller's slots/featured (consumer) and prompts the buyer to "park it".
  **AC**
- Direct `UPDATE world_garages SET level/score` as `authenticated` is rejected (pgTAP); `INSERT` is impossible outside the RPC.
- `buy_world_level()` with XP tier below `min_xp_level` → `xp_level_too_low` before any balance check; with a short balance → `insufficient_balance` and the level/balance are unchanged; at level 5 → `max_level`. Idempotent on user+target level.
- A layout with more slots than the level allows, an out-of-range slot, a duplicate, a private car or an un-owned decor item is rejected and nothing is written (Vitest).
  **Events** `world.garage_created`, `world.garage_updated`, `world.layout_saved`, `world.level_up`, `world.score_updated`
  **Flags** `world` (master; nothing World-facing renders while OFF)

## F-21 Visits & social

**Rules**

- **Open house** modes on the garage: `public` (anyone, anon share links included), `followers` (viewer must follow the owner, reuses `follows`), `invite` (owner-only until `world_invites` lands in W03: expiring share tokens + direct invites by handle). Blocks hide a garage both ways. Enforced in RLS (`world_garages` select policy) and mirrored in the service.
- **Visit** = page view recorded in `world_visits`, one per visitor per garage per day → "recent visitors" (handles only) and counts. **Kudos** = one per visitor per garage per day. **Guestbook** = ≤ 140-char messages, host-moderated (hide), clean-language validator (MV-S6-04 becomes mandatory here). Rate limits as triggers.
- **Presence** ("who is here now") is deferred (D-017), later via Realtime Presence behind `world_presence`.
- **Leaderboards** (W11): garage score, race wins, meetup attendance; per country and global, per season; labelled; no paid ranking.
  **AC**
- RLS matrix (pgTAP): anon sees public garages only; a follower sees a followers-only garage, a stranger doesn't; a blocked viewer sees nothing of the blocker and vice versa; admin sees all. `/api/v1/world/garages/{handle}` returns 404 for anything not visible.
- A second visit/kudos the same day is a no-op (unique per day), never an error the user sees.
  **Events** `world.visited`, `world.kudos_given`, `world.guestbook_posted`
  **Flags** `world`, `world_presence`

## F-22 Clubs

**Rules**

- `clubs` (slug, name, owner, join mode open/apply/invite, optional country) with `club_members` roles owner/admin/member and status active/pending/banned. A **clubhouse** page shows members' featured cars + a club feed. Clubs can host meetups and club races; club leagues = season points per club (W09).
- Host/owner eligibility and suspension follow F-28's rules; reports and blocks apply inside clubs.
  **AC** Only members read a non-open club's feed; owner/admin can remove members; a banned member cannot rejoin (pgTAP).
  **Events** `club.created`, `club.joined`, `club.left`, `club.role_changed`
  **Flags** `world_clubs`

## F-23 Virtual meetups

**Rules**

- A `meetups` row (kind `virtual`) hosted at a garage or clubhouse: title, theme, start/end, capacity (by host garage level `host_cap`), visibility (public/followers/club/invite), showcase (each attendee brings ≤ N public cars), live room (Realtime chat, deal-chat pattern), reactions, best-in-show vote (one per attendee, frozen at end), photo wall (`media` rows), reminders (notifications + Resend).
- Lifecycle only via `transition_meetup(id, action)`: draft → scheduled → live → ended → cancelled (D-021 pattern). **Hosting fee** in credits scaled by capacity (`spend_meetup_host`, placeholder 5/10/20) is a platform fee, refunded on cancel ≥ 24 h before start; attending is free. Co-hosts allowed. Recurring club nights spawn instances via the jobs runner.
  **AC** `rsvp_meetup` past capacity fails; a non-attendee cannot read the room; best-in-show result cannot change after `ended`; cancel < 24 h keeps the fee (pgTAP).
  **Events** `meetup.created`, `meetup.scheduled`, `meetup.started`, `meetup.ended`, `meetup.cancelled`, `meetup.rsvp`, `meetup.best_in_show`
  **Flags** `world_meetups`

## F-24 In-person meetups

**Rules**

- `meetups` kind `in_person`: city + **approximate** area in the public listing; exact venue (`venue_private`) readable only by confirmed RSVPs and only if the host opts in; date, capacity, RSVP, host rules text, host check-in (confirms attendance → XP/earn). Mandatory safety banner, public-venue recommendation, 18+ only, **no money collection via the platform**, "TinyTorque is not the organiser" disclaimer (D-076).
- Reportable; hosts with upheld reports lose hosting rights (F-28). Opens UAE-first by country audience, India after the IT-Rules/grievance review.
  **AC** `venue_private` is never present in a response to a non-confirmed attendee (RLS test); listing a meetup without the disclaimer acknowledged is impossible from the UI.
  **Events** `meetup.created`, `meetup.rsvp`, `meetup.checked_in`, `meetup.cancelled`
  **Flags** `world_meetups_irl`

## F-25 Racing

**Rules**

- **Stats model** in code (`domain/races/stats.ts`, versioned, `race_stats_versions`): archetype from the canonical model's segment (neutral when unmatched), scale, condition, rarity bonus, owned tunes (total ≤ 10 %), driver level (≤ 10 %), seeded luck. A test asserts the combined paid/level cap (D-075).
- **Formats**: time trial (solo vs ghost), challenge (head-to-head to a handle/club), event (8/16-car bracket at a garage), season league (monthly points).
- **Execution**: `enter_race` RPC (ownership, item public, one entry per user, fee via `spend_tokens` `spend_race_entry` for bracket events only — platform fee); `lock_race` sets the seed; Edge job `run-race` writes `race_results` once (immutable); replay renders from seed + stats version; disputes = re-run the seed.
- **Prizes**: XP, trophy items (earned-only), titles, badge progress, season points. **Never credits.** Free-entry community races may award small earn-budget bonuses (`earn_race_participation`, capped) — the rules engine keeps "paid entry → credit reward" impossible.
  **AC** Re-running a race with the same seed + stats version yields identical results (determinism test); `race_results` has no update/delete policy; a paid-entry race cannot carry a credit reward (test on the rules table).
  **Events** `race.created`, `race.entered`, `race.locked`, `race.completed`, `race.cancelled`
  **Flags** `world_races`

## F-26 Progression, quests & earning

**Rules**

- Reuses F-13 XP/levels; new XP rules for World actions (visit, kudos given/received, host, attend, race, win, quest).
- **Quests** from a rules table (`quests`: 3 daily + 3 weekly), progress by event consumer (`quest_progress`), rewards = XP + small credits + occasionally an earned-only item. Daily login streak (+1/day, +5 at 7 days).
- **Earn engine**: never a client call. Consumer on `domain_events` calls `earn_tokens(user, reason, amount, key)` (service-role/trigger only) with the **daily ceiling (placeholder 15)** and idempotency (rule + user + period) inside. Earned credits are `source = earned`, expire after 180 days (jobs runner posts `expire_earned` rows), spent FIFO before purchased (D-070). Admin "earn freeze" per user.
- **Seasons** (`seasons`, `season_points`): 6–8 weeks, free pass track, seasonal decor, leaderboard reset, end-of-season trophies. **Achievements**: World badges added to `achievements`.
  **AC** XP, quest progress and season points are replayable from `domain_events` (same values after drop + replay); the daily ceiling is enforced in the RPC (pgTAP); `earn_tokens` is not executable by `authenticated`.
  **Events** `quest.progressed`, `quest.completed`, `quest.reset`, `tokens.earned`, `tokens.expired`, `season.started`, `season.ended`, `xp.granted`, `badge.unlocked`
  **Flags** `world_earn`

## F-27 Shop & economy surfaces

**Rules**

- `/world/shop`: garage levels, decor, themes, tunes, consumables (Spotlight = 24 h placement on "Open garages", labelled). Prices are data (`world_levels.price`, `world_items.price`, D-070); earned-only items (`price IS NULL`) are visible, never purchasable; `min_level` gates items; season-limited items carry `season_id`.
- `buy_world_item(item_id, key)`: active item, not earned-only, garage level ≥ `min_level`, durable kinds (everything but `consumable`) one-per-user and idempotent on user+item, consumables idempotent on the caller's key; spend via `spend_tokens` (`spend_world_item`) with an `entitlement_grants` receipt of kind `world_item` (levels: `world_level`); inventory row carries `ledger_id`, `durable`, `acquired_via`.
- `/tokens` gains "What credits buy in the World"; `/tokens/history` shows World reasons (labels shipped in W01). `<Paywall>` → `/tokens` when short.
- Refunds/chargebacks per 07 §3.3: negative balance locks spending + banner; durable items revoked only on a second chargeback.
  **AC** earned-only → `earned_only`; inactive → `item_not_found`; below `min_level` → `level_too_low`; second durable purchase → `already_owned`; short balance → `insufficient_balance` with nothing written; each paid purchase emits `world.item_bought` with the price paid (pgTAP). Balance = Σ ledger (property test, F-11) still holds.
  **Events** `world.item_bought`, `world.item_granted`, `world.level_up`, `tokens.spent`
  **Flags** `world_shop` (`world_shop` + `world_earn` = economy freeze)

## F-28 World trust, admin & ops

**Rules**

- Report on every World entity (`reports.target_type` extended), block hides both ways everywhere, host mute/kick/ban in rooms and meetups, clean-language validator on names/titles/guestbook/room messages, platform art only.
- Host eligibility ≥ Level 2 and no upheld report in 90 days; two upheld reports = automatic hosting suspension. Audit trail = `domain_events`.
- `/admin`: World group in the flags editor (toggle + country/cohort audience helpers — W01), World report queues, economy dashboard (07 §3.4 weekly metrics: sinks ÷ sources, earned vs purchased, cap hit rate, breakage), earn freeze, revoke item, re-run race from seed, cancel meetup with refund, cost guards/alerts (Realtime connections, Edge invocations, PostHog volume).
- Runbook entries: "earn exploit", "race ran twice", "meetup room abuse" (06 §5 placeholders).
  **AC** Flag edits are admin-only (RLS) and logged as `flag.updated`; economy dashboard numbers are SQL over the ledger `source`/`reason` columns, no second balance.
  **Events** `flag.updated`, `report.created`, `report.resolved`, `user.suspended`
  **Flags** all `world*`

## Stretch register (pull in only when a sprint has slack)

Daily quest · Trending sort · Pro profile flair · Follow button + follower counts · Wishlist match notifications · Email notifications via Resend · Seller reply to review · Visual search (camera → candidates → catalogue match → listings) · Undo-toast for delete · Photo URL column in CSV import.
