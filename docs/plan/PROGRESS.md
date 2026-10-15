# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position

- **Sprint:** S5 (offers/deals) and S6 (messaging/trust, MV-S6-01…03/05/06/07/08; S6-04 clean-language validator explicitly deferred) are both **complete and promoted to `main`/prod** ([PR #80](https://github.com/sreejith586/tiny-torque/pull/80)). The stacked-PR merge gap noted in the previous hand-off (PRs #75–#78 showing "Merged" on GitHub but not actually reaching `staging`) was fixed by [PR #79](https://github.com/sreejith586/tiny-torque/pull/79) before promoting. Next up: S1 sprint-plan items not yet covered by the ad-hoc fidelity work (see 05-sprint-plan.md), or whatever Sreejith prioritizes next — currently a full UI pixel-fidelity + motion pass (see below).
- **Production:** LIVE — **`https://tinytorque.hypermaxsolutions.com`**. Last promotion: [PR #80](https://github.com/sreejith586/tiny-torque/pull/80), covering S5+S6 in full.
- **Feature flags on prod** (confirmed via `supabase db query --linked --project-ref whjqwcaoexbytspkaxfh`): `offers` = **true**, `marketplace_publish` = **true**, `deal_chat` = **true** (flipped on by Sreejith after promotion). `pro_purchase`/`token_purchase` = false (unbuilt, correctly dark).
- **Stale S6 branches deleted**: `mv/s6-03-reviews`, `mv/s6-05-report-block`, `mv/s6-07-admin`, `mv/s6-08-deal-chat-smoke` are gone (content is folded into `staging`/`main` via #79/#80). (`mv/s6-06-notifications` and other long-merged branches are separately still present — pre-existing clutter, not from this cleanup.)
- **New task in progress (2026-10-15):** a full UI pixel-fidelity + motion pass against `garage-log-147.html` (D-044/D-045 visual-detail/motion reference), now that `globals.css`/`theme.ts` are unlocked (D-059/D-060). Scope: every _existing_ screen, strictly excluding unbuilt-feature visuals (gamification/XP, ratings UI beyond what's built, chat-assistant widget, promoted listings) per D-044/D-045's no-scope-pull-forward rule. A screen-by-screen discrepancy report was commissioned before writing any code (rule 2: plan first, wait for "go"). See next session's PROGRESS.md update for outcome if this session ends before it ships.
- **⚠️ Supabase CLI gotcha**: this sandbox's local `supabase/.temp/project-ref` is linked to **staging** (`bjhowyyyypeacfkgxwqr`), not prod, regardless of what `supabase projects list` shows as the account's main project. Plain `supabase db query --linked` silently hits staging. **To target prod, always pass `--linked --project-ref whjqwcaoexbytspkaxfh` together**, and verify any prod write against the public PostgREST API directly, not just the CLI's own echo.
- **Switching branches with an existing `.next/` can break `pnpm typecheck`** (Next's typed-routes validator caches the previous branch's route list) — `rm -r .next` (not `-rf`, that pattern is denied) before typechecking after a branch switch if you see a `Cannot find module '.../page.js'` error that isn't yours.
- **A same-branch fix-up commit does NOT clear GitHub's "this PR has a conflict" state**, even when the end content is a clean superset of both sides. The fix is a real two-parent (or, as above, three-way) merge commit via `git commit-tree`, pushed as a plain non-force commit.
- **Supabase:** prod = `whjqwcaoexbytspkaxfh`, staging = `bjhowyyyypeacfkgxwqr` (ap-south-1, Supabase Branching). `db-migrate.yml` auto-applies on push to `staging`/`main` (D-050).
- **No automated visual-regression suite** (D-056) — eyeball new UI against `garage-log-147.html`/`fd3b02d`. Functional smoke (`smoke.spec.ts`, `onboarding.spec.ts`) runs on every preview deploy.
- **Parked (pre-existing):** marketplace_v2 release-2 destructive drop (D-006 two-release rule); D-024 pricing placeholders; Varun's catalogue CSV/scan fixtures; product fork (S3-05); `/login` ignores `?next=` on successful sign-in.

## S0–S4 — COMPLETE, prod since 2026-10-05 (PR #38, 19 migrations). Details in git + 05-sprint-plan.md.

## S5 — Offers/deals — COMPLETE, live on prod, flags on

All of S5-01…08 merged and promoted. `/offers` inbox, listing status UX, route guards, notification consumer all live and exercised with `offers`/`marketplace_publish` now genuinely on.

## S6 (messaging/trust) — COMPLETE in `staging`, not yet promoted, dark behind flags

- **MV-S6-01/02**: `deal_messages`/`blocks` schema, `/deals/[offerId]` thread — live on prod already.
- **MV-S6-03 reviews**: `rating_avg`/`rating_count`, review prompt on completed deals.
- **MV-S6-05 report/block**: `create_report` RPC (10/day limit), blocking hides listings/profile both ways.
- **MV-S6-06 notifications**: `/notifications`, header bell with a realtime unread badge. `message.sent` now emitted by a real DB trigger on `deal_messages` (not a second app-level call — fixed a real non-atomicity bug found via CI).
- **MV-S6-07 admin**: `/admin/reports` queue (dismiss/remove listing/warn/suspend), `/admin/users` (search, suspend/unsuspend). 7-day suspension is a fixed default, not spec'd further.
- **MV-S6-08**: opt-in Playwright chat smoke; "Open thread" link wired into `/offers` (gated on `deal_chat`).
- **MV-S6-04 (clean-language validator)**: explicitly deferred by Sreejith — not built.
- **Next**: open a `staging → main` promotion PR once you're ready to ship S6 dark to prod (same two-PR pattern as every prior sprint-end).

## Release procedure (every sprint end, D-035/D-039/D-040)

1. PR `sprint-N → staging` (merge commit) → Vercel staging deploy → smoke.
2. PR `staging → main` (merge commit) → Vercel production deployment.
3. `db-migrate.yml` auto-applies new migrations to the target (D-050) — verify via the job log.
4. Prod smoke; record version + date here. **Flipping a kill-switch flag is a separate, deliberate step.**

## Blockers / open questions

- D-005 region: confirm the Supabase project is `ap-south-1` — never explicitly confirmed.
- D-024 token/listing-slot pricing (S7) · D-025 India SMS route (phone OTP, D-037).
- Varun: starter catalogue CSV (~200 castings), 20-photo scan-accuracy fixture set — still pending from him.
- `follows` RLS grants full public SELECT on raw pairs; spec (03 §2.12) says "public read **count**" — dormant until any UI reads `follows`.
- MV-S6-04's banned-word list is a deferred decision, not forgotten.

## Decisions made this sprint

See DECISIONS.md, D-029…D-061. No new decision this session.

## Carry-over register

- none

## Session log (last 5 sessions only — trim older)

| Date       | Task(s)                                                                                       | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | PR                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 2026-10-15 | Promoted S5+S6 to prod, flipped `deal_chat`, deleted stale branches, started UI fidelity pass | Merged [#79](https://github.com/sreejith586/tiny-torque/pull/79) (stacked-PR fix) then opened/Sreejith-merged [#80](https://github.com/sreejith586/tiny-torque/pull/80) (`staging → main`) — S5+S6 fully live. Flipped `deal_chat` true on prod (confirmed via CLI with explicit `--project-ref`). Deleted the four folded-in S6 branches. Local git checkout had gone stale (SSH key no longer works in this sandbox; switched `origin` to HTTPS via `gh`'s token to fetch/sync) — worth knowing if a future session's `git status` looks wrong. Then started a new ask: full pixel-fidelity + motion pass against `garage-log-147.html` — commissioned a screen-by-screen discrepancy audit, plan pending before any code. | [#79](https://github.com/sreejith586/tiny-torque/pull/79), [#80](https://github.com/sreejith586/tiny-torque/pull/80) |
| 2026-10-14 | Fixed #76/#77/#78's failing CI (pgTAP, stale types, invalid test UUIDs, an enum cast)         | Four real bugs across three PRs, all caught by CI rather than assumed fixed: #76's `review_received` trigger depended on #74's schema but was built independent of it (fixed by rebasing onto #74); `message.sent` was only emitted by a second app-level call, never atomically with the insert (moved to a DB trigger); #77/#78 had stale generated types (same class of miss as #74 — Postgres sets, `never` vs `number \| null`) and a pgTAP fixture with invalid hex digits in a UUID; `resolve_report`'s status update needed an explicit enum cast. Each fix verified via a live CI re-run, not assumed.                                                                                                              | [#76](https://github.com/sreejith586/tiny-torque/pull/76)–[#78](https://github.com/sreejith586/tiny-torque/pull/78)  |
| 2026-10-13 | S6-03/05/06/07/08 built (reviews, report/block, notifications, admin, chat smoke)             | "Continue the same way, build everything else" (S6-04 explicitly deferred). Built the remaining S6 backlog as a dependency chain of 5 PRs. Retrofitted a rule-9 gap found along the way: S6-03's review insert never emitted a domain_events row — added `review.created` to the existing rating-recompute trigger.                                                                                                                                                                                                                                                                                                                                                                                                          | [#74](https://github.com/sreejith586/tiny-torque/pull/74)–[#78](https://github.com/sreejith586/tiny-torque/pull/78)  |
| 2026-10-13 | Resolved #69/#70/#71 conflicts, promoted S5+S6-02 to prod, flipped flags                      | Fixed all three PRs' conflicts against #68 via two-parent merge commits. Opened + Sreejith merged #72 (`staging → main`). He reported Deals still blank on prod — traced to `offers`/`marketplace_publish` never being turned on. Flipped them, but the first attempt silently hit staging (local CLI link gotcha, see above) — caught via independent verification.                                                                                                                                                                                                                                                                                                                                                         | [#69](https://github.com/sreejith586/tiny-torque/pull/69)–[#72](https://github.com/sreejith586/tiny-torque/pull/72)  |
