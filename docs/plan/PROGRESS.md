# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position
- **Sprint:** S0 — Foundation. Locked 2026-09-27 (Sreejith: "initiate the first sprint on cloud").
- **Branch:** `sprint-0` (9 commits on top of `main` baseline `fd3b02d`). `main` untouched — Sreejith reviews and merges.
- **Production:** not yet deployed. Remote + Vercel done; Supabase project + Branching pending (checklist below).
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

## MV-S0-06 checklist (Sreejith; Branching model, D-033)
Done: GitHub remote `git@github.com:sreejith586/tiny-torque.git`; Vercel project connected (D-034); Supabase project `bjhowyyyypeacfkgxwqr` with Branching enabled and persistent branches `main` + `staging` (D-035). Region: confirm it is `ap-south-1` (D-005) — if not, recreate now while it is empty.
1. Push: `git remote add origin git@github.com:sreejith586/tiny-torque.git && git branch staging main && git push -u origin main staging sprint-0`. Open PR `sprint-0 → staging`. In Vercel, map git branch `staging` to a Preview deployment (default) — the Supabase integration will attach the `staging` Supabase branch keys.
2. ~~Create project~~ done. Confirm plan = Pro before founders' data lands (PITR, no pausing).
3. Supabase → Integrations → **GitHub**: connect `sreejith586/tiny-torque`, supabase directory `supabase`, production branch `main`; enable **Branching**. Decide prod sync: either let the integration apply merged migrations to prod (recommended) or run `db push` yourself — not both.
4. Supabase → Integrations → **Vercel**: link the Vercel project; enable "sync environment variables" for preview branches (this feeds `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` to previews). Set the prod values in Vercel production env manually + `NEXT_PUBLIC_APP_ENV=production`; Functions region `bom1`.
5. Auth on prod: enable Phone provider (Twilio) or, for now, a **test phone number** in the dashboard. Check whether the integration copies `config.toml` `[auth.sms.test_otp]` to prod — if yes, remove it from prod or accept it (fake number).
6. From the repo: `pnpm exec supabase login && pnpm exec supabase link --project-ref bjhowyyyypeacfkgxwqr && pnpm exec supabase db push && pnpm exec supabase functions deploy scan-photo && pnpm exec supabase secrets set ANTHROPIC_API_KEY=…` (skip `db push` if the GitHub integration applies migrations on merge — pick one).
7. Merge the PR into `staging` → staging deploy → smoke there. Then `git checkout main && git merge --ff-only staging && git push` → migrations apply to prod → Vercel production deploys `main` → prod smoke: `/` → login → OTP → onboarding → add car with photo → scan page. Record prod URL + date here.
8. Re-open a trivial PR to verify the loop end-to-end: preview branch created, Vercel preview built with branch keys, e2e job green on `deployment_status`.

## Blockers / open questions
- D-005 region · D-024 token pricing · D-025 India SMS route · D-026 media timing — all `proposed`, Sreejith to confirm.
- Varun: starter catalogue CSV (~200 castings) by S3; tier names for F-13; 20-photo scan fixture set by S3.
- Shared Claude chat link was unreadable — verbal decisions from Varun's design chat may be missing from `04`.

## Decisions made this sprint
- D-029 model policy, D-030 self-hosted fonts, D-031 Tailwind without preflight, D-032 no-Docker validation path, D-033 Supabase Branching instead of staging, D-034 remote + Vercel.

## Carry-over register
- MV-S0-06 → completes S0 once Sreejith runs the checklist (not carried to S1; S1 tasks don't depend on it except S1-03 Twilio config and S1-09 e2e sign-in).

## Session log (last 5 sessions only — trim older)
| Date | Task(s) | Outcome | PR |
|---|---|---|---|
| 2026-09-27 | Planning | Plan v1 + decision log + progress file created | — |
| 2026-09-27 | S0-01…05, 07…11 (cloud) | 9 commits on `sprint-0`; all checks green; S0-06 blocked on accounts | to open |
