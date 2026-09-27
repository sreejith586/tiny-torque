# 03 — Data Model v2 (target schema for the pilot)

> Status: DRAFT v1 — 2026-09-27. Baseline = Varun's `supabase/schema.sql` (becomes migration `0000_baseline.sql`, unchanged). Everything below is expressed as **deltas** in numbered migrations so history stays honest. Column types are Postgres. All tables: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz` (trigger-maintained), RLS enabled.

Conventions: `deleted_at timestamptz null` = soft delete (views/queries filter it); money as `numeric(12,2)` + `currency char(3)`; enums as Postgres `enum` types (not text+check) from v2 onward; every FK indexed.

---

## 1. Entity overview

```
auth.users ─1:1─ profiles ─┬─< collection_items >─── catalog_models >── catalog_brands
                           │        │  └─< media
                           │        └─< marketplace_listings ─< offers ─< deal_messages
                           │                    │                 └─ seller_reviews
                           ├─< wishlist_items   └─< listing_favorites
                           ├─< item_favorites
                           ├─< follows (follower/followee)
                           ├─< token_ledger  ─ token_purchases
                           ├─< ai_scan_jobs
                           ├─< user_achievements
                           ├─< reports · blocks · notifications
                           └─< domain_events (actor)
feature_flags · token_packs · achievements · countries (reference)
```

## 2. Table-by-table

### 2.1 `profiles` (modify)
| Column | Change | Notes |
|---|---|---|
| `handle` | **add** `citext unique not null` | 3–24 chars `[a-z0-9_]`, generated from display name at onboarding, editable once/30 days. Public URL `/u/{handle}` |
| `country_code` | **add** `char(2) not null` | ISO-3166; pilot values AE, IN |
| `city` | **add** `text` | replaces free-text `location` (keep `location` for one migration, backfill, then drop) |
| `bio` | **add** `text` (≤ 280) | |
| `banner_url` | **add** → becomes `banner_media_id uuid → media` | |
| `photo_url` | → `avatar_media_id uuid → media` | |
| `mobile` | **keep but never expose** | excluded from `public_profiles` view |
| `plan` | keep `free/pro` | `pro` is derived: `pro_until > now()` |
| `pro_until` | **add** `timestamptz` | set when Pro purchased with tokens |
| `tokens` | keep as **cached balance** | maintained by trigger on `token_ledger`; never written by app |
| `xp`, `level` | **add** `integer default 0` | maintained by gamification consumer |
| `role` | **add** enum `user/admin` default `user` | |
| `scan_quota_used`, `scan_quota_reset_at` | **add** | monthly rolling; `scan_quota_bonus` for purchased packs |
| `onboarding_completed_at`, `tutorial_dismissed_at` | **add** | |
| `deleted_at` | **add** | account deletion flow anonymises PII |

**View `public_profiles`:** `id, handle, display_name, account_type, store_name, country_code, city, bio, avatar, banner, level, xp, created_at, rating_avg, rating_count, is_pro` — the only thing other users can select. Base-table select policy becomes owner-or-admin.

### 2.2 `countries` (new, reference)
`code char(2) pk, name, dial_code, currency char(3), enabled bool`. Seed AE, IN enabled; rest disabled.

### 2.3 `catalog_brands` (new) / `catalog_models` (new) — ADR-06
`catalog_brands(id, name unique citext, slug, logo_media_id, status enum proposed/verified)`
`catalog_models(id, brand_id fk, name, series, scale, year, casting_code, color_variants jsonb, status enum proposed/verified/merged, merged_into_id fk self, proposed_by uuid, verified_by uuid, search tsvector generated)`
Unique index on `(brand_id, lower(name), coalesce(series,''), coalesce(scale,''))`. GIN on `search`. Policies: everyone reads `verified` + own proposals; admin writes; service role upserts proposals from AI scan.

### 2.4 `collection_items` (modify)
Add: `catalog_model_id uuid fk null`, `color text`, `is_favorite bool default false`, `notes text`, `currency char(3) default from profile`, `updated_at`, `deleted_at`, `search tsvector generated (brand, model, series, variant, color)`.
Change: `photo`/`photos jsonb` → **drop after migration** to `media` (keep for one release behind a compatibility view `collection_items_v1`).
Indexes: `(owner_id, deleted_at)`, `(owner_id, brand)`, GIN `search`, `(catalog_model_id)`.
Policies unchanged in spirit (public read if `is_public`, owner CRUD) but filter `deleted_at is null` for non-owners.

### 2.5 `media` (new) — ADR-08
`id, owner_id fk profiles, kind enum item/avatar/banner/listing/chat, entity_id uuid, bucket text, path text unique, width int, height int, bytes int, sort_order int, status enum uploading/ready/flagged/removed, created_at`
Policies: owner CRUD; anyone can select rows whose parent is public (via SQL function `media_is_public(id)`); admin all. Storage policies mirror by key prefix.

