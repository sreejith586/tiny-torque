# 07 — Collectors World (H3) — product, economy, architecture & operations plan

> Status: **PROPOSAL v1 — 2026-10-19** — owner: Sreejith (CTO). Nothing in this document is in a sprint, a flag, or a migration until the gate in §1.3 is met and the decisions in §13 are accepted into `DECISIONS.md`. It extends, and does not replace, `01` (H3 row), `02 §8` (multiverse readiness) and `03`/`04`.
> Working name: **Collectors World** ("the World"). Final name is Varun's call.

---

## 0. The owner's one-page summary

1. **The World is a section of TinyTorque, not a second product.** Same account, same profile, same garage rows, same token balance, same event log, same flags. A collector's real `collection_items` _are_ their cars in the World; there are no World-only cars. This is the single most important design rule, and it is what makes "connect, communicate and transact seamlessly" free instead of a sync project.
2. **Tokens stay a closed-loop utility credit.** Buy them, earn them, spend them. Never cash out, never transfer peer-to-peer, never pay them out as race prizes funded by paid entries, never sell random-reward crates. Every one of those lines is a regulatory line in India or the UAE (§10), not a product preference.
3. **Build order is gated.** The World starts only after the pilot success gate (01 §6) and after S8 (XP/levels), because every World earn-loop hangs off XP and `domain_events`. Estimated **12 one-week sprints** at the current 20 h/sprint pace (§8), realistically four to five calendar months.
4. **It needs a design pack first.** D-027 makes Varun's prototype binding and the prototype has no World screens. A ~12-screen design pack (§5) is a prerequisite for the first World sprint, and each new screen needs a sign-off row in `DECISIONS.md`.
5. **2.5D illustrated, not 3D.** The first five phases render the garage as a layered illustrated scene with car cards in slots. The 3D viewer and real-time presence stay in the stretch register (D-017, 02 §8) until the catalogue has 3D assets per canonical model.
6. **Racing is a seeded simulation, not a skill game, and not a wager.** Car stats come from the catalogue, condition, rarity, small purchasable tunes and the driver's XP level; the race runs server-side from a stored random seed so any result can be replayed and disputed. Prizes are XP, trophies, titles and cosmetics.
7. **Meetups come in two kinds with very different risk.** Virtual meetups are a scheduled Realtime room at someone's garage. In-person meetups are a _listing_ with RSVP and safety rules; the platform never organises, collects money for, or discloses a home address for one.
8. **Three legal items are due before the World, and one may already be due:** (a) an 18+ rule for the World and for buying tokens (India's DPDP Act treats everyone under 18 as a child and requires verifiable parental consent); (b) terms, privacy policy and community guidelines rewritten for virtual items and credits; (c) a counsel read of India's Online Gaming Act 2025 against §3; and (d) **OIDAR GST registration in India for a UAE entity selling digital credits to Indian consumers**, which likely applies to S7 token sales already.
9. **Running it is a live-ops job, not a software job.** Someone owns the weekly economy review, the seasonal calendar, moderation SLAs and host disputes (§11). Budget a community-manager role (part-time is fine at pilot scale) and an ongoing art budget for decor.
10. **Every phase ships dark behind its own flag** (`world`, `world_shop`, `world_earn`, `world_meetups`, `world_meetups_irl`, `world_races`, `world_clubs`, `world_presence`), and `world_shop` + `world_earn` double as the economy freeze switches.

---

## 1. Vision, principles, gate

### 1.1 Vision

A collector's catalogued garage becomes a place: a garage they build and upgrade, open to visitors, where they host meetups, show cars, run races, join clubs and climb seasons, with their _real_ diecast collection as the inventory. The marketplace, offers and chat already built are the economy under it. The World is the reason to come back every day; the marketplace is the reason it pays.

### 1.2 Principles (each becomes a decision in §13)

| #   | Principle                            | Consequence                                                                                                                                                                                       |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | One identity, one garage, one ledger | No World-only entities for users, cars or balance. `collection_items` is the car inventory; `token_ledger` is the only currency store.                                                            |
| P2  | Closed-loop credits                  | No cash-out, no P2P transfer, no tipping, no prize pools, no paid randomness, no blockchain.                                                                                                      |
| P3  | Earn is real but capped              | Daily/weekly earn caps; earned credits tagged in the ledger; sinks sized so an active user's sinks exceed earn.                                                                                   |
| P4  | Server authority                     | Every token movement, race result, quest completion and upgrade happens in a SECURITY DEFINER RPC or an Edge job. The client never asserts an amount.                                             |
| P5  | Same architecture                    | Domain layer + repo boundary (D-007), zod at boundaries (D-013), events on every mutation (D-009), flags on money/messaging/ranking (D-018), migrations only (D-006), prototype fidelity (D-027). |
| P6  | Hosting is not ownership of people   | Hosts can curate and remove, never see PII; blocks and reports apply everywhere; the platform can override a host.                                                                                |
| P7  | 2.5D first                           | Illustrated scene + existing card patterns. No engine until the catalogue has assets.                                                                                                             |
| P8  | Adults only at launch                | World and purchases require 18+ (self-declared at onboarding + the invite gate). Revisit with a parental-consent flow later.                                                                      |

### 1.3 Gate to start

- Pilot success criteria in 01 §6 met (activation, retention W4, token conversion).
- S8 (F-13 XP/levels/badges) and S9 (jobs, PWA) shipped to prod.
- Varun's World design pack delivered (§5.3) and the §13 decisions accepted.
- Legal items in §10 "before launch" column closed.

---

## 2. Feature catalogue

Features are grouped into pillars. Each pillar lists what it does, which TinyTorque pieces it reuses, and what it must never do.

### 2.1 Pillar A — My Garage (the space)

- A garage is created lazily for every profile on first World visit (`world_garages`, 1:1 with `profiles`).
- **Levels**: Shed → Garage → Showroom → Warehouse → Vault. Level sets display slots, decor slots, visitor cap and which event sizes you can host. Levels are bought with credits _and_ gated by XP level (F-13 tiers), so money alone cannot skip progression.
- **Display slots** hold real items from `collection_items` (only `is_public` items can be displayed). A "featured car" slot renders large on the garage page and in share images.
- **Decor & themes**: wall, floor, lighting, signage, shelves, trophy wall. Items come from `world_items` (reference table, priced in credits, some free, some level-locked, some season-limited, some earned-only). Owned items live in `world_inventory`; placement is a layout document (`world_garages.layout jsonb`, zod-validated).
- **Garage score** = f(items displayed, rarity mix, decor, kudos, visits, trophies). Used for leaderboards and club rankings. Computed by a consumer from events, replayable like XP.
- **Marketplace bridge**: a displayed car that is also listed shows the listing badge and deep-links to the listing; an accepted deal (`offer.completed`) moves the car out of the seller's slots automatically (event consumer), and the buyer gets a "park it" prompt.

### 2.2 Pillar B — Visiting & social

- **Open house** modes: Public, Followers, Invite-only. Invite = share link with a token (expiring) or a direct invite to a handle. Reuses `follows` (schema exists, 03 §2.12).
- **Visit** = a page view recorded as `world_visits` (dedup per visitor per day) → "recent visitors" list for the owner (handles only) and visit counts. Presence ("who is here now") is deferred (D-017), later via Supabase Realtime Presence behind `world_presence`.
- **Kudos**: one per visitor per garage per day ("rev" the engine). Guestbook = short messages, host-moderated, clean-language validator (the deferred MV-S6-04 becomes mandatory here).
- **Clubs**: named groups with a clubhouse (a shared garage-like page that shows members' featured cars), a club feed, member roles (owner/admin/member), join modes (open/apply/invite). Clubs can host meetups and club races. Behind `world_clubs`.
- **Leaderboards**: garage score, race wins, meetup attendance, per country and global, per season. Labelled, no paid ranking (01 §7 principle carries over).

### 2.3 Pillar C — Meetups & get-togethers

- **Virtual meetup**: a scheduled event hosted at a garage or clubhouse. Fields: title, theme ("JDM night", "Treasure Hunt show-and-tell"), start/end, capacity (by host garage level), visibility (public/followers/club/invite), showcase list (each attendee brings up to N cars from their public items), live room (Realtime chat, same pattern as deal chat), reactions, best-in-show vote (one vote per attendee, result frozen at end), photo wall (media rows), reminders (notifications + email via Resend).
- **Hosting fee** in credits, scaled by capacity; it is a platform fee (a sink), not a pot. Attending is free. Co-hosts allowed.
- **In-person meetup** (behind `world_meetups_irl`): a listing with city, _approximate_ area (never a street address in the public page; exact venue is shared only to confirmed attendees and only if the host chooses a public venue), date, capacity, RSVP, host rules, and an attendee check-in (host confirms attendance → XP). Mandatory safety banner, public-venue recommendation, 18+ only, no money collection via the platform, "TinyTorque is not the organiser" disclaimer. Reportable; hosts with upheld reports lose hosting rights.
- **Recurring**: club nights (weekly/monthly) as a template that spawns instances via the jobs runner.

### 2.4 Pillar D — Racing

- **Stats model** (code, `domain/races/stats.ts`, versioned): base archetype from the canonical model's segment (sports / muscle / exotic / truck / classic / fantasy), scale factor, condition (reliability), rarity (small bonus), owned tunes (capped total ≤ 10 % effect), driver level (F-13 tier, capped ≤ 10 %), plus a seeded random "luck" component. A car without a canonical match gets the neutral archetype, so an unmatched garage can still race.
- **Formats**: Time trial (solo vs ghost times), Challenge (head-to-head, send to a handle or club), Event (8/16-car bracket hosted at a garage, public or club), Season league (points across events, monthly).
- **Execution**: entry via RPC `enter_race` (validates ownership, item is public, one entry per user, entry fee via `spend_tokens` with reason `spend_race_entry` — a platform fee), run via Edge job `run_race` at the scheduled time with a stored seed, results written once (`race_results` immutable), replay viewer renders from seed + stats version. Disputes = re-run the seed; if the stats version is unchanged the result is identical.
- **Prizes**: XP, trophy items (earned-only decor), titles, badge progress, season points. **Never credits.** Free-entry community races may award small credit bonuses from the earn budget (§3), capped, and only when entry is free — keep this split explicit in the rules engine so a "paid entry → credit reward" path cannot exist.
- **Spectate**: live result ticker over Realtime broadcast, then the replay.

### 2.5 Pillar E — Progression, quests & earning

- Reuses F-13 XP and levels. New XP rules for World actions (visit, kudos given/received, host, attend, race, win, quest).
- **Quests**: daily (3) and weekly (3) from a rules table (`quests`), progress by event consumer, rewards = XP + small credits + occasionally an earned-only item. Daily login streak with a modest credit at 7 days.
- **Seasons**: 6–8 week seasons with a theme, a season pass track that is **free** (no paid tier at launch), seasonal decor, leaderboards reset, end-of-season trophies.
- **Achievements**: extend `achievements` (03 §2.18) with World badges.

### 2.6 Pillar F — Shop & economy surfaces

- `/world/shop`: decor, themes, garage levels, tunes, consumables (spotlight: 24 h placement on the "Open garages" page, labelled "Spotlight"). Prices are data rows. "Earned-only" items are visible but not purchasable.
- `/tokens` (exists) gains a "What credits buy in the World" section. `/tokens/history` shows World reasons.

### 2.7 Explicitly out, always (not "later")

Cash-out or redemption of credits · P2P transfer or gifting of credits · tipping · prize pools or any credit payout tied to a paid entry · purchasable random crates / gacha / loot boxes · real-money prizes · NFTs, blockchain, tradeable items · ranking boosts that are not labelled · collecting payment for in-person events · showing another user's PII (phone, exact location, email).

---

## 3. Economy design

### 3.1 One ledger, more reasons

`token_ledger` stays the single store. Add enum values to `token_ledger_reason`:

- Earn: `earn_quest`, `earn_daily`, `earn_race_participation`, `earn_host`, `earn_attend`, `earn_achievement`, `earn_referral`, `earn_season`.
- Spend: `spend_garage_level`, `spend_world_item`, `spend_meetup_host`, `spend_race_entry`, `spend_spotlight`, `spend_rename`.
- Add column `source` enum `purchased | earned | promo | adjust` on `token_ledger` (derived from reason, set by the RPC) so analytics, refund logic and accounting can separate paid from earned value without a second balance.

### 3.2 Sources and sinks (placeholder values, same status as D-064)

| Flow                                       | Direction | Placeholder             | Cap / rule                                    |
| ------------------------------------------ | --------- | ----------------------- | --------------------------------------------- |
| Daily login                                | earn      | +1                      | once/day; +5 at a 7-day streak                |
| Daily quest                                | earn      | +2 each                 | 3/day                                         |
| Weekly quest                               | earn      | +8 each                 | 3/week                                        |
| Attend a meetup (checked in)               | earn      | +3                      | 2/day                                         |
| Host a meetup that reaches ≥ 5 attendees   | earn      | +10                     | 2/week                                        |
| Race participation (free-entry races only) | earn      | +1                      | 5/day                                         |
| Season track milestones                    | earn      | +5 … +25                | per season                                    |
| **Daily earn ceiling**                     | —         | **15**                  | enforced in the earn RPC                      |
| Garage level up                            | spend     | 40 / 90 / 180 / 350     | also XP-gated                                 |
| Decor item                                 | spend     | 5 – 60                  | durable                                       |
| Theme                                      | spend     | 25                      | durable                                       |
| Extra display slot (beyond level)          | spend     | 15                      | durable, max per level                        |
| Host a virtual meetup                      | spend     | 5 / 10 / 20 by capacity | platform fee                                  |
| Race event entry (bracket)                 | spend     | 3 – 10                  | platform fee; time trials and challenges free |
| Spotlight 24 h                             | spend     | 20                      | labelled                                      |
| Garage rename                              | spend     | 5                       | once free                                     |

Design targets: an engaged free user earns ~60–80 credits/week and has at least ~120/week of desirable sinks, so earning funds habit but not everything; purchased credits (`pack_small` 50, `pack_large` 150 under D-064) stay the way to upgrade faster. Tune from data, as data migrations.

### 3.3 Rules that protect the business and the user

- **Earned credits expire** 180 days after grant if unspent (FIFO spend, earned before purchased). **Purchased credits never expire** (consumer-law safe in both countries). Expiry runs in the jobs runner and posts `expire_earned` ledger rows.
- **Refunds**: Stripe refund of a pack → debit (D-065 allows negative). A negative balance locks spending and shows a banner; durable items are not revoked for the first chargeback, revoked on the second (abuse pattern).
- **Idempotency** on every earn/spend (key = rule + user + period), rate limits on visits/kudos/guestbook/RSVP, device + IP heuristics on earn, admin "earn freeze" per user.
- **No pay-to-win beyond 10 %**: tunes and driver level together cannot move a race outcome more than that; the stats module has a test that asserts the cap.
- **Pricing is data** (`world_items.price`, `world_levels.price`, `quests.reward`), changed by migration, never by code; events record the price paid so history survives repricing.

### 3.4 Metrics to watch weekly

Sinks ÷ sources (target > 1.2 for active users) · % of spend that is earned vs purchased · median balance and hoarding tail · days to first World spend · pack conversion of World-active vs World-inactive users · earn-cap hit rate · refund and chargeback rate · credits expired (breakage, see §10 accounting).

---

## 4. Seamless connection with TinyTorque (what "seamless" means concretely)

| TinyTorque thing             | World behaviour                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in / onboarding         | No extra sign-up. First `/world` visit creates the garage and shows a 3-step intro in the D-042 wizard style.                                                                                                   |
| `collection_items`           | The only car inventory. Display slots, showcases and race entries reference `collection_items.id`. Deleting or making an item private removes it from slots (consumer on `item.deleted` / `item.made_private`). |
| Canonical catalogue          | Race archetype and future 3D asset key. Unmatched items race with neutral stats, which is itself a nudge to accept catalogue matches.                                                                           |
| Public profile `/u/[handle]` | Gains a "Visit garage" card and trophies/titles. `public_profiles` view stays the only read path for other users.                                                                                               |
| Marketplace & offers         | Displayed cars that are listed show "For sale" and deep-link; `offer.completed` moves the car between garages; a visitor can start an offer from a garage slot (same `offers` RPC path, no new logic).          |
| Deal chat & notifications    | Meetup rooms reuse the messaging module with a new thread kind; `notifications.type` gains `visit`, `kudos`, `meetup_invite`, `meetup_reminder`, `race_result`, `quest_complete`, `club_invite`.                |
| Tokens / Pro                 | One balance. Pro perks in the World: +2 display slots, a Pro signage item, host capacity +50 %. Header balance chip already realtime.                                                                           |
| Trust & safety               | `reports.target_type` gains garage / meetup / club / room message; `blocks` hide garages, block RSVPs and race challenges both ways. Admin console gains World queues.                                          |
| Events / XP                  | Every World mutation emits `world.*`, `meetup.*`, `race.*`, `club.*`, `quest.*` events; XP, quests, garage score and notifications consume them.                                                                |
| Flags                        | World flags evaluated by the same `domain/flags`, audience rules allow country or cohort rollouts (UAE first, then India, or vice versa).                                                                       |
| Analytics                    | PostHog events mirror the domain events; the §3.4 metrics are SQL on `token_ledger` + `domain_events`.                                                                                                          |

---

## 5. Experience & fidelity (D-027, D-044, D-045)

### 5.1 Rendering approach

- Garage page = a layered illustrated scene (background by theme, decor layers, car cards placed in slots). Built from CSS layers and existing `CarCard`/panel patterns; the layout document maps slots to screen anchors per breakpoint. No canvas, no WebGL in phases W1–W5.
- Motion only from the `garage-log-147.html` register already ported (press, spinner, progress fill). Race replay is a progress-bar style lane view, not an animation engine.
- All six themes at 360 px and 1280 px, same bottom nav, side rail at ≥ 1440 px (D-053).

### 5.2 Screen inventory (needs Varun's design pack)

`/world` home (your garage + open garages + today's quests) · garage editor (slots, decor placement) · visitor view of a garage · shop · inventory · meetup list · meetup detail + room · create meetup (single form, two sections for virtual/in-person) · race hub (time trial, challenges, events) · race result/replay · club page · leaderboards · season page. Settings gains a World section (open-house mode, who can invite me, who can challenge me).

### 5.3 Design pack contents

Screen designs in the six themes for the 13 screens above, decor/theme art for the launch catalogue (≈ 30 items), five garage-level backgrounds, trophy art, empty/loading/error states, copy for rules and safety banners. Each screen is logged as a D-xxx sign-off row before it is built.

---

## 6. Architecture

### 6.1 Placement

- Same Next.js app. Routes under `src/app/world/*`. New domain modules: `domain/world` (garages, levels, items, inventory, layout, visits, kudos), `domain/meetups`, `domain/races`, `domain/clubs`, `domain/quests` (or inside `domain/gamification` if S8 lands it there). Services only; repos hold Supabase.
- Thin `src/app/api/v1/world/*` route handlers over the same services (ADR-05's "world client" argument). Not needed by the PWA; built because it is nearly free and it is the seam a future dedicated client or Varun's native app would use.

### 6.2 Server authority (P4)

| Operation                                                | Mechanism                                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buy level / item / slot, host fee, race entry, spotlight | `spend_tokens` (existing RPC) with new reasons; a wrapping RPC per operation validates eligibility (level, XP, ownership) and writes the grant in the same transaction.                                          |
| Earn                                                     | Never a client call. Consumer on `domain_events` (trigger-driven for cheap rules, Edge job for batch rules) calls `earn_tokens(user, reason, amount, key)` SECURITY DEFINER with the daily ceiling check inside. |
| Race run                                                 | Edge Function `run-race` invoked by the jobs runner; reads entries + stats version, derives seed, writes `race_results` once; emits `race.completed`.                                                            |
| Meetup lifecycle                                         | RPC `transition_meetup(id, action)` modelled on `transition_offer` (D-021 pattern): draft → scheduled → live → ended → cancelled.                                                                                |
| Layout save                                              | Server action with zod schema; validates slots ≤ level capacity and items owned + public.                                                                                                                        |

### 6.3 Realtime

- Meetup rooms and race tickers use the Realtime channel pattern from deal chat (RLS-scoped). Presence is behind `world_presence` and off at launch (D-017).
- Cost note: Supabase Pro includes 500 concurrent Realtime connections; a 50-person meetup is fine, a public launch event is not. The jobs runner caps concurrent live meetups per hour by flag audience.

### 6.4 Jobs (extends `supabase/functions/jobs`, S9)

Quest reset (daily/weekly) · earned-credit expiry · race scheduler · meetup reminders (T-24h, T-1h) and state transitions · season rollover · garage-score recompute (nightly) · `domain_events` partition creation.

### 6.5 Media

Garage banners and meetup photo walls are `media` rows in the private buckets (D-010). User-uploaded decor is **not** allowed at launch (moderation cost); decor is platform art only.

### 6.6 Security & privacy

RLS per table (§7) with the pgTAP matrix extended · `public_profiles` only for other users · in-person venue detail readable only by confirmed attendees · blocks enforced in every visibility query · rate limits as triggers (same as `check_offer_rate_limit`) · all World writes idempotent.

---

## 7. Data model deltas (03-style; file names illustrative)

| Table                       | Key columns                                                                                                                                                                                                                                                              | Notes                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `world_levels` (ref)        | `level int pk, name, display_slots, decor_slots, visitor_cap, host_cap, price int, min_xp_level int`                                                                                                                                                                     | seeded 5 rows                                    |
| `world_garages`             | `user_id pk→profiles, level int→world_levels, name, open_mode enum public/followers/invite, featured_item_id→collection_items, layout jsonb, theme_item_id, score int, created_at, updated_at`                                                                           | 1:1; created lazily                              |
| `world_items` (ref)         | `id, sku unique, kind enum decor/theme/tune/trophy/consumable/signage, name, price int null (null = earned-only), min_level, season_id null, active, art_path, effect jsonb`                                                                                             | prices are data                                  |
| `world_inventory`           | `id, user_id, item_id, acquired_via enum purchase/earn/promo, ledger_id null, created_at`                                                                                                                                                                                | unique(user,item) for durables                   |
| `world_visits`              | `id, garage_user_id, visitor_id, visited_on date, created_at`                                                                                                                                                                                                            | unique(garage, visitor, day)                     |
| `world_kudos`               | `(garage_user_id, giver_id, given_on) pk`                                                                                                                                                                                                                                |                                                  |
| `world_guestbook`           | `id, garage_user_id, author_id, body (≤140), hidden_by_host bool, created_at`                                                                                                                                                                                            | clean-language validated                         |
| `clubs`                     | `id, slug citext unique, name, owner_id, join_mode enum open/apply/invite, country_code null, description, banner_media_id, created_at`                                                                                                                                  |                                                  |
| `club_members`              | `(club_id, user_id) pk, role enum owner/admin/member, status enum active/pending/banned, joined_at`                                                                                                                                                                      |                                                  |
| `meetups`                   | `id, host_id, club_id null, garage_user_id null, kind enum virtual/in_person, title, theme, starts_at, ends_at, capacity, visibility enum, status enum draft/scheduled/live/ended/cancelled, city, area_text, venue_private text, rules_text, fee_ledger_id, created_at` | `venue_private` readable by confirmed RSVPs only |
| `meetup_rsvps`              | `(meetup_id, user_id) pk, status enum going/waitlist/declined/checked_in, created_at, checked_in_at`                                                                                                                                                                     |                                                  |
| `meetup_showcase`           | `id, meetup_id, user_id, item_id, votes int`                                                                                                                                                                                                                             | ≤ N per attendee                                 |
| `meetup_messages`           | or `messaging` threads with `kind = meetup`                                                                                                                                                                                                                              | reuse S6                                         |
| `race_stats_versions` (ref) | `version int pk, notes, created_at`                                                                                                                                                                                                                                      | stats module version pin                         |
| `races`                     | `id, kind enum time_trial/challenge/event/league, host_id, club_id null, garage_user_id null, title, scheduled_at, status enum open/locked/run/ended/cancelled, capacity, entry_fee int, seed text null, stats_version int, season_id null, created_at`                  | seed set at lock                                 |
| `race_entries`              | `(race_id, user_id) pk, item_id, fee_ledger_id null, created_at`                                                                                                                                                                                                         | item must be public + owned                      |
| `race_results`              | `race_id, user_id, position int, time_ms int, breakdown jsonb` pk(race_id,user_id)                                                                                                                                                                                       | immutable: no update/delete policies             |
| `seasons`                   | `id, name, starts_at, ends_at, theme`                                                                                                                                                                                                                                    |                                                  |
| `season_points`             | `(season_id, user_id) pk, points int`                                                                                                                                                                                                                                    | consumer-maintained                              |
| `quests` (ref)              | `key pk, cadence enum daily/weekly, rule jsonb, reward_xp, reward_credits, reward_item_id null, active`                                                                                                                                                                  |                                                  |
| `quest_progress`            | `(user_id, quest_key, period_start) pk, progress int, completed_at`                                                                                                                                                                                                      |                                                  |
| `token_ledger` (modify)     | add `source` enum; extend `token_ledger_reason`                                                                                                                                                                                                                          | D-006: enum additions are additive               |
| `notifications` (modify)    | extend `type` enum                                                                                                                                                                                                                                                       |                                                  |
| `reports` (modify)          | extend `target_type`                                                                                                                                                                                                                                                     |                                                  |
| `achievements` (seed)       | World badges                                                                                                                                                                                                                                                             |                                                  |
| `feature_flags` (seed)      | the eight `world*` flags, all off                                                                                                                                                                                                                                        |                                                  |

RPCs: `ensure_world_garage()`, `buy_world_level()`, `buy_world_item()`, `earn_tokens()` (service-role / trigger only), `transition_meetup()`, `rsvp_meetup()`, `check_in_meetup()`, `enter_race()`, `lock_race()`; Edge: `run-race`. Migrations 0012–0017 in the order of §8.

---

## 8. Delivery roadmap

Capacity assumption: D-002 (≈ 20 h/sprint, solo + Claude Code). Each phase ends with a prod deploy dark (D-028) and a sprint-end demo.

| Phase                          | Sprints | Scope                                                                                                                                                                                                                                      | Flags                          | Exit demo                                                        |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------- |
| **W0 Foundations**             | 1       | Decisions accepted; design pack received; migration 0012 (levels, garages, items, inventory, ledger reasons, flags); `domain/world` services + Vitest; `/api/v1/world` scaffold; T&C/privacy/guidelines v2 drafted; 18+ gate on onboarding | `world` (off)                  | Garage row created for a founder on prod, invisible              |
| **W1 Garage & visits**         | 2       | `/world` home, garage view/editor, slots, featured car, themes, open-house modes, invites, visits, kudos, guestbook, share image, marketplace bridge                                                                                       | `world`, `world_shop`          | Founders open their garages and visit each other                 |
| **W2 Earn & quests**           | 2       | Quests, daily streak, earn RPC + caps + expiry job, XP rules for World, season v0 (one season, free track), shop complete, `/tokens` World section                                                                                         | `world_earn`                   | A week of quests earns a theme; ledger shows earned vs purchased |
| **W3 Virtual meetups & clubs** | 2       | Meetup create/host/RSVP/room/showcase/vote/reminders, `transition_meetup`, clubs v1 with clubhouse, host moderation tools                                                                                                                  | `world_meetups`, `world_clubs` | A founders' meetup with 10 attendees and a best-in-show          |
| **W4 Racing**                  | 2       | Stats module v1 with tests, time trial, challenges, bracket events, `run-race` Edge job, replay viewer, trophies/titles, season points                                                                                                     | `world_races`                  | A 16-car bracket runs on prod and is replayed from its seed      |
| **W5 In-person meetups**       | 1       | IRL listing, approximate location, private venue to confirmed, safety banner, check-in → XP, host eligibility rules, admin queue                                                                                                           | `world_meetups_irl`            | A real UAE meetup listed, RSVP'd, checked in                     |
| **W6 Live-ops**                | 2       | Leaderboards, club leagues, season rollover, economy dashboard in `/admin`, spotlight, earn-freeze tooling, hardening, pgTAP matrix complete                                                                                               | —                              | First public season opens to the full pilot cohort               |
| Later                          | —       | Presence, 3D viewer evaluation (02 §8 engine decision), Arabic/Hindi, native client via `/api/v1`                                                                                                                                          | `world_presence`               | —                                                                |

Twelve sprints. The first user-visible value (W1) lands after three sprints, which is the point at which to decide whether to continue.

---

## 9. Community rules, trust & safety

**Guidelines additions** (publish with the W1 flag): respect in garages, rooms and guestbooks · no harassment, hate, sexual content, doxxing · no counterfeit or "custom passed off as original" promotion · no selling or price talk inside meetups except via a marketplace link · no brand logos or claims of sponsorship in garage names or meetup titles · in-person meetups: public venues, 18+, no alcohol, no cash collection via the platform, hosts are responsible for local permits · TinyTorque is not the organiser of any in-person event and may remove any listing.

**Tools**: report on every World entity · block (hides both ways) · host mute/kick/ban for rooms and meetups · clean-language validator (MV-S6-04) on names, titles, guestbooks, room messages · platform art only for decor (no user image moderation cost at launch) · admin queues for World reports · host eligibility: ≥ Level 2 (F-13 tier "Collector") and no upheld report in 90 days · automatic hosting suspension on two upheld reports · audit trail is `domain_events`.

**Minors**: 18+ at launch (P8). If under-18 collectors are ever admitted, India's DPDP Rules require verifiable parental consent and forbid behavioural tracking of children, which affects PostHog as well as the World.

---

## 10. Legal & regulatory — what the owner must know (verify every line with counsel; this is a plan, not advice)

| Topic                         | India                                                                                                                                                                                                                                                                                                                 | UAE                                                                                                                                                                                               | Design consequence                                                                                                                                                                                                  | When                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Real-money / chance gaming    | **Promotion and Regulation of Online Gaming Act, 2025** bans "online money games": games played with stakes of money or money's worth with an expectation of winnings. Purchasable credits used as race entry with credit prizes could be read as exactly that. Social and e-sports games are permitted and promoted. | Gambling is a criminal offence under the Penal Code; commercial gaming is licensed only through the **GCGRA** (2023). Anything that looks like wagering on chance with purchasable stakes is out. | No credit prizes from paid entries; entry fees are platform fees; prizes are cosmetic/XP; no purchasable random crates; keep the "online social game" posture in copy and terms.                                    | Before W4 (counsel read before W0)                                               |
| Prepaid value                 | RBI PPI directions: a **closed-system PPI** (redeemable only for the issuer's own goods/services, no cash withdrawal, no third-party redemption, no transfer) sits outside RBI authorisation. Adding P2P transfer or third-party redemption makes it semi-closed and licensable.                                      | Dubai **VARA** / federal SCA regulate virtual assets; a transferable, tradeable token is a virtual asset.                                                                                         | Credits stay non-transferable and platform-only; call them "credits" in legal documents; no blockchain.                                                                                                             | Standing rule                                                                    |
| Indirect tax                  | **OIDAR GST (18 %)**: a non-resident supplier of online services to Indian consumers (B2C) must register and pay GST under the simplified OIDAR scheme. Likely already applies to S7 token sales to Indian users. 28 % GST applies to online money gaming — avoided by the row above.                                 | **VAT 5 %** on digital services to UAE consumers (Hypermax FZE's existing registration). Sales to Indian consumers are exports from the UAE side.                                                 | Price display inclusive of tax per country; tax line in Stripe; ledger `source=purchased` rows carry currency and tax.                                                                                              | Before opening token purchase to India (S7 live keys), not just before the World |
| Data protection               | **DPDP Act 2023** + Rules (notified 2025, phased): consent, purpose limitation, breach notice, and **everyone under 18 is a child** requiring verifiable parental consent and no tracking. Data lives in Mumbai (D-005), good.                                                                                        | **PDPL (Federal Decree-Law 45/2021)** and cross-border transfer rules: UAE residents' data is stored in India, which needs an adequacy basis, consent or contractual safeguards.                  | 18+ gate; consent capture recorded as an event; privacy policy covers the India hosting for UAE users; deletion flow (S8) covers World tables.                                                                      | W0                                                                               |
| Intermediary & consumer rules | IT Rules 2021 (intermediary due diligence, grievance officer, takedown timelines); Consumer Protection (E-Commerce) Rules 2020 already touch the marketplace.                                                                                                                                                         | Consumer protection law and the cybercrime law on content.                                                                                                                                        | Grievance officer named in terms; report-to-resolution SLA (§11); clear refund policy for credits.                                                                                                                  | Already due for the marketplace; restate in W0                                   |
| Payments                      | Stripe permits closed-loop virtual currency; "gambling" is a restricted category — the §3 rules keep the account safe. Indian cards on a UAE merchant may fail (01 §8 risk, Razorpay adapter via D-011).                                                                                                              | Same Stripe account.                                                                                                                                                                              | Keep D-011 interface; chargeback handling per §3.3.                                                                                                                                                                 | Standing                                                                         |
| App stores                    | If a native app ever ships, virtual credits must use in-app purchase (15–30 % fee) with anti-steering rules that vary by country.                                                                                                                                                                                     | Same.                                                                                                                                                                                             | Stay PWA (D-016); the `/api/v1` seam exists for a future client but the store decision is a separate owner decision.                                                                                                | When native is considered                                                        |
| Intellectual property         | Nominative use of Mattel/Hot Wheels, Matchbox, Tomica, Majorette etc. for cataloguing is fine; implying sponsorship is not.                                                                                                                                                                                           | Same.                                                                                                                                                                                             | No brand logos as decor or signage; generic event names ("Treasure Hunt Night" is risky because Treasure Hunt is a Mattel series name — Varun to check names); user photos are user-generated and covered by terms. | W0                                                                               |
| Virtual items & refunds       | Consumer law on prepaid value and unfair terms.                                                                                                                                                                                                                                                                       | Same.                                                                                                                                                                                             | Terms: items are licences, not property; purchased credits never expire; earned credits expire with notice; refunds on unspent purchased credits within a stated window.                                            | W0                                                                               |
| In-person events              | Organisers may need permits for public gatherings; liability sits with organiser.                                                                                                                                                                                                                                     | Public events in the UAE need venue/licence compliance; stricter.                                                                                                                                 | Platform is a listing service; disclaimer and host obligations in guidelines; no money handling; report path.                                                                                                       | W5                                                                               |
| Accounting                    | Credits sold = deferred revenue, recognised on spend; expired earned credits are not revenue (they were never sold); breakage on purchased credits only if an expiry is ever introduced.                                                                                                                              | Same.                                                                                                                                                                                             | Ledger `source` tag and per-reason reporting make this a SQL query, not a project.                                                                                                                                  | W0 (chart of accounts)                                                           |
| AML / KYC                     | Closed-loop, non-transferable credits with no cash-out keep the product outside AML obligations.                                                                                                                                                                                                                      | Same.                                                                                                                                                                                             | Adding transfer, tipping or redemption re-opens this.                                                                                                                                                               | Standing                                                                         |

---

## 11. Running it smoothly — operating model

| Area              | What has to exist                                                                                                                                                                                                                  | Owner                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Live-ops calendar | Season themes (6–8 weeks), weekly featured garages, monthly league, holiday events for both countries. Planned one season ahead.                                                                                                   | Community manager (Varun or a hire)       |
| Economy review    | Weekly 30-minute review of §3.4 metrics in `/admin`; price or cap changes shipped as data migrations within the next sprint.                                                                                                       | Sreejith                                  |
| Moderation        | Report-to-first-action SLA 24 h, resolution 72 h; appeal path; host suspension rules; a written escalation list for threats or illegal content.                                                                                    | Community manager, Sreejith as escalation |
| Support           | Users see their own ledger and race replays, which closes most tickets. Admin tools: `admin_adjust_tokens` (exists), earn freeze, revoke item, re-run race from seed, cancel meetup with refund of host fee.                       | Sreejith (tools), CM (tickets)            |
| Content           | Decor/theme art pipeline and a seasonal art budget; everything is platform art, versioned in `public/world/`.                                                                                                                      | Varun                                     |
| Cost watch        | Realtime connections, Edge invocations, storage for photo walls, PostHog volume. Set alerts at 70 % of plan limits.                                                                                                                | Sreejith                                  |
| Incident          | Per-flag kill switches; `world_shop` + `world_earn` are the economy freeze; runbook entries for "race ran twice", "earn exploit", "meetup room abuse".                                                                             | Sreejith                                  |
| Legal cadence     | Terms version accepted at sign-in recorded as `user.accepted_terms` event; annual counsel review; grievance officer mailbox monitored.                                                                                             | Sreejith                                  |
| KPIs              | World DAU/WAU and share of total WAU · garages opened · visits per garage · meetups hosted / attended · races run · quest completion · token conversion lift of World-active users · sinks ÷ sources · reports per 1 000 sessions. | Sreejith                                  |

---

## 12. Risks

| Risk                                                 | Impact                                        | Mitigation                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Regulatory misclassification as money gaming (India) | Forced shutdown of racing or credits in India | §3 rules, counsel read before W0, India-only flag audience to disable racing fees if needed                         |
| Pay-to-win backlash                                  | Community trust                               | 10 % cap with a test; prizes cosmetic; labelled spotlight only                                                      |
| Earn farming by bots or multi-accounts               | Inflation, support load                       | Caps, idempotency, device heuristics, invite-only cohort, earn freeze                                               |
| Empty world at launch                                | Retention                                     | Open to the whole pilot cohort at once with a founders' meetup and a seeded season; shops get a showroom level free |
| Design pack slips                                    | Nothing can be built under D-027              | Make it the W0 exit criterion; build services and migrations meanwhile                                              |
| Solo-builder bandwidth                               | 12 sprints becomes 20                         | Phase gates; W1 is a stop/continue decision                                                                         |
| Realtime and Edge cost at a public event             | Bill shock                                    | Caps on concurrent live meetups, alerts, no public (non-cohort) events in H3                                        |
| In-person meetup incident                            | Reputation, liability                         | Listing-only posture, guidelines, 18+, public venues, report path, insurance question to counsel                    |
| Catalogue coverage too low for good racing           | Races feel random                             | Neutral archetype for unmatched, and racing nudges catalogue acceptance; track match rate                           |

---

## 13. Decisions to accept before W0 (proposed `DECISIONS.md` rows; owner accepts with `/decide`)

1. **H3 program**: Collectors World is the H3 program as scoped in `07-collectors-world.md`, starts after the pilot gate (01 §6) and S8/S9, in the W0–W6 phases; supersedes D-017's "any multiverse feature" exclusion for post-pilot work only.
2. **One identity, one garage, one ledger** (P1): no World-only users, cars or currency; `collection_items` is the inventory; `token_ledger` gains World reasons and a `source` column.
3. **Closed-loop credits** (P2): no cash-out, transfer, tipping, prize pools from paid entries, purchasable random rewards, or blockchain; "credits" in legal documents.
4. **Earn policy** (P3): daily ceiling, earned credits expire after 180 days with notice, purchased never expire, FIFO spend earned-first; placeholder values per §3.2 with D-064's status.
5. **Server authority** (P4): all World token movements and race results via SECURITY DEFINER RPCs or Edge jobs; the client never asserts an amount.
6. **2.5D illustrated rendering** (P7) for W1–W5; engine decision deferred per 02 §8.
7. **18+ at launch** (P8) for the World and for token purchases.
8. **Design pack prerequisite**: each World screen gets a D-xxx sign-off row before it is built (D-027 mechanism).
9. **Racing model**: seeded server-side simulation, stats version pinned per race, ≤ 10 % combined paid/level influence, cosmetic prizes only.
10. **In-person meetups are listings**: platform never organises, collects money, or publishes exact addresses; host eligibility and suspension rules per §9.
11. **Flags**: `world`, `world_shop`, `world_earn`, `world_meetups`, `world_meetups_irl`, `world_races`, `world_clubs`, `world_presence`; `world_shop` + `world_earn` are the economy freeze.
12. **India OIDAR GST**: confirm registration before enabling live token purchases for Indian users (applies to S7, independent of the World).

---

## 14. Open questions for Varun

Name of the World and of credits in the UI · garage level names and art direction · the launch decor catalogue (≈ 30 items) · meetup themes and race format names (avoid Mattel series names) · whether clubs ship in W3 or move to W6 · which country opens first.
