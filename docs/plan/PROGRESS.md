# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position
- **Sprint:** S0 — Foundation (not started). Sprint lock date: _TBD_
- **Production:** not yet deployed (target: end of S0). Prod version / last deploy: —
- **Active task:** none
- **Last session:** 2026-09-27 — planning only. Plan v1 written to `docs/plan/`, decision log seeded (D-001…D-028). No code changed.
- **Next action:** Sreejith confirms D-005 (region), D-024 (pricing), D-025 (SMS route), D-026 (media timing); then lock S0 and start MV-S0-01.

## Sprint task board (current sprint only)
| Task | Status | Notes |
|---|---|---|
| MV-S0-01 Repo hygiene & tooling | todo | |
| MV-S0-02 Upgrade Next.js 16.x / React 19 | todo | |
| MV-S0-03 Tailwind 4 + shadcn + theme tokens | todo | D-027: tokens must equal `theme.ts` values exactly |
| MV-S0-04 Supabase CLI + baseline migrations | todo | |
| MV-S0-05 Generated types + domain skeleton | todo | |
| MV-S0-06 Environments (Mumbai) + Vercel + first prod deploy | todo | blocked by D-005 confirmation |
| MV-S0-07 CI + Playwright scaffold | todo | |
| MV-S0-08 Sentry + PostHog + Analytics | todo | |
| MV-S0-09 Fix inherited defects | todo | |
| MV-S0-10 Plan docs + CLAUDE.md + regression checklist | todo | |
| MV-S0-11 Decision guard in CI + session protocol | todo | D-023 |

Status vocabulary: `todo` · `in-progress (branch)` · `in-review (PR #)` · `done` · `blocked (why)` · `carried → Sn`.

## Blockers / open questions
- D-005 region confirmation (irreversible-ish).
- D-024 token pricing (needed by S7; Stripe application should start now).
- D-025 India SMS route (start paperwork S1).
- Varun: starter catalogue CSV (~200 castings) by S3; tier names for F-13; 20-photo scan fixture set by S3.
- Shared Claude chat link was unreadable — verbal decisions from Varun's design chat may be missing from `04`.

## Decisions made this sprint (mirror of new DECISIONS.md rows)
- none yet (planning rows D-001…D-028 seeded 2026-09-27)

## Carry-over register
- none

## Session log (last 5 sessions only — trim older)
| Date | Task(s) | Outcome | PR |
|---|---|---|---|
| 2026-09-27 | Planning | Plan v1 + decision log + progress file created | — |
