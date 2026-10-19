# Mini Vault — Build Plan (H1: platform + pilot)

Prepared 2026-09-27 for Sreejith Sreenivasan (CTO/owner) from Varun's handover. Sprint 0 was executed the same day on branch `sprint-0` (see `PROGRESS.md`).

| File                                    | What it answers                                                                                                                                                                                                                                                    | Read when                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `01-vision-and-pilot-scope.md`          | What are we building, for whom, what's in/out of the pilot, how we know it worked, top risks                                                                                                                                                                       | Before agreeing scope with Varun                                   |
| `02-architecture-blueprint.md`          | As-built audit of the handover, target architecture, 13 ADRs with reversibility, module map, NFRs, what is/isn't baked in for the multiverse                                                                                                                       | Before Sprint 0                                                    |
| `03-data-model.md`                      | Target schema as deltas from Varun's, table by table, functions/triggers, 12 numbered migrations, RLS test matrix                                                                                                                                                  | Before each sprint's migration task                                |
| `04-feature-specs.md`                   | F-01…F-19 rules, acceptance criteria, events, flags; stretch register                                                                                                                                                                                              | While building any feature                                         |
| `05-sprint-plan.md`                     | 12 one-week sprints, 99 tasks with estimates, dependencies, demo line, **what ships to production** and risks per sprint; DoD                                                                                                                                      | Every Monday                                                       |
| `backlog.csv`                           | Same tasks, Jira-importable                                                                                                                                                                                                                                        | Once, to load Jira                                                 |
| `06-engineering-standards.md`           | The development contract with Claude Code, repo layout, testing, release/rollback, rituals                                                                                                                                                                         | Before Sprint 0; reference after                                   |
| `07-collectors-world.md`                | **PROPOSAL (H3):** Collectors World — the virtual-garage / meetups / racing expansion: feature catalogue, token economy, integration with the existing app, data model, 12-sprint roadmap, legal/regulatory and operating notes for the owner, decisions to accept | When planning post-pilot (H3); before accepting any World decision |
| `DECISIONS.md`                          | **Append-only decision log (D-001…).** Binding for every session; contradicting a row = regression                                                                                                                                                                 | Every session, before code                                         |
| `PROGRESS.md`                           | Session hand-off state: active task, board, blockers, next action                                                                                                                                                                                                  | Every session: read first, update last                             |
| `tools/guard.sh`                        | CI/pre-push grep guard that fails on decision-violating code                                                                                                                                                                                                       | Runs automatically                                                 |
| `/CLAUDE.md` (repo root)                | Always-loaded memory for Claude Code: session protocol, rules, commands                                                                                                                                                                                            | Every session (automatic)                                          |
| `tools/backlog.json`, `tools/render.py` | Source of truth for the sprint plan + CSV; edit JSON, re-run script                                                                                                                                                                                                | When re-planning                                                   |

## Decisions you still owe before Sprint 0 (blocking)

1. **Supabase region** — plan says `ap-south-1` (Mumbai). Low reversibility. Confirm.
2. **Stripe merchant** — Hypermax Solutions FZE account; pack prices in AED; two packs and the token costs of slot / scan pack / Pro-30d. Needed by Sprint 7 but the Stripe account application should start now.
3. **SMS provider for India** — Twilio Verify with DLT registration (needs Indian entity/sender ID) or MSG91. Start paperwork in Sprint 1 week 1; email OTP is the fallback so it never blocks.
4. **Pilot cohort** — who are the 3–5 shops and ~30 collectors; who owns recruiting (Varun?).
5. **Catalogue seed** — Varun to maintain the starter brands/castings CSV (~200 rows) by Sprint 3.
6. **Tier names** — confirm the level/tier names from Varun's prototype for F-13.

## Decisions deliberately deferred (don't decide now)

Priority search placement stance (H2, after data) · Razorpay/UPI (only if India token conversion is poor) · multiverse engine (H3) · native apps · Arabic/Hindi UI.

## How to use with Claude Code

1. `docs/plan/` and `/CLAUDE.md` are in the repo (done in S0).
2. Each session: "Work on MV-S2-04." — CLAUDE.md's session protocol makes Claude Code read PROGRESS.md → DECISIONS.md → the task row, state the plan and D-xxx touched, and wait for go. At the end it updates PROGRESS.md and appends any decision.
3. Re-plan by editing `tools/backlog.json` and running `python3 docs/plan/tools/render.py`, then re-import `backlog.csv` to Jira (or update issues by Issue Key).