### 2.6 `marketplace_listings` (modify heavily → effectively v2)
Drop denormalised `seller_type/photo/name/location/mobile` (join `public_profiles`), drop `offers jsonb` (→ `offers` table).
Add: `catalog_model_id fk null`, `listing_type enum sale/trade/both`, `currency char(3) not null`, `country_code char(2) not null` (from seller at publish), `min_offer numeric` (derived: seller may set; default = price), `description text`, `view_count int default 0`, `favorite_count int default 0` (trigger), `offer_count int default 0` (trigger), `expires_at timestamptz` (pilot: 60 days, renewable), `sold_at`, `sold_offer_id fk offers`, `updated_at`, `deleted_at`, `search tsvector`.
Status enum: `draft/active/reserved/sold/expired/removed`.
**Constraint:** trigger `enforce_active_listing_limit()` before insert/update to `active` → count active listings for seller vs `entitlement_listing_slots(seller_id)` (base 2 + purchased slots, unlimited if Pro). DB is the last line; UI asks entitlements first.
Indexes: `(status, country_code, created_at desc)`, `(seller_id, status)`, `(brand)`, `(catalog_model_id)`, GIN `search`.

### 2.7 `offers` (new; replaces jsonb)
`id, listing_id fk, buyer_id fk, seller_id fk (denorm for RLS), type enum cash/buy_now/trade, amount numeric, currency, trade_item_ids uuid[] (buyer's public items), message text (≤ 500), status enum pending/accepted/declined/withdrawn/expired/completed/cancelled, responded_at, completed_at, expires_at (72 h), created_at`
Rules (enforced in `domain/deals` and by CHECK/trigger where cheap):
- cash offer ≥ `listing.min_offer` when `open_to_offers`; `buy_now.amount = listing.price`
- one `pending` offer per buyer per listing (partial unique index)
- rate limit: ≤ 5 offers/hour/buyer, ≤ 20/day (SQL function `check_offer_rate_limit()` in trigger)
- accepting an offer sets listing `reserved`, auto-declines other pending offers (emits events), opens chat
- `completed` = seller marks sold; `sold_offer_id` set; review window opens
Policies: buyer or seller read; buyer insert (with `buyer_id = auth.uid()`); status transitions only via `rpc transition_offer()` (SECURITY DEFINER with role checks) — no direct update policy.

### 2.8 `deal_messages` (new)
`id, offer_id fk, sender_id fk, body text (≤ 2000), read_at, created_at`. Insert allowed only if offer `status in (accepted, completed)` and sender ∈ {buyer, seller} and no block between them. Realtime enabled on this table (channel per offer).

### 2.9 `seller_reviews` (modify)
`offer_id` → `uuid fk offers unique` (one review per completed deal), drop `buyer_name` (join). Insert allowed only when offer `completed` and `auth.uid() = buyer_id`. Trigger updates `profile_ratings` materialised columns (`rating_avg`, `rating_count` on profiles).

### 2.10 `wishlist_items` (modify) — add `catalog_model_id fk null`, `max_price numeric`, `currency`, `notify bool`. Stretch: nightly job matches new listings → notification.

### 2.11 `listing_favorites` (new) `(user_id, listing_id) pk` · `item_favorites` folded into `collection_items.is_favorite` (own items only).

### 2.12 `follows` (new, schema only in H1) `(follower_id, followee_id) pk, created_at`; policies owner insert/delete, public read count.

### 2.13 `token_packs` (new, reference) `id, sku text unique, tokens int, price_amount numeric, price_currency char(3), stripe_price_id text, active bool, sort_order`. Seed: `pack_small` (e.g. 50 tokens), `pack_large` (e.g. 150 tokens) — prices TBD by you/Varun.

### 2.14 `token_ledger` (new, append-only)
`id, user_id fk, delta int (±), balance_after int, reason enum purchase/spend_listing_slot/spend_scan_pack/spend_pro_30d/refund/admin_adjust/promo, ref_type text, ref_id uuid, idempotency_key text unique, created_at`
Trigger recomputes `profiles.tokens`. No update/delete policies at all (even admin uses `admin_adjust` rows). Spend happens via `rpc spend_tokens(reason, cost, ref)` SECURITY DEFINER that checks balance atomically.

### 2.15 `token_purchases` (new) `id, user_id, pack_id, provider enum stripe/razorpay, provider_session_id unique, provider_event_id unique, amount, currency, status enum created/paid/failed/refunded, ledger_id fk, created_at, paid_at`.

### 2.16 `entitlement_grants` (new) `id, user_id, kind enum listing_slot/scan_pack/pro_30d, quantity int, expires_at, ledger_id fk`. `entitlement_listing_slots(uid)` and `entitlement_scan_quota(uid)` are SQL functions summing base plan + unexpired grants.

### 2.17 `ai_scan_jobs` (new)
`id, user_id, kind enum single/group/visual_search, media_id fk, status enum queued/running/done/failed, candidates jsonb, accepted_count int, model text, input_tokens int, output_tokens int, cost_usd numeric(8,5), latency_ms int, error text, created_at`
Feeds quota (count of `done` jobs this period), cost dashboard, and the scan-accuracy metric (accepted_count vs candidates).

