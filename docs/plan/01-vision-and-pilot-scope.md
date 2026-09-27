# 01 — Vision, Pilot Scope & Success Criteria

> Status: DRAFT v1 — 2026-09-27 — owner: Sreejith (CTO), product: Varun
> Companion docs: `02-architecture-blueprint.md`, `03-data-model.md`, `04-feature-specs.md`, `05-sprint-plan.md`, `06-engineering-standards.md`

---

## 1. Product in one paragraph

Mini Vault is the home base for diecast car collectors: catalogue your garage (manual, AI photo scan, or CSV), show it off on a public profile, and buy / sell / trade with other collectors in a built-in marketplace where money changes hands offline. A token economy funds the AI features and premium capacity. Long-term, the catalogued garage becomes each collector's virtual garage in a shared multiverse (drive your cars, host meetups, race). The pilot proves the first half; it is deliberately built so the second half is an extension, not a rewrite.

## 2. Three-horizon roadmap (context only — this plan executes Horizon 1)

| Horizon | What | When | Gate to next |
|---|---|---|---|
| **H1 — Solid platform + pilot** | Everything in §4 below, live for a closed cohort of real collectors in UAE + India | Sprints 0–11 (~12 weeks build) then 8–12 week pilot | Pilot success criteria (§6) met; token purchases observed |
| **H2 — Monetisation depth (Varun's "V2")** | Promoted listings, verified seller, priority placement (decided deliberately), collection insights, PDF/image catalogue export, admin dashboard proper | Post-pilot, ~6–8 sprints | Pro/token conversion ≥ target; moderation load understood |
| **H3 — Multiverse** | 3D garage viewer (web first) → shared worlds, drive, meetups, race events, presence, world economy | After H2 stabilises | Catalogue coverage of top models high enough that most garages render; engine choice made (see 02 §8) |

## 3. Pilot definition

- **Cohort:** 30–80 invited collectors (mix of individuals and 3–5 shops), split UAE / India. Invite-code gated; no public sign-up during pilot.
- **Ramp (D-028):** production is live from Sprint 0. A *founders cohort* (you, Varun, 3–5 trusted collectors) uses prod from Sprint 1; the 3–5 shops are invited from Sprint 2 to bulk-load stock; the full cohort opens at Sprint 11. Every sprint's demo runs on production.
- **Duration:** 8–12 weeks after launch, with weekly maintenance sprints.
- **Geography behaviour:** one shared marketplace; every listing carries `country_code` + `currency`. Default browse filter = your country; one tap to "All countries". Deals are offline, so cross-border is allowed but clearly signposted.
- **Money:** collectors settle deals offline (cash, bank transfer, in-person). The **only** in-app payment is buying **token packs** (Stripe Checkout). Tokens are spent on extra listing slots, AI scan packs, and Pro (30-day). No escrow, no commission.
- **Platforms:** responsive web app, installable PWA. No native app in H1.
- **Languages:** English only in H1 (Arabic/Hindi deferred; UI strings still centralised so i18n is non-breaking later).

## 4. Pilot scope — what ships (summary; detail in 04)

| Area | In pilot | Explicitly NOT in pilot |
|---|---|---|
| Identity | Phone OTP (UAE + India), email OTP fallback, onboarding, collector vs shop, handle, country/city | Social login, passwords, KYC |
| Garage | Full CRUD, multi-photo (plan-limited), favourites, colour, search/filter/sort server-side, grid/list, duplicate warning, Top Brands stats, JSON export/backup | Photo editing, bulk edit |
| Add methods | Manual (progressive disclosure), AI single-car scan → prefill, AI group scan → review list, CSV import with template + preview | Barcode scanning |
| Catalogue | Canonical `catalog_models` seeded from scans + admin curation; items link to a canonical model when confident | Public catalogue browsing UI |
| Marketplace | Publish from garage, browse with filters (brand, country, sale/trade, seller type, search, favourites), listing detail, wishlist, seller profile with rating, share links, plan-limited active listings | Promoted listings, verified badge, ranking boosts, "Trending" sort (stretch) |
| Deals | Cash offer (min-above-asking rule), Buy Now, trade proposal from your public duplicates, offer state machine, rate limiting, seller inbox, mark sold | Escrow, payments, shipping |
| Post-deal | Chat thread (Realtime) once accepted, review after completion, seller rating aggregate | Group chat, media in chat |
| Tokens & Pro | Token ledger, 2 packs via Stripe Checkout, spend on: listing slot, scan pack, Pro 30 days; entitlements module; paywall UI | Subscriptions/recurring billing, Razorpay/UPI (adapter interface only) |
| Gamification | XP + levels/tiers, 5 badges with progress, stats dashboard | Daily quests (stretch), leaderboards |
| Trust & safety | Report listing/user, block user, server-side clean-language validation, admin moderation queue | Automated image moderation |
| Profile | Public profile, banner, bio, share, theme (6 themes), account-type switch | Pro flair (stretch) |
| Ops | Admin mini-console (reports, users, flags, catalogue), feature flags, analytics, error tracking, backups, runbook | Custom BI |
| Multiverse | **Nothing user-visible.** Only structural readiness (02 §8) | 3D, worlds, presence |

## 5. Users & core jobs

- **Individual collector (primary):** "Know exactly what I own, show it off, find the piece I'm hunting, and offload duplicates to someone who values them."
- **Shop / store:** "List stock fast (CSV/scan), reach collectors, build a reputation."
- **Admin (you/Varun):** "See what's happening, kill a feature fast, resolve reports, curate the catalogue."

## 6. Pilot success criteria (decide these before launch; measure via PostHog + SQL)

| Metric | Target | Why |
|---|---|---|
| Activation: users with ≥5 garage items within 7 days | ≥ 60 % of sign-ups | Garage is the hook; below this, nothing downstream matters |
| AI scan usage: % of items added via scan | ≥ 40 % | Validates the cost centre is worth paying for |
| Scan accuracy: candidates accepted without edits | ≥ 60 % | Below this, scanning is slower than typing |
| Marketplace supply: users who publish ≥1 listing | ≥ 35 % | |
| Deal flow: offers per active listing per month | ≥ 0.5 | |
| Completed deals (marked sold + review) | ≥ 15 in pilot | Proves the offline settlement model |
| Token purchase conversion | ≥ 8 % of WAU buy ≥1 pack | The business question |
| Weekly retention W4 | ≥ 40 % | |
| Reports needing action | < 2 % of listings | Moderation load estimate for H2 |
| Reliability | p95 page load < 2.5 s on 4G; error rate < 0.5 % | |

## 7. Non-goals & guardrails

- No ranking manipulation that isn't labelled (carry Varun's principle: paid placement is fine if labelled; quiet boosts are a deliberate H2 decision).
- No storing of payment instruments — Stripe holds everything.
- No shipping/escrow promises in copy; deals are peer-to-peer.
- No feature ships without a kill-switch flag from Sprint 4 onward (once money or messaging is involved).

## 8. Key risks (pilot-level)

| Risk | Impact | Mitigation |
|---|---|---|
| SMS OTP delivery in India (DLT registration, carrier filtering) | Users can't sign in | Email OTP fallback from Sprint 1; MSG91 or Twilio with DLT template pre-registered; WhatsApp OTP as backup channel |
| Indian cards failing on a UAE Stripe merchant (international-transaction blocks) | Token conversion in India under-reported | Measure separately per country; `PaymentProvider` interface so Razorpay is an adapter, not a refactor |
| AI scan cost blow-up | Margin | Hard per-user quota, image downscale before upload, cost logged per call, kill-switch flag |
| Solo-builder bandwidth (fractional CTO with other engagements) | Schedule slip | 1-week sprints, ≤ 20 h planned per sprint, explicit stretch items, Sprint 11 is buffer |
| Marketplace cold-start | Empty market kills retention | Seed with shops' stock (CSV import built early, Sprint 2), pre-load pilot with 3–5 shops |
| Data-model drift before multiverse | Rewrite later | Canonical catalogue + event log + domain layer from Sprint 0–3 (02 §8) |
