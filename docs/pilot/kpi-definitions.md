# Pilot KPIs — definitions (MV-S10-03, F-18)

Every pilot success criterion (`01-vision-and-pilot-scope.md` §6) with its exact SQL definition and the PostHog insight to build next to it. **SQL is the source of truth**; PostHog is for funnels, drop-off and slicing.

## 1. Where the numbers come from

- **`pilot_kpis_weekly`** — materialised view, one row per UTC week (Monday start), last 52 weeks. Rebuilt nightly (pg_cron `pilot_kpis_refresh`, 04:10 UTC) and by **Refresh now** on `/admin/kpis`; each rebuild is a `job_runs` row (`refresh_pilot_kpis`). Not readable through the API — admins read it with `admin_pilot_kpis(n)`.
- **`/admin/kpis`** — the ratios per week with their targets, then the raw counts.
- **`/admin`** — current totals and this month's scan cost, token revenue and SMS estimate (`admin_overview()`).
- **PostHog** — until S10 it received page views only. Now each signed-in collector is identified (`user_id`, `country_code`, `plan`, `account_type`; never name, handle or phone) and their own KPI events are mirrored from the event log by `claim_analytics_events()`: event name = the domain event type, properties `event_id`, `occurred_at`, `mirrored: true`. Each event is handed out once across devices; delivery is at-most-once (an event claimed by a tab that closes before sending is lost), which is why SQL stays the truth.

Mirrored events: `user.onboarded`, `user.opened`, `invite.redeemed`, `item.created`, `scan.requested`, `scan.completed`, `scan.accepted`, `import.completed`, `listing.published`, `listing.sold`, `offer.created`, `offer.accepted`, `offer.completed`, `review.created`, `tokens.purchased`, `tokens.spent`, `pro.activated`, `report.created`, `feedback.created`.

Use `occurred_at` (not PostHog's receive time) when an insight needs the real time of the action: events are forwarded on the collector's next page load, up to 7 days late on a first visit.

## 2. The ten metrics

| #   | Metric (target)                                                        | SQL — columns of `pilot_kpis_weekly`                                                                                                   | PostHog insight                                                                                                        |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | **Activation** — sign-ups with ≥ 5 garage items within 7 days (≥ 60 %) | `activated_7d / signups` (cohort: counted in the sign-up week)                                                                         | Funnel: `user.onboarded` → `item.created` ×5 (use "performed event at least 5 times" as a cohort, window 7 days)       |
| 2   | **AI scan usage** — share of items added via scan (≥ 40 %)             | `scan_accepted / items_added` (`scan_accepted` = Σ `ai_scan_jobs.accepted_count`)                                                      | Trend: `scan.accepted` ÷ `item.created`, weekly                                                                        |
| 3   | **Scan accuracy** — candidates accepted without edits (≥ 60 %)         | `scan_accepted / scan_candidates` — **a proxy**: accepted ÷ returned candidates. "Without edits" is not recorded anywhere yet (see §4) | Funnel: `scan.completed` → `scan.accepted`                                                                             |
| 4   | **Marketplace supply** — users who publish ≥ 1 listing (≥ 35 %)        | `signups_published / signups` (cohort)                                                                                                 | Funnel: `user.onboarded` → `listing.published`, window 30 days                                                         |
| 5   | **Deal flow** — offers per active listing per month (≥ 0.5)            | `offers_created / listings_live` per week; sum four weeks of `offers_created` over the average `listings_live` for the monthly figure  | Trend: `offer.created`, weekly                                                                                         |
| 6   | **Completed deals** — marked sold + review (≥ 15 in pilot)             | Σ `deals_reviewed` over the pilot (`deals_completed` is the looser count)                                                              | Funnel: `offer.created` → `offer.accepted` → `offer.completed` → `review.created`                                      |
| 7   | **Token purchase conversion** — WAU who buy ≥ 1 pack (≥ 8 %)           | `token_buyers / wau`; revenue in `token_revenue` (per currency, never summed across)                                                   | Funnel: `$pageview` where path = `/tokens` → `tokens.purchased`; break down by `country_code` (India card risk, 01 §8) |
| 8   | **Weekly retention W4** (≥ 40 %)                                       | `retained_w4 / signups` (cohort; any event in days 22–28 after sign-up; readable four weeks after the cohort week)                     | Retention insight: first `user.onboarded`, returning `user.opened`, weekly                                             |
| 9   | **Reports needing action** (< 2 % of listings)                         | `reports_actioned / listings_live` (`reports_actioned` = reports closed as `reviewed`)                                                 | Trend: `report.created`                                                                                                |
| 10  | **Reliability** — p95 page load < 2.5 s on 4G; error rate < 0.5 %      | not in SQL                                                                                                                             | Vercel Speed Insights (p95 LCP, mobile) · Sentry (crash-free sessions; errors ÷ page views) · PostHog web vitals       |

`wau` = distinct `actor_id` in `domain_events` that week (the app writes `user.opened` once a day per active collector, so opening the app counts).

`listings_live` is an approximation: a listing counts from `created_at` until it sold, was removed or expired (`updated_at` of that status), or was trashed.

## 3. PostHog set-up (owner, in the PostHog UI — one project per environment)

1. Check events arrive: Activity › filter `mirrored = true`.
2. Create the insights in the table above; put them on one dashboard "Pilot KPIs".
3. Add two cohorts: "Shops" (`account_type = shop`) and one per country; use them as breakdowns.
4. Invite cohorts (`uae-collectors`, `india-shops`, …) are in `invite_redemptions` (one row per collector, since S11) and on `/admin/invites`, not in PostHog — split by cohort in SQL:

   ```sql
   select cohort, count(*) as collectors from invite_redemptions group by 1 order by 2 desc;
   ```

## 4. Gaps, stated plainly

- **Scan accuracy "without edits"** needs the scan review screen to record whether a candidate was edited before saving. Until then metric 3 is "accepted ÷ proposed".
- **SMS cost** is an estimate (phone-active collectors × 2 codes × USD 0.05); the provider and its price are still open (D-025).
- **Money events** are mirrored from the browser like the rest; a server-side capture from the Stripe webhook would be exact but needs the PostHog key in the Edge Function. The ledger (`token_purchases`) is exact regardless.
- **Sign-ups** count profiles created, including founders and test accounts — exclude them by cohort when reporting.
