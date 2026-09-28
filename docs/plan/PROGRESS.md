# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position

- **Sprint:** S1 — Identity, multi-country, platform primitives. Not yet locked (lock = first S1 session).
- **Production:** LIVE — `https://tiny-torque-git-main-tiny-torque.vercel.app` (Vercel project `tiny-torque`, branch `main`). First deploy 2026-09-28; email-OTP sign-in → onboarding → garage → add car verified by Sreejith.
- **Supabase:** project `bjhowyyyypeacfkgxwqr` (Branching on; persistent branches `main`, `staging`). Migrations applied to `main`: 20260927000000 baseline, 20260927000100 housekeeping, 20260928000000 grants. `20260928000100_identity_v2.sql` is written and committed on `sprint-1` but **not yet applied anywhere** — no Docker/psql/Supabase CLI in this sandbox to run it; the Supabase Branching preview on the PR (or a manual `db push`) is the first real application. Edge Function `scan-photo` deployed with `ANTHROPIC_API_KEY`.
- **Auth:** email OTP via Resend SMTP (`hello@tinytorque.hypermaxsolutions.com`); templates "Confirm signup" + "Magic Link" carry `{{ .Token }}`; Site URL = prod URL; redirect URLs for main/staging/previews/localhost. Phone OTP: later (D-037).
- **Active task:** MV-S1-01 — Migration 0002 identity_v2, code done on `sprint-1`, [PR #15](https://github.com/sreejith586/tiny-torque/pull/15) open into `staging`.
- **Last session:** 2026-09-28 — MV-S1-01 written: `identity_v2.sql` (countries, profiles columns, public_profiles view, invites, follows, feature_flags, domain_events), hand-updated `src/types/supabase.ts` (no CLI to regen for real), stopgap `provisionalHandle()` + fixture update to keep the build green. D-042 recorded (onboarding wizard reference supersedes D-041's single-page clause for that screen).
- **Next action:** open PR `[MV-S1-01] Migration 0002 identity_v2` from `sprint-1` → `staging`; note the D-012 guard failure (fix is MV-S1-03) and the pending real `pnpm gen:types` regen in the PR description. Once merged/applied, `git checkout main && git pull` and confirm `supabase migration list` shows 0002, then run `pnpm gen:types:db` for real against it. Then `/task MV-S1-02` (pgTAP RLS tests, depends on this migration).

## S0 closing board

| Task                                      | Status                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| MV-S0-01 … 05, 07 … 11                    | done                                                            |
| MV-S0-06 Environments + first prod deploy | **done** 2026-09-28                                             |
| MV-S1-03 (partial, pulled forward)        | email OTP path shipped; country picker + full E.164 still in S1 |

## S1 task board (lock at first S1 session; rows from 05-sprint-plan.md)

| Task                                               | Status             | Notes                                                                                                                                 |
| -------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| MV-S1-01 Migration 0002 identity_v2                | in-review (PR #15) | file `20260928000100_identity_v2.sql` (D-036); guard D-012 fails CI on login's hardcoded `+91` until MV-S1-03 — expected, noted in PR |
| MV-S1-02 pgTAP RLS tests for identity tables       | todo               | pgTAP needs `supabase start`/Docker or a pgTAP-enabled Postgres in CI — decide in-task                                                |
| MV-S1-03 Login v2: country picker, phone/email OTP | todo               | email path done; remove `COUNTRY_CODE='+91'`, add picker                                                                              |
| MV-S1-04 Onboarding v2                             | todo               |                                                                                                                                       |
| MV-S1-05 domain/identity service                   | todo               |                                                                                                                                       |
| MV-S1-06 domain/events + flags + admin shell       | todo               |                                                                                                                                       |
| MV-S1-07 Public profile v1 /u/[handle]             | todo               |                                                                                                                                       |
| MV-S1-08 Settings: export + delete stub            | todo               |                                                                                                                                       |
| MV-S1-09 Playwright sign-in → onboarding → profile | todo               | use email test path or Supabase test OTP on branches                                                                                  |

Status vocabulary: `todo` · `in-progress (branch)` · `in-review (PR #)` · `done` · `blocked (why)` · `carried → Sn`.

## Release procedure (every sprint end, D-035/D-039/D-040)

1. PR `sprint-N → staging` (merge commit) → Vercel staging deploy → smoke.
2. PR `staging → main` (merge commit) → Vercel production deploy.
3. `git checkout main && git pull && pnpm exec supabase db push` → `pnpm exec supabase migration list` shows parity.
4. Prod smoke; record version + date here.

## Blockers / open questions

- D-005 region: confirm the project is `ap-south-1` (dashboard → Project Settings → General). If not, it is now costly to move — decide consciously.
- D-024 token pricing (S7) · D-025 India SMS route (when phone OTP is scheduled) · D-026 media timing (S2).
- Varun: starter catalogue CSV (~200 castings) by S3; tier names for F-13; 20-photo scan fixture set by S3.
- Vercel Deployment Protection: CI e2e needs `VERCEL_AUTOMATION_BYPASS_SECRET` (GitHub Actions secret) — generate under Vercel → Settings → Deployment Protection → Protection Bypass for Automation. Without it, previews bounce to vercel.com/login and the e2e job fails.
- Staging Supabase branch: verify it has the three migrations (open the staging deployment and sign in); if not, `supabase db push --db-url <staging branch url>` once.
- **PII exposure (rule 15) found in baseline, not fixed in MV-S1-01:** `marketplace_listings.seller_mobile` is denormalized onto listings and readable by anyone via the "Active listings are publicly readable" policy (status='active', including anon). Predates this sprint; belongs to the `marketplace_v2` migration (0006, S4). Flagging now so it isn't lost.
- MV-S1-01's `public_profiles` view (03 §2.1) omits `avatar`/`banner`/`rating_avg`/`rating_count` — those source columns don't exist until the media (S2) and reviews-aggregate migrations land; view will be extended via `create or replace view` then.

## Decisions made this sprint

- D-029…D-041 (see DECISIONS.md). D-041 = prototype fidelity enforced mechanically: 74 pixel baselines in `e2e/__screenshots__` (landing, login email/phone, market, garage grid/list, car detail, add car ± more details, scan, profile, offers × 6 themes + 2 desktop; signed-in screens via the `?__visual=1` fixture harness), guard.sh UI-library/primitives checks, F-01 onboarding corrected back to the prototype's single form; S1-03/04/07/08 rows reworded to name the prototype pieces they reuse.
- **D-042 (supersedes D-041's onboarding clause only):** onboarding (F-01) now references `garage-log-147.html`'s 5-step wizard (account type → name → location → photo(optional) → phone/OTP, progress bar, back button) instead of the single-page form, for MV-S1-04. Rest of D-041 (pixel baselines, banned UI libs, `fd3b02d` for every other screen) unchanged.
- **Handover parity proof (2026-09-28, `scripts/visual-compare-handover.mjs`, current build vs `fd3b02d` build, 390 px, 6 themes):** landing, market, add car, add car + more details, scan = **0 px difference** in every theme (bottom bar, emoji icons, active tabs, headers, buttons, inputs). Login differs only by the spec'd "Use email instead" button (D-037). Garage/car detail/profile use components with no visual diff vs handover (`git diff fd3b02d -- src/components`).

## Carry-over register

- none

## Session log (last 5 sessions only — trim older)

| Date          | Task(s)                                 | Outcome                                                                                                                                                              | PR                 |
| ------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-09-27    | Planning                                | Plan v1 + decision log + progress file created                                                                                                                       | —                  |
| 2026-09-27    | S0-01…05, 07…11 (cloud)                 | 9 commits on `sprint-0`; all checks green                                                                                                                            | #1                 |
| 2026-09-27/28 | S0-06 + post-deploy fixes               | Production live; migrations, auth, grants, CI all green                                                                                                              | #1–#7+             |
| 2026-09-28    | S0-07 e2e bypass + D-041 fidelity guard | Vercel bypass header; visual baselines + guard rules; F-01/S1 rows corrected                                                                                         | sprint-0           |
| 2026-09-28    | S1-01 identity_v2 migration + D-042     | Migration written (countries/profiles/public_profiles/invites/follows/feature_flags/domain_events); types hand-updated; build green except expected D-012 guard fail | sprint-1 (pending) |
