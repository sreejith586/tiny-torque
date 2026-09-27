# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position
- **Sprint:** S1 — Identity, multi-country, platform primitives. Not yet locked (lock = first S1 session).
- **Production:** LIVE — `https://tiny-torque-git-main-tiny-torque.vercel.app` (Vercel project `tiny-torque`, branch `main`). First deploy 2026-09-28; email-OTP sign-in → onboarding → garage → add car verified by Sreejith.
- **Supabase:** project `bjhowyyyypeacfkgxwqr` (Branching on; persistent branches `main`, `staging`). Migrations applied: 20260927000000 baseline, 20260927000100 housekeeping, 20260928000000 grants. Edge Function `scan-photo` deployed with `ANTHROPIC_API_KEY`.
- **Auth:** email OTP via Resend SMTP (`hello@tinytorque.hypermaxsolutions.com`); templates "Confirm signup" + "Magic Link" carry `{{ .Token }}`; Site URL = prod URL; redirect URLs for main/staging/previews/localhost. Phone OTP: later (D-037).
- **Active task:** none.
- **Last session:** 2026-09-27/28 — S0 completed end to end. Fixes after first deploy: CI Node 22 + sslmode, build without env at prerender, migration file naming (D-036), Vercel framework preset, prod env vars, table grants (42501), email templates/site URL, promotion via PR (D-039), db push from main (D-040).
- **Next action:** start S1 in a cloud Claude Code session — "Work on MV-S1-01. Follow CLAUDE.md." Branch `sprint-1` from `staging`.

## S0 closing board
| Task | Status |
|---|---|
| MV-S0-01 … 05, 07 … 11 | done |
| MV-S0-06 Environments + first prod deploy | **done** 2026-09-28 |
| MV-S1-03 (partial, pulled forward) | email OTP path shipped; country picker + full E.164 still in S1 |

## S1 task board (lock at first S1 session; rows from 05-sprint-plan.md)
| Task | Status | Notes |
|---|---|---|
| MV-S1-01 Migration 0002 identity_v2 | todo | file name `2026MMDDHHMMSS_identity_v2.sql` (D-036); guard D-012 activates once it exists |
| MV-S1-02 pgTAP RLS tests for identity tables | todo | pgTAP needs `supabase start`/Docker or a pgTAP-enabled Postgres in CI — decide in-task |
| MV-S1-03 Login v2: country picker, phone/email OTP | todo | email path done; remove `COUNTRY_CODE='+91'`, add picker |
| MV-S1-04 Onboarding v2 | todo | |
| MV-S1-05 domain/identity service | todo | |
| MV-S1-06 domain/events + flags + admin shell | todo | |
| MV-S1-07 Public profile v1 /u/[handle] | todo | |
| MV-S1-08 Settings: export + delete stub | todo | |
| MV-S1-09 Playwright sign-in → onboarding → profile | todo | use email test path or Supabase test OTP on branches |

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
- Staging Supabase branch: verify it has the three migrations (open the staging deployment and sign in); if not, `supabase db push --db-url <staging branch url>` once.

## Decisions made this sprint
- D-029…D-040 (see DECISIONS.md).

## Carry-over register
- none

## Session log (last 5 sessions only — trim older)
| Date | Task(s) | Outcome | PR |
|---|---|---|---|
| 2026-09-27 | Planning | Plan v1 + decision log + progress file created | — |
| 2026-09-27 | S0-01…05, 07…11 (cloud) | 9 commits on `sprint-0`; all checks green | #1 |
| 2026-09-27/28 | S0-06 + post-deploy fixes | Production live; migrations, auth, grants, CI all green | #1–#7+ |
