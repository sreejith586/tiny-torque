# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position

- **Sprint:** S4 backend + marketplace browse/detail frontend done and in prod. This session's work was a polish/stabilization pass (not a new S4-0x task): rebrand, splash, Aurora default, OTP cells, tablet/shell fixes, a photo-overflow bug fix, and — at Sreejith's explicit instruction — removing the automated pixel-baseline CI gate (D-056).
- **Production:** LIVE — **`https://tinytorque.hypermaxsolutions.com`** (Vercel `tiny-torque`, branch `main`). Prod DB now at **19 migrations** (S1's 8 + S2–S6's 11, promoted via PR #38 on 2026-10-05). Latest promotion: **PR #44** (main @ `0388168`) — car-detail photo-overflow fix, no new migrations. Smoke confirmed: `/`, `/login` (Aurora + "Tiny Torque"), `/market` all 200. **Prod env vars were found pointed at the STAGING Supabase project until 2026-10-05** (explains an earlier 8-digit-OTP / staging-data-on-prod mystery) — Sreejith corrected the Vercel prod env vars; verified the prod bundle now references the real prod project (`whjq…`) and `/market` is clean of staging's demo data.
- **Supabase:** prod = `whjqwcaoexbytspkaxfh`, staging = `bjhowyyyypeacfkgxwqr` (region ap-south-1). `db-migrate.yml` auto-applies on push to `staging`/`main` (D-050). `scan-photo` Edge Function **just deployed to prod** by Sreejith; `ANTHROPIC_API_KEY` secret **just set** by Sreejith (prod) — **neither independently verified yet**, nor the `ai_scan` flag's prod value (defaults off, D-018). See Next action.
- **Auth:** prod Site URL + redirect URLs fixed; prod Email OTP Length fixed to 6 (was 8, inherited from pointing at staging). A branded Aurora-themed OTP email template exists at `supabase/email-templates/magic-link.html` — **still needs manual paste** into Supabase (Magic Link + Confirm signup, both projects) if not already done. Varun (`varunsudhakar@gmail.com`) signed up successfully on prod after an initial no-email hiccup (likely rate-limit on Supabase's default mailer) — his `profiles` row/onboarding completion is **not yet independently verified** (see Next action).
- **Next action:** (1) Confirm on prod: `ai_scan` flag value, `ANTHROPIC_API_KEY` present (`supabase secrets list --project-ref whjqwcaoexbytspkaxfh`), Varun's `profiles` row + `onboarding_completed_at`. A throwaway `verify-prod-user.yml` workflow (push-triggered on `sprint-1`, read-only) was added for this but kept getting stuck/cancelled behind a GitHub Actions platform incident (status.github.com: "Partially Degraded Service") — re-run it or just check the Supabase dashboard directly, then **delete the workflow file** (it's temporary). (2) Resume S4 frontend backlog: S4-03 publish sheet, S4-06 wishlist/favourites, S4-07 my-listings (all match `garage-log-147`).
- **Local frontend verification:** `pnpm build` then `NEXT_PUBLIC_SUPABASE_URL=https://bjhowyyyypeacfkgxwqr.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NODE_ENV=production ./node_modules/.bin/next start -p 3126` → Browser pane. Browser pane's localhost tunnel was unreliable this session (worked intermittently); CI-rendered output or direct `node -e 'fetch(...)'` checks against live URLs are the fallback that worked reliably all session.
- **No automated visual-regression suite anymore (D-056):** pixel baselines, `visual-local.spec.ts`, and the CI job that ran them were removed at Sreejith's request — it was a recurring source of delay (Vercel preview lag, then a local-server cold-start race) without catching real drift. **Check new UI against `garage-log-147.html` / `fd3b02d` by eye now**, not CI. Functional smoke (`smoke.spec.ts`, `onboarding.spec.ts`) still runs on every preview deploy.
- **Parked:** marketplace_v2 release-2 destructive drop (D-006, two-release rule); D-024 pricing numbers (scan quota, listing slots) are placeholders; Varun's ~200-casting CSV + 20-photo scan fixture set (S3-01/S3-08); product fork (S3-05); login-gated verification sweep (CSV import, publish→anon-browse).

## S0/S1 — COMPLETE, prod since 2026-10-01. S2/S3 backend — COMPLETE, prod since 2026-10-05 (PR #38). Details in git + 05-sprint-plan.md.

## S4 — Marketplace (dark behind `marketplace_publish`)

- **Backend done** (#28): migration 0006 marketplace_v2 (publish/browse/wishlist/favourites, listing-limit trigger, `seller_mobile` PII column-locked; pgTAP 0008).
- **Frontend done**: S4-04 `/market` browse + S4-05 listing detail, built onto `garage-log-147`'s design (`Market.module.css`), responsive (tablet 3-col, desktop centered shell + side-rail nav D-052/D-053). In prod.
- **Still open**: S4-03 publish sheet, S4-06 wishlist/favourites UI, S4-07 my-listings, Playwright critical-flow coverage.

## S5 (offers/deals) + S6 (messaging/trust) — backend COMPLETE, dark (`offers`/`deal_chat` flags off). UI (S5-03/04/05, S6-02…07) not started. Details in git/PRs #29–#32.

## Release procedure (every sprint end, D-035/D-039/D-040)

1. PR `sprint-N → staging` (merge commit) → Vercel staging deploy → smoke.
2. PR `staging → main` (merge commit) → Vercel production deploy.
3. `db-migrate.yml` auto-applies new migrations to the target (D-050) — verify via `supabase migration list` if in doubt.
4. Prod smoke; record version + date here.

## Blockers / open questions

- **PGRST205 saga (2026-09-29/30) — fully resolved**, see D-046…D-051 in DECISIONS.md for the full history (migrations never auto-applied because the Supabase GitHub integration wasn't connected; fixed by `db-migrate.yml`). Not re-summarized here.
- D-005 region: confirm the Supabase project is `ap-south-1` (dashboard → Project Settings → General) — never explicitly confirmed, now costly to move if wrong.
- D-024 token/listing-slot pricing (S7) · D-025 India SMS route (phone OTP, D-037) · D-026 media timing (S2, resolved by now — reconfirm if touched).
- Varun: starter catalogue CSV (~200 castings), 20-photo scan-accuracy fixture set — still pending from him.
- `follows` RLS grants full public SELECT on raw pairs; spec (03 §2.12) says "public read **count**" — open, dormant until any UI reads `follows`.
- **GitHub Actions had an active platform incident this session** (status.github.com "Partially Degraded Service") — if CI runs are stuck `queued` for an unusually long time at the start of the next session, check status.github.com before assuming it's a repo-side problem.
- Stray untracked `.claude/worktrees/agent-*` directory noticed in the working tree (not committed, pollutes `pnpm lint` scope if run un-scoped) — safe to `rm -rf` locally, not a repo issue.

## Decisions made this sprint

D-029…D-051: see DECISIONS.md (prototype fidelity D-041/044/045, PGRST205 saga D-046…051). This session added:

- **D-052:** app shell centers/widens at ≥700px (`layout.module.css`, not globals.css).
- **D-053:** desktop left side-rail nav at ≥1440px + `hover:hover`/`pointer:fine`.
- **D-054:** Aurora Glass is the default theme everywhere (was workshop-light).
- **D-055:** demo marketplace seed for staging only (`seed-demo.sql` + `seed-demo.yml`), never prod.
- **D-056:** dropped the automated pixel-baseline CI gate — Sreejith: "lose it... no need of this stringent strict checks." Fidelity to Varun's prototype now enforced by direct review, not pixel-diff.

No further decisions were made beyond D-052–D-056 (all already recorded above) as of this hand-off.

## Carry-over register

- none

## Session log (last 5 sessions only — trim older)

| Date       | Task(s)                                               | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | PR                                                                                                                  |
| ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | S4-05 listing detail + full polish pass (D-052…D-056) | Shipped S4-05 + garage-log-147 design match; centered shell + side-rail nav; S2–S6 promoted to prod (PR #38, 19 migrations). Then: Tiny Torque rebrand, splash screen, Aurora default everywhere, segmented OTP cells, Aurora OTP email, tablet-login fix, friendly scan error, dropped the pixel-baseline CI gate (D-056), fixed a car-detail photo-overflow bug. Diagnosed + fixed prod pointing at the staging Supabase project (OTP-length/staging-data symptoms). `scan-photo` deployed + `ANTHROPIC_API_KEY` set on prod by Sreejith (unverified). Promoted to prod repeatedly (PRs #39–#44). | [#39](https://github.com/sreejith586/tiny-torque/pull/39)–[#44](https://github.com/sreejith586/tiny-torque/pull/44) |
| 2026-10-01 | S4-01/02 marketplace foundation (autonomous)          | Migration 0006 marketplace_v2 (additive, `seller_mobile` PII locked; pgTAP 0008) + domain/marketplace (publish/browse/wishlist/favourites; 87 Vitest).                                                                                                                                                                                                                                                                                                                                                                                                                                              | sprint-1                                                                                                            |
| 2026-10-01 | S3 autonomous batch (S3-01/02/03/06/07)               | Catalogue mig 0005 + ai_scan_jobs + scan-quota fn, ai-scan v2 Edge Function, mig 0007 trigram match; domain/catalog+ai, Paywall, admin.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | [#27](https://github.com/sreejith586/tiny-torque/pull/27)                                                           |
| 2026-09-30 | MV-S1-08/09                                           | Settings export/delete (F-14); onboarding Playwright spec (phone flow, gated).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [#21](https://github.com/sreejith586/tiny-torque/pull/21)                                                           |
| 2026-09-30 | MV-S1-07 PGRST205 fixed on staging + prod (D-048…051) | Root cause: migrations never auto-applied (Supabase GitHub integration not connected). `db-migrate.yml` added; S1 promoted to prod.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [#20](https://github.com/sreejith586/tiny-torque/pull/20)                                                           |
