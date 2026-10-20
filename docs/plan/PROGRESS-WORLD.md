# PROGRESS-WORLD.md — Collectors World (H3) session-to-session state

> **The hand-off file for the World track** (D-066), kept apart from `PROGRESS.md` so the parallel H1 sessions (S8+) and the W-sessions never edit the same section. Same rules as PROGRESS.md: read it first (after CLAUDE.md and DECISIONS.md), update it last, keep it under 120 lines — state, not history. Spec = `07-collectors-world.md`, plan = `08-collectors-world-sprint-plan.md`, decisions D-066…D-078.

## Current position

- **Sprint:** **W01 — W0 Foundations, built 2026-10-20 in one session** (Sreejith authorised the whole sprint without per-task "go"), PR `[MV-W01] Collectors World foundations (dark)` into `staging`. Everything is dark: eight `world*` flags seeded OFF, no World screen exists, the only user-visible change is the 18+/terms checkbox on the last onboarding step and a consent line on the sign-in form.
- **Next sprint:** **W02 (Garage v1 — scene, slots, featured car, shop basics) cannot start screens until Varun's design pack lands (MV-W01-02, D-074)** — every World screen needs its own D-xxx sign-off row. Services/migrations may proceed meanwhile (07 §12 mitigation).
- **Branch convention:** `mv/W{n}-{id}-{slug}` → PR `[MV-Wnn-nn] …` (or `[MV-Wnn]` for a whole sprint) into `staging`. Never merge; never push `staging`/`main`.
- **Where things are:** `src/domain/world/{types,errors,schema,repo,service}.ts` (+ Vitest), `src/app/api/v1/world/{me,garages/[handle]}/route.ts` (+ `_shared.ts`, Vitest smoke), `src/lib/rate-limit.ts`, `src/lib/legal.ts`, `src/domain/flags` (World group + admin `updateFlag`), `/admin/flags` (`AdminFlagsView.tsx`), `supabase/migrations/20261020071121_world_core.sql` + `20261020071122_world_rpcs.sql`, `supabase/tests/0020_world_core.sql` + `0021_world_rpcs.sql`, `docs/legal/{terms,privacy,community-guidelines}-v2.md` (drafts for counsel).
- **`src/types/supabase.ts` was hand-edited** (no Docker / DATABASE_URL in this sandbox, same as S5-04/S7): 4 tables, 3 RPCs, 4 enums, 2 enum extensions, 3 columns. **Needs a real `pnpm gen:types` diff-check** once 0012/0013 are live on staging (CI's pgTAP job applies them on the `supabase/postgres` image, so the SQL itself is verified there).
- **Design choices made in code, worth knowing:** World purchases reuse `spend_tokens` unchanged and get an `entitlement_grants` receipt (kinds `world_level` / `world_item`); `token_ledger.source` is nullable and NULL on spends until W04's FIFO; `world_garages` level/score are protected by a guard trigger + `mv.world_rpc` GUC rather than a column-level grant; `invite` open-house mode is owner-only until `world_invites` (W03); `/api/v1/*` bypasses the proxy's login redirect (JSON 401/404 instead); no `world_items` are seeded (catalogue = design pack).

## Task board — W01

| Task      | Status | Notes                                                                                                                                                                                             |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MV-W01-01 | done   | D-066 (parallel track) + D-067…D-078 (07 §13, accepted via the PR — strike at review to reject); F-20…F-28 in 04; 03 §2.24–§2.31 + §3/§4; CLAUDE.md line                                          |
| MV-W01-02 | open   | **Varun** — 13 World screens × 6 themes, names (World, credits, levels), launch decor list (~30), race/meetup format names; one D-xxx per screen                                                  |
| MV-W01-03 | done   | 0012 `world_core` + pgTAP 0020 (27 assertions: owner/follower/stranger/blocked/anon/admin matrix, guard trigger, `source` derivation, flags OFF)                                                  |
| MV-W01-04 | done   | `domain/world` core service + layout zod (slots ≤ capacity, public + owned) + Vitest (30 tests)                                                                                                   |
| MV-W01-05 | done   | 0013 `world_rpcs` + pgTAP 0021 (29 assertions: XP gate before money, prices, max level, earned-only, durable uniqueness, consumables, bypass attempts)                                            |
| MV-W01-06 | done   | `world.*`/`meetup.*`/`race.*`/`club.*`/`quest.*`/`season.*` + `user.accepted_terms`/`flag.updated` in `EVENT_TYPES`; consumer registry = W02-04 onwards                                           |
| MV-W01-07 | done   | `/api/v1/world/me`, `/api/v1/world/garages/{handle}`; zod param, flag-gated 404 while dark, 60–120 req/min per caller, Vitest smoke + e2e dark check                                              |
| MV-W01-08 | done   | required 18+/terms checkbox on the last onboarding step (no new step, D-042) → `age_confirmed_at` + `terms_version` + `user.accepted_terms`; sign-in re-stamps on a version bump; v2 legal drafts |
| MV-W01-09 | done   | `/admin/flags` with Core + Collectors World groups, country/cohort audience helpers, `flag.updated` audit event; `WORLD_ANALYTICS_EVENTS` in `lib/analytics`                                      |
| MV-W01-10 | done   | this file; 06 §5 runbook placeholders (earn exploit / race ran twice / room abuse)                                                                                                                |
| MV-W01-11 | open   | STRETCH `public/world/` art convention + `<WorldArt>` — skipped (needs the design pack to mean anything)                                                                                          |

## Task board — W02…W12 (sprint level; task rows live in 08)

| Sprint | Theme                                                      | Status      | Gate / note                                                          |
| ------ | ---------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| W02    | Garage v1 — scene, slots, featured car, shop basics        | not started | **design pack (MV-W01-02)**; W02-03/04 services can start without it |
| W03    | Visits & social, marketplace bridge; `world` ON (founders) | not started | 0013 world_social; stop/continue checkpoint; guidelines v2 publish   |
| W04    | Earn engine & quests                                       | not started | 0014 quests_seasons; FIFO earned-first in `spend_tokens`             |
| W05    | Shop complete, season v0, economy dashboard                | not started | `world_earn` ON (founders)                                           |
| W06    | Virtual meetups                                            | not started | 0015 clubs_meetups                                                   |
| W07    | Best-in-show, clubs v1, hosting rules                      | not started | `world_meetups`/`world_clubs` ON (founders)                          |
| W08    | Racing core                                                | not started | 0016 races; counsel read on gaming law **before W4**                 |
| W09    | Race events, trophies, season points                       | not started | `world_races` ON (founders)                                          |
| W10    | In-person meetups                                          | not started | 0017 meetups_irl; UAE first                                          |
| W11    | Leaderboards, live-ops, cost guards                        | not started | 0018 world_ops                                                       |
| W12    | Hardening & first public season                            | not started | all `world*` ON for the pilot cohort except `world_presence`         |

## Blockers / open questions

- **Counsel (07 §10, drafts in `docs/legal/*-v2.md`, ⚖️ markers inside):** gaming-law classification of races (India 2025 Act / UAE GCGRA) before W08; closed-loop PPI/VARA confirmation of the credits wording; DPDP/PDPL cross-border basis for UAE users on Mumbai hosting; grievance officer name/address; refund window per country; retention periods for ledger records; UAE public-gathering wording for in-person meetups. **India OIDAR GST registration before live token purchases for Indian users (D-078 — applies to S7 too).**
- **`pnpm gen:types` diff-check** of the hand-edited `src/types/supabase.ts` once 0012/0013 are on staging.
- **Varun (MV-W01-02 + 07 §14):** design pack; names for the World, credits, garage levels (Shed…Vault are placeholders); launch decor catalogue; meetup/race format names (no Mattel series names); clubs in W3 or W6; first country.
- **Pricing is placeholder data** (levels 40/90/180/350, D-070 carries D-064's status) — real numbers = data-only migration.
- **Modelling gaps left for W02:** "extra display slot beyond level" (07 §3.2) has no column/item kind yet; `world_items` consumable expiry (Spotlight 24 h) needs an `expires_at` on inventory or a grant — decide in MV-W02-05. `theme_item_id` is settable by the owner today without an ownership check (RLS allows any world_items id) — the W02 editor must set it through `saveLayout`-style validation or a trigger.
- **Terms versioning:** `CURRENT_TERMS_VERSION = '1'` (today's terms). Bumping to '2' when counsel approves makes every existing user re-accept at next sign-in via the sign-in consent line — there is no interstitial screen; decide whether one is needed (prototype has none, D-027).
- `is_blocked()` / the followers branch of garage visibility rely on RLS; the service's `isGarageVisibleTo` only mirrors owner/public/invite. Fine while reads go through RLS; a service-role reader (jobs) must not assume it.

## Decisions made this sprint

D-066 (parallel track), D-067…D-078 (07 §13 accepted via the MV-W01 PR). See DECISIONS.md.

## Session log (last 5 sessions only — trim older)

| Date       | Task(s)                           | Outcome                                                                                                                                                                                                                                                                                                                                                                        | PR              |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 2026-10-20 | MV-W01-01/03/04/05/06/07/08/09/10 | Whole W01 built in one session per Sreejith: decisions + specs, 0012/0013 migrations with 56 pgTAP assertions, `domain/world` + events + 40 Vitest, `/api/v1/world` scaffold, 18+/terms gate in onboarding + sign-in, v2 legal drafts for counsel, `/admin/flags` World group + analytics names. Skipped: W01-02 (Varun), W01-11 (stretch, needs the pack). Types hand-edited. | [MV-W01] (open) |
