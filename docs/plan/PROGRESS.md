# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position

- **Sprint:** S1 — Identity, multi-country, platform primitives. Not yet locked (lock = first S1 session).
- **Production:** LIVE — `https://tiny-torque-git-main-tiny-torque.vercel.app` (Vercel project `tiny-torque`, branch `main`). First deploy 2026-09-28; email-OTP sign-in → onboarding → garage → add car verified by Sreejith.
- **Supabase:** project `bjhowyyyypeacfkgxwqr` (Branching on; persistent branches `main`, `staging`). Migrations applied to `main`: 20260927000000 baseline, 20260927000100 housekeeping, 20260928000000 grants. `20260928000100_identity_v2.sql` is written and committed on `sprint-1` but **not yet applied anywhere** — no Docker/psql/Supabase CLI in this sandbox to run it; the Supabase Branching preview on the PR (or a manual `db push`) is the first real application. Edge Function `scan-photo` deployed with `ANTHROPIC_API_KEY`.
- **Auth:** email OTP via Resend SMTP (`hello@tinytorque.hypermaxsolutions.com`); templates "Confirm signup" + "Magic Link" carry `{{ .Token }}`; Site URL = prod URL; redirect URLs for main/staging/previews/localhost. Phone OTP: later (D-037).
- **Active task:** none — MV-S1-01, MV-S1-02, MV-S1-03, MV-S1-05, and MV-S1-06 all code-complete on `sprint-1`, [PR #15](https://github.com/sreejith586/tiny-torque/pull/15) open into `staging`. **Full CI suite genuinely green** (migrations, pgTAP, Playwright/D-041 all pass; the known/expected D-012 guard failure is now gone too, since MV-S1-03 removed the last hardcoded `+91`).
- **Last session:** 2026-09-29 — MV-S1-03: login's hardcoded `COUNTRY_CODE = '+91'` replaced with a native `<select>` sourced from `domain/identity.listEnabledCountries` (the `countries` table seeded by MV-S1-01, D-001: AE/IN only — the sprint-plan row's "full E.164 list" language is superseded by D-001's locked pilot geography, not expanded here). Defaults to India to match the existing `E2E_TEST_PHONE` smoke-test convention; falls back to a static AE/IN list (matching the migration seed) while the live fetch is in flight or if it fails, so the select is never blank. E.164 now built from the selected country's `dial_code` instead of the constant. Validation relaxed from a fixed 10-digit check to a generic 7-digit minimum (AE mobiles are 9 digits, not 10). Verified visually (country switch AE↔IN correctly changes the dial-code prefix and the OTP-step destination string) via a local production build — could not exercise a live `countries` query in this sandbox since the migration isn't applied to any real Supabase branch yet (same known constraint as MV-S1-01/02); that's the Vercel-preview Playwright run's job once pushed. This also clears the D-012 guard failure that's been open all sprint. `login-phone` D-041 baselines (6 themes) regenerated via the same temporary `ci.yml` job-swap technique used for D-044.
- **Next action:** Sreejith reviews/merges [PR #15](https://github.com/sreejith586/tiny-torque/pull/15) (now covers S1-01/02/03/05/06 + D-044) and weighs in on the `follows` public-read-count note below. Once merged/applied to `staging`, confirm `supabase migration list` shows all three new migrations, run `pnpm gen:types:db` for real against them, try `update-baselines.yml` via the Actions tab now that it's on the default branch, and confirm the `countries` select actually populates against the real DB (untestable from this sandbox until then). Next task: `/task MV-S1-04` (onboarding v2 — D-042's 5-step wizard referencing `garage-log-147.html`, with the country step this task's `listEnabledCountries` now makes available).

## S0 closing board

| Task                                      | Status                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| MV-S0-01 … 05, 07 … 11                    | done                                                            |
| MV-S0-06 Environments + first prod deploy | **done** 2026-09-28                                             |
| MV-S1-03 (partial, pulled forward)        | email OTP path shipped; country picker + full E.164 still in S1 |

## S1 task board (lock at first S1 session; rows from 05-sprint-plan.md)

| Task                                               | Status             | Notes                                                                                                                                        |
| -------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| MV-S1-01 Migration 0002 identity_v2                | in-review (PR #15) | file `20260928000100_identity_v2.sql` (D-036); guard D-012 fails CI on login's hardcoded `+91` until MV-S1-03 — expected, noted in PR        |
| MV-S1-02 pgTAP RLS tests for identity tables       | in-review (PR #15) | D-043: dedicated CI job on `supabase/postgres` image; `supabase/tests/0002_identity_v2.sql`, 33/33 passing                                   |
| MV-S1-03 Login v2: country picker, phone/email OTP | in-review (PR #15) | native `<select>` from `listEnabledCountries` (AE/IN, D-001); E.164 now built from `dial_code`; D-012 guard clears                           |
| MV-S1-04 Onboarding v2                             | todo               |                                                                                                                                              |
| MV-S1-05 domain/identity service                   | in-review (PR #15) | handle rules + cooldown, redeem_invite RPC, country helpers; `20260929000000_identity_rpcs.sql`; 18 Vitest + 10 pgTAP                        |
| MV-S1-06 domain/events + flags + admin shell       | in-review (PR #15) | typed events + emitEvent wired into identity; flags eval/cache/useFlag (not wired into a layout yet); /admin role gate; flags seed migration |
| MV-S1-07 Public profile v1 /u/[handle]             | todo               |                                                                                                                                              |
| MV-S1-08 Settings: export + delete stub            | todo               |                                                                                                                                              |
| MV-S1-09 Playwright sign-in → onboarding → profile | todo               | use email test path or Supabase test OTP on branches                                                                                         |

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
- Vercel Deployment Protection: `VERCEL_AUTOMATION_BYPASS_SECRET` is configured (confirmed present). ~~e2e job fails without it~~ — resolved.
- ~~Playwright/e2e never actually finishing~~ — **resolved 2026-09-29.** Root cause was two real CI bugs (concurrency group only keyed on branch ref; `settle()`'s `waitForLoadState('networkidle')` never resolving against PostHog's background traffic), both fixed. Baselines regenerated (font-rendering drift + the D-044 icon change). Verified green twice via the raw job conclusion, not just assumed.
- Staging Supabase branch: verify it has the three migrations (open the staging deployment and sign in); if not, `supabase db push --db-url <staging branch url>` once.
- The `countries` select on `/login` (MV-S1-03) has only been verified against the AE/IN fallback list, not a live `countries` query — no Supabase branch has MV-S1-01's migration applied yet in this sandbox. Confirm it populates for real once PR #15's Vercel preview (or staging) has the migration applied.
- **PII exposure (rule 15) found in baseline, not fixed in MV-S1-01:** `marketplace_listings.seller_mobile` is denormalized onto listings and readable by anyone via the "Active listings are publicly readable" policy (status='active', including anon). Predates this sprint; belongs to the `marketplace_v2` migration (0006, S4). Flagging now so it isn't lost.
- MV-S1-01's `public_profiles` view (03 §2.1) omits `avatar`/`banner`/`rating_avg`/`rating_count` — those source columns don't exist until the media (S2) and reviews-aggregate migrations land; view will be extended via `create or replace view` then.
- Self-review of PR #15 flagged: `follows` RLS grants full public SELECT on raw follower/followee pairs, but 03 §2.12 says "public read **count**" — still open, dormant until any UI reads `follows`; ask Sreejith which he wants. (The matching `domain_events`-emission gap is now closed by MV-S1-06 — `createProfile`/`patchProfile` emit `user.onboarded`/`profile.updated`.)

## Decisions made this sprint

- D-029…D-041 (see DECISIONS.md). D-041 = prototype fidelity enforced mechanically: 74 pixel baselines in `e2e/__screenshots__` (landing, login email/phone, market, garage grid/list, car detail, add car ± more details, scan, profile, offers × 6 themes + 2 desktop; signed-in screens via the `?__visual=1` fixture harness), guard.sh UI-library/primitives checks, F-01 onboarding corrected back to the prototype's single form; S1-03/04/07/08 rows reworded to name the prototype pieces they reuse.
- **D-042 (supersedes D-041's onboarding clause only):** onboarding (F-01) now references `garage-log-147.html`'s 5-step wizard (account type → name → location → photo(optional) → phone/OTP, progress bar, back button) instead of the single-page form, for MV-S1-04. Rest of D-041 (pixel baselines, banned UI libs, `fd3b02d` for every other screen) unchanged.
- **D-043:** pgTAP CI runs on the `supabase/postgres` image connected as `supabase_admin`, not plain `postgres:17` + `pg-stub.sql` — real `auth.uid()`/`auth.role()` semantics over the lighter no-Docker stand-in.
- **D-044 (supersedes D-041's reference-image clause, not its scope):** `garage-log-147.html` — Sreejith's fully click-through mockup — is the visual-detail reference (icons, illustrations, card styling) project-wide, replacing `fd3b02d` for _how things look_. `fd3b02d` stays the reference for structure/flow/copy, and the mockup's own feature scope (XP/levels/badges, ratings, chat assistant) stays on the existing sprint plan — not pulled forward. Its India-only onboarding doesn't override D-001's UAE+India pilot.
- **Handover parity proof (2026-09-28, `scripts/visual-compare-handover.mjs`, current build vs `fd3b02d` build, 390 px, 6 themes):** landing, market, add car, add car + more details, scan = **0 px difference** in every theme (bottom bar, emoji icons, active tabs, headers, buttons, inputs). Login differs only by the spec'd "Use email instead" button (D-037). Garage/car detail/profile use components with no visual diff vs handover (`git diff fd3b02d -- src/components`).

## Carry-over register

- none

## Session log (last 5 sessions only — trim older)

| Date       | Task(s)                                                                   | Outcome                                                                                                                                                                                                                                                                                                                                 | PR                                                        |
| ---------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 2026-09-28 | S1-01 + S1-02: identity_v2 migration, D-042, pgTAP matrix (D-043)         | Migration + real generated types; self-review fixed a critical public_profiles RLS-bypass + 2 more; pgTAP CI job + 33-assertion RLS matrix, 6 CI round-trips to genuinely green (found a job that reported success despite 8 failing assertions)                                                                                        | [#15](https://github.com/sreejith586/tiny-torque/pull/15) |
| 2026-09-29 | S1-05: identity_rpcs migration, domain/identity handle rules              | `handle_changed_at`, `emit_event()`, `redeem_invite()` RPC; real handle rules replacing the S1-01 stopgap; 30-day cooldown; 18 Vitest + 10 new pgTAP assertions (43 total), all genuinely green                                                                                                                                         | [#15](https://github.com/sreejith586/tiny-torque/pull/15) |
| 2026-09-29 | S1-06: domain/events + domain/flags + /admin gate; ci.yml concurrency fix | Typed events wired into identity service; flags eval+cache+useFlag; /admin role gate (proxy + layout); flags seed migration; fixed `push` runs cancelling in-flight `deployment_status`/Playwright runs (never actually failing, just never finishing since S0)                                                                         | [#15](https://github.com/sreejith586/tiny-torque/pull/15) |
| 2026-09-29 | D-044: real SVG icons (not emoji), Playwright genuinely green             | Sreejith clicked through the mockup himself, flagged the icons; `src/components/icons.tsx` + 3 files fixed; fixed `settle()`'s `networkidle` hang (real timeout root cause, not just concurrency); regenerated 35/74 pixel baselines via a temporary CI swap; added reusable `update-baselines.yml`; Playwright confirmed passing twice | [#15](https://github.com/sreejith586/tiny-torque/pull/15) |
| 2026-09-29 | S1-03: login country picker, E.164 from `dial_code`                       | Native `<select>` from `listEnabledCountries` (AE/IN); removed the hardcoded `COUNTRY_CODE`, clearing the D-012 guard failure open all sprint; fallback country list while live fetch is pending; `login-phone` baselines regenerated                                                                                                   | [#15](https://github.com/sreejith586/tiny-torque/pull/15) |