### 2.18 `achievements` (reference) `key pk, name, description, rule jsonb, icon, sort_order` seeded with Varun's five: `first_add`, `growing_garage` (25 items), `treasure_hunter` (rarity ≠ common ≥ 5), `deal_maker` (first completed deal), `value_collector` (collection value ≥ threshold). `user_achievements(user_id, achievement_key, progress int, unlocked_at)`. `xp_rules` live in code (`domain/gamification/rules.ts`), levels/tiers as a static table in code.

### 2.19 `reports` (modify) add `resolved_by`, `resolved_at`, `resolution_note`; admin read/update policy. `blocks` (new) `(blocker_id, blocked_id) pk` — enforced in offers/messages/visibility queries.

### 2.20 `notifications` (new) `id, user_id, type enum offer_received/offer_accepted/offer_declined/message/listing_sold/review_received/badge_unlocked/wishlist_match/system, payload jsonb, read_at, created_at`. Written by event consumers. Realtime enabled.

### 2.21 `domain_events` (new, append-only) — ADR-07
`id bigint identity, actor_id uuid null, type text, entity text, entity_id uuid, payload jsonb, occurred_at timestamptz default now()`. Insert-only for authenticated (own actor_id) and service role; read admin only. Partition by month from day one (`occurred_at`), cheap now, saves pain later.

### 2.22 `feature_flags` (new) `key text pk, enabled bool, audience jsonb ('{"plans":["pro"],"countries":["AE"],"user_ids":[...],"percent":10}'), description, updated_by, updated_at`. Public read of `key, enabled, audience`; admin write.

### 2.23 `invites` (new, pilot gating) `code text pk, created_by, max_uses int, used_count int, expires_at, cohort text`. Onboarding requires a valid code while flag `invite_only` is on.

## 3. Functions / triggers / jobs

| Name | Type | Purpose |
|---|---|---|
| `set_updated_at()` | trigger on all tables | |
| `is_admin()` | SQL fn | policy helper |
| `entitlement_listing_slots(uid)`, `entitlement_scan_quota(uid)`, `is_pro(uid)` | SQL fn | entitlements, callable from policies/triggers and from the app |
| `enforce_active_listing_limit()` | trigger | 2.6 |
| `check_offer_rate_limit()` | trigger | 2.7 |
| `transition_offer(offer_id, action)` | RPC SECURITY DEFINER | the only way offer status changes; emits events |
| `spend_tokens(reason, cost, ref_type, ref_id, key)` | RPC SECURITY DEFINER | atomic balance check + ledger + grant |
| `recompute_token_balance()` | trigger on ledger | caches `profiles.tokens` |
| `recompute_seller_rating()` | trigger on reviews | |
| `emit_event(...)` | SQL fn | used by RPCs; app-side writer for others |
| `reset_scan_quotas()` | pg_cron monthly | or compute rolling on read — choose rolling (simpler, no job) |
| `expire_listings()`, `expire_offers()` | pg_cron hourly | status transitions + events |
| `wishlist_match()` | pg_cron nightly (stretch) | notifications |

## 4. Migration plan (files)

File names follow the Supabase CLI convention `<YYYYMMDDHHMMSS>_<name>.sql` (required by `db push` and the GitHub integration). The `#` column below is the logical sequence used throughout these docs; e.g. `0001` = `20260927000100_housekeeping.sql`.

| # | File | Sprint |
|---|---|---|
| 0000 | `baseline.sql` (Varun's schema verbatim) | 0 |
| 0001 | `housekeeping.sql` — `updated_at` + trigger on all tables, `deleted_at`, enums replacing text checks, `is_admin()` | 0 |
| 0002 | `identity_v2.sql` — profiles columns, `countries`, `public_profiles` view, `invites`, `follows`, `feature_flags`, `domain_events` | 1 |
| 0003 | `media.sql` — `media` table, private buckets + storage policies, backfill script from `photos jsonb` | 2 |
| 0004 | `garage_v2.sql` — collection_items columns, search vector, indexes; drop `photo/photos` behind view | 2 |
| 0005 | `catalog.sql` — brands/models, `ai_scan_jobs`, quota fns | 3 |
| 0006 | `marketplace_v2.sql` — listings rewrite, `listing_favorites`, wishlist changes, listing limit trigger | 4 |
| 0007 | `deals.sql` — offers, transition RPC, rate limit, reviews changes | 5 |
| 0008 | `messaging_trust.sql` — deal_messages, blocks, reports changes, notifications, Realtime publication | 6 |
| 0009 | `tokens.sql` — packs, ledger, purchases, grants, spend RPC, entitlement fns | 7 |
| 0010 | `gamification.sql` — achievements, user_achievements, xp columns | 8 |
| 0011 | `jobs.sql` — pg_cron schedules | 9 |

## 5. RLS test matrix (run in CI from Sprint 0)

For every table: owner can CRUD own; stranger cannot read private / cannot write; public rows readable when the product says so; admin per policy; anon (no JWT) sees only landing-page data (active listings, public profiles, verified catalogue). Encoded as `supabase/tests/*.sql` (pgTAP) — one file per migration.
