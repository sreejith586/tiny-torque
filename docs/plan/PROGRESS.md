# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position
- **Sprint:** S0 — Foundation. Locked 2026-09-27 (Sreejith: "initiate the first sprint on cloud").
- **Branch:** `sprint-0` (9 commits on top of `main` baseline `fd3b02d`). `main` untouched — Sreejith reviews and merges.
- **Production:** not yet deployed. Blocked on MV-S0-06 (needs Sreejith's Supabase/Vercel logins + D-005 region confirmation).
- **Active task:** none — S0-06 is the only open S0 task.
- **Last session:** 2026-09-27 (cloud, unattended). Built S0-01…S0-05, S0-07…S0-11. Build, lint, typecheck, 6 unit tests, 18 Playwright smoke tests, decision guard: all green.
- **Next action (Sreejith, ~1 h):** run the S0-06 checklist below, then push `sprint-0`, open the PR, merge to `main`, deploy. Then lock S1.

## Sprint task board (current sprint only)
| Task | Status | Notes |
|---|---|---|
| MV-S0-01 Repo hygiene & tooling | done | pnpm, husky pre-commit (lint-staged) + pre-push (typecheck, test, guard), PR template |
| MV-S0-02 Upgrade Next.js 16.3 / React 19 | done | proxy.ts, async APIs, ESLint 9 flat config, self-hosted fonts (D-030) |
| MV-S0-03 Tailwind 4 + shadcn + theme tokens | done | no preflight (D-031); ThemeStyles + boot script; no shadcn components yet |
| MV-S0-04 Supabase CLI + baseline migrations | done | 0000 baseline, 0001 housekeeping; validated on Postgres 16 (D-032) |
| MV-S0-05 Generated types + domain skeleton | done | domain/{identity,garage,ai}; api.ts removed; ESLint boundary; 6 Vitest tests |
| MV-S0-06 Environments (Mumbai) + Vercel + first prod deploy | **blocked (Sreejith)** | see checklist below |
| MV-S0-07 CI + Playwright scaffold | done | ci.yml (checks, migrations, e2e); 18 smoke tests |
| MV-S0-08 Sentry + PostHog + Analytics | done | wrappers no-op until DSN/keys set in Vercel |
| MV-S0-09 Fix inherited defects | done | root middleware never ran → src/proxy.ts; storage prefix policy; PATCH profile |
| MV-S0-10 Plan docs + CLAUDE.md + regression checklist | done | CLAUDE.md at root; Phase-1 regression run locally (landing, login, guards, themes) — sign-in flows need a real Supabase project (S0-06) |
| MV-S0-11 Decision guard in CI + session protocol | done | guard.sh in CI + pre-push; D-012 check gated on migration 0002 |

Status vocabulary: `todo` · `in-progress (branch)` · `in-review (PR #)` · `done` · `blocked (why)` · `carried → Sn`.

## MV-S0-06 checklist (Sreejith, needs your accounts)
1. Confirm D-005 (region `ap-south-1`). If not Mumbai, change the row in DECISIONS.md with a superseding row first.
2. Supabase: create `mini-vault-staging` and `mini-vault-prod` (Pro plan on prod) in the chosen region. Enable Phone provider (Twilio) — or leave for S1 and use a Supabase **test phone number** now (Auth → Phone → Test OTPs) so sign-in works before Twilio.
3. Apply migrations: `pnpm exec supabase link --project-ref <ref>` then `pnpm exec supabase db push` (staging first, then prod).
4. Deploy Edge Function: `pnpm exec supabase functions deploy scan-photo` + `secrets set ANTHROPIC_API_KEY=…` (both projects).
5. GitHub: create the repo, `git remote add origin …`, `git push -u origin main sprint-0`; open PR `sprint-0 → main`; set repo secrets `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `E2E_TEST_PHONE`, `E2E_TEST_OTP`.
6. Vercel: import repo, Functions region `bom1`, env vars from `.env.example` per environment (`NEXT_PUBLIC_APP_ENV` = preview / staging / production), `staging` branch → staging env. Sentry DSN + PostHog key when you have them (optional for first deploy).
7. Merge the PR, promote to production, run prod smoke: `/` → login → test-number OTP → onboarding → add a car with a photo → scan page loads. Record the prod URL + date here.

## Blockers / open questions
- D-005 region · D-024 token pricing · D-025 India SMS route · D-026 media timing — all `proposed`, Sreejith to confirm.
- Varun: starter catalogue CSV (~200 castings) by S3; tier names for F-13; 20-photo scan fixture set by S3.
- Shared Claude chat link was unreadable — verbal decisions from Varun's design chat may be missing from `04`.

## Decisions made this sprint
- D-029 model policy (Fable → Sonnet 5 on limit; cloud sessions on sprint branches), D-030 self-hosted fonts, D-031 Tailwind without preflight, D-032 no-Docker migration validation path.

## Carry-over register
- MV-S0-06 → completes S0 once Sreejith runs the checklist (not carried to S1; S1 tasks don't depend on it except S1-03 Twilio config and S1-09 e2e sign-in).

## Session log (last 5 sessions only — trim older)
| Date | Task(s) | Outcome | PR |
|---|---|---|---|
| 2026-09-27 | Planning | Plan v1 + decision log + progress file created | — |
| 2026-09-27 | S0-01…05, 07…11 (cloud) | 9 commits on `sprint-0`; all checks green; S0-06 blocked on accounts | to open |
