# 08 — Collectors World (H3) — Sprint Plan & Task Backlog

> Status: **PROPOSAL v1 — 2026-10-20**, companion to `07-collectors-world.md`. Generated from `tools/backlog-world.json` — edit the JSON and re-run `python3 docs/plan/tools/render-world.py`; `backlog-world.csv` is Jira-importable. Kept out of `backlog.json` / `05` until the gate below is met (02 §8 guardrail); then merge.

## Gate (nothing below starts before this)

Pilot success criteria (01 §6) met · S8 + S9 live on prod · 07 §13 decisions accepted · design pack signed off · 07 §10 'before W0' legal items closed

## Cadence & capacity

- **Cadence:** 1-week sprints, Monday lock, Sunday demo on production (unchanged from H1, D-002/D-020/D-028)
- **Planned capacity:** ≈ 20 h per sprint; sprints are planned to 15.5–18.5 h, the rest is slack. STRETCH items only when ahead.
- **Estimates:** Hours of Sreejith's focused time driving Claude Code, same scale as 05. Design-pack and counsel items count only the engineering-side hours; the external work runs in parallel and is a dependency, not a task estimate.
- **Sequencing rule:** migration → `gen:types` → domain service (+ tests) → RPC/Edge → UI → Playwright, inside every sprint (D-020).
- **Release rule (D-028):** Every sprint ends with a production deploy; World increments ship dark behind their flag and are turned on per cohort/country via flag audiences, never by code.

## Feature keys used below (to be added to 04 in MV-W01-01)

| Key  | Pillar                                                                                     |
| ---- | ------------------------------------------------------------------------------------------ |
| F-20 | Garage — the space (levels, slots, featured car, themes, decor, score)                     |
| F-21 | Visits & social (open house, invites, visits, kudos, guestbook, follows, leaderboards)     |
| F-22 | Clubs (clubhouse, roles, club meetups, club leagues)                                       |
| F-23 | Virtual meetups (schedule, RSVP, live room, showcase, best-in-show)                        |
| F-24 | In-person meetups (listing, approximate location, venue to confirmed, check-in, safety)    |
| F-25 | Racing (seeded simulation, time trial, challenge, bracket events, replay, trophies)        |
| F-26 | Progression (World XP rules, quests, streaks, seasons, earn engine)                        |
| F-27 | Shop & economy surfaces (levels, items, tunes, spotlight, /tokens integration)             |
| F-28 | World trust, admin & ops (moderation, host rules, economy dashboard, cost guards, tooling) |

## Definition of Done (every task)

- Migration on local + staging with pgTAP (RLS matrix incl. visitor / attendee / member / blocked roles)
- Deployable to prod dark behind its `world*` flag
- Every token movement and race result via a SECURITY DEFINER RPC or Edge job (P4) — client never asserts an amount
- Service Vitest; replay-determinism test for anything computed from events (XP, quests, score, race)
- UI in 6 themes at 360 px + 1280 px with loading/empty/error, matching the signed-off design-pack screen
- Events emitted for every mutation; consumers (XP, notifications, score) wired
- Playwright for the sprint's critical flow; guard.sh + CI green
- PROGRESS.md updated; F-2x AC ticked in 04; any decision appended to DECISIONS.md
- Reviewed by Sreejith

## Timeline at a glance

| Sprint    | Phase / theme                                                          | Planned h | Stretch h | Migration           | Flag changes                                                                                                        |
| --------- | ---------------------------------------------------------------------- | --------- | --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| W01       | W0 Foundations — decisions, design pack, schema dark, 18+ gate         | 17.5      | 2         | 0012 world_core     | world, world_shop, world_earn, world_meetups, world_meetups_irl, world_races, world_clubs, world_presence (all OFF) |
| W02       | W1a Garage v1 — scene, slots, featured car, shop basics                | 17.5      | 2         | —                   | —                                                                                                                   |
| W03       | W1b Visits & social — open house, kudos, guestbook, marketplace bridge | 18.5      | 0         | 0013 world_social   | world ON (founders), world_shop ON (founders)                                                                       |
| W04       | W2a Earn engine & quests                                               | 17.5      | 2         | 0014 quests_seasons | world_earn (seeded, OFF)                                                                                            |
| W05       | W2b Shop complete, season v0, economy dashboard                        | 17        | 0         | —                   | world_earn ON (founders)                                                                                            |
| W06       | W3a Virtual meetups — host, RSVP, live room                            | 18        | 0         | 0015 clubs_meetups  | world_meetups, world_clubs (seeded, OFF)                                                                            |
| W07       | W3b Best-in-show, clubs v1, hosting rules                              | 15.5      | 2         | —                   | world_meetups ON (founders), world_clubs ON (founders)                                                              |
| W08       | W4a Racing core — stats, time trial, challenge, replay                 | 18.5      | 0         | 0016 races          | world_races (seeded, OFF)                                                                                           |
| W09       | W4b Race events, trophies, season points                               | 16.5      | 2         | —                   | world_races ON (founders)                                                                                           |
| W10       | W5 In-person meetups                                                   | 16        | 0         | 0017 meetups_irl    | world_meetups_irl ON (UAE founders)                                                                                 |
| W11       | W6a Leaderboards, live-ops tooling, cost guards                        | 18        | 0         | 0018 world_ops      | —                                                                                                                   |
| W12       | W6b Hardening & first public season                                    | 18.5      | 3         | —                   | all world* ON for pilot cohort except world_presence                                                                |
| **Total** | 12 sprints ≈ 12 weeks build                                            | **209**   | 13        |                     |                                                                                                                     |

First user-visible value is W03 (founders can visit each other's garages). W03 is the explicit stop/continue checkpoint.

## What is live after each sprint (D-028)

| Sprint | Production increment                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W01    | Migration 0012 (world_core) applied dark on prod; eight `world*` flags seeded off; 18+ confirmation + terms version recorded at onboarding. Nothing user-visible beyond the age checkbox. |
| W02    | Garage view/editor and shop basics deployed behind `world` + `world_shop` (still OFF).                                                                                                    |
| W03    | Visits, kudos, guestbook, open-house modes, invites, 'Open garages' list live behind `world` + `world_shop` ON for the founders cohort. Community guidelines v2 published.                |
| W04    | Quests, streaks and the earn RPC deployed behind `world_earn` (OFF until W2b).                                                                                                            |
| W05    | Full shop, season v0, garage score, economy dashboard, earn-freeze tooling; `world_earn` ON for founders.                                                                                 |
| W06    | Virtual meetups deployed behind `world_meetups` (OFF until W3b).                                                                                                                          |
| W07    | Best-in-show, photo wall, clubs, club meetups, hosting rules; `world_meetups` + `world_clubs` ON for founders.                                                                            |
| W08    | Racing core deployed behind `world_races` (OFF until W4b).                                                                                                                                |
| W09    | Bracket events, trophies/titles, ticker, tunes, dispute tooling; `world_races` ON for founders.                                                                                           |
| W10    | In-person meetups behind `world_meetups_irl` ON for UAE founders first (country audience), India after the IT-Rules/grievance review.                                                     |
| W11    | Leaderboards, Spotlight, season rollover, admin World tools, cost alerts.                                                                                                                 |
| W12    | World open to the full pilot cohort (all `world*` flags except `world_presence`); terms/privacy/guidelines v2 live; KPI dashboards; incident runbooks rehearsed.                          |

## Dependency spine

W01 schema + RPCs + 18+ gate → W02 garage scene/editor/shop → W03 visits/social (flags ON founders) → W04 earn engine/quests → W05 shop complete/season/dashboard (earn ON) → W06 virtual meetups → W07 best-in-show/clubs (meetups ON) → W08 racing core → W09 race events/prizes (races ON) → W10 in-person meetups (IRL ON, UAE first) → W11 leaderboards/live-ops → W12 hardening + cohort launch. W07's clubs and W10 can swap; W08–W09 cannot move before W05 (tunes/prizes need the shop and earn engine).

---

## Sprint W01 — W0 Foundations — decisions, design pack, schema dark, 18+ gate

**Goal.** Everything the World needs that is invisible to users: the §13 decisions accepted, Varun's design pack signed off, migration 0012 on staging, domain/world + the three purchase RPCs under test, the age gate and terms-version acceptance in place. No World screen is reachable.

**Demo at end of sprint.** `world_*` flags exist and are off; a founder's garage row is created on prod via the API scaffold and is invisible; Vitest/pgTAP for world_core green; onboarding shows the 18+ confirmation.

**Ships to production.** Migration 0012 (world_core) applied dark on prod; eight `world*` flags seeded off; 18+ confirmation + terms version recorded at onboarding. Nothing user-visible beyond the age checkbox.

**Risks / watch-outs.** Design pack slipping (W0 cannot exit without it — build DB/services meanwhile); counsel read of the India Online Gaming Act arriving late (racing is W8, but the credits wording in terms v2 depends on it).

**Decisions locked this sprint:** 07 §13 rows 1–12 accepted as D-xxx; Design-pack sign-off rows per screen (D-027 mechanism); 18+ at launch (P8)

**Planned hours:** 17.5 (+2 stretch)

| ID        | Feature | Type     | Task                                   | What done looks like                                                                                                                                                                                                                                                                                                                 | Est (h) | Depends on |
| --------- | ------- | -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------- |
| MV-W01-01 | Docs    | docs     | Accept decisions + spec sections       | Append 07 §13 rows to DECISIONS.md via /decide; add F-20…F-28 sections to 04 (rules/AC/events/flags per pillar) and §2.24+ tables to 03 from 07 §7; CLAUDE.md gains a World line in the module map.                                                                                                                                  | 1.5     | —          |
| MV-W01-02 | Design  | design   | Design-pack intake & sign-off          | Review Varun's 13 World screens × 6 themes against 07 §5; log one D-xxx sign-off row per screen; agree garage-level names, credits naming, launch decor list (≈30), race/meetup format names (no Mattel series names).                                                                                                               | 1       | —          |
| MV-W01-03 | F-20    | db       | Migration 0012 world_core              | `world_levels` (seed 5), `world_garages`, `world_items`, `world_inventory`; `token_ledger_reason` + earn/spend values, `token_ledger.source` enum; `profiles.age_confirmed_at`, `profiles.terms_version`; eight `world*` flags seeded off; RLS + pgTAP matrix (owner/visitor/anon/admin).                                            | 3       | MV-W01-01  |
| MV-W01-04 | F-20    | backend  | domain/world core service              | `pnpm gen:types`; `domain/world/{types,schema,repo,service}`: ensureGarage, getOwnGarage, getGarageForVisitor (respects open_mode + blocks), layout zod schema (slots ≤ level capacity, items owned + public); Vitest with mocked repo.                                                                                              | 3       | MV-W01-03  |
| MV-W01-05 | F-27    | db       | Purchase RPCs                          | `ensure_world_garage()`, `buy_world_level()`, `buy_world_item()` SECURITY DEFINER wrapping `spend_tokens` (D-021) with eligibility checks (XP level gate, min_level, earned-only = not purchasable, durable uniqueness); emit `world.level_up` / `world.item_bought`; pgTAP: authenticated cannot bypass, negative balance rejected. | 2.5     | MV-W01-03  |
| MV-W01-06 | F-20    | backend  | World event types + consumers skeleton | Add `world.*`, `meetup.*`, `race.*`, `club.*`, `quest.*` to `EVENT_TYPES` and entities; emit from every world service mutation; consumer registry stub (XP/notification hooks land in their sprints).                                                                                                                                | 1       | MV-W01-04  |
| MV-W01-07 | F-20    | backend  | `/api/v1/world` scaffold               | Thin route handlers over services (GET garage by handle, GET own garage), zod on params, rate limit, same auth as server actions; smoke test; documented as the future-client seam (ADR-05).                                                                                                                                         | 1.5     | MV-W01-04  |
| MV-W01-08 | Legal   | backend  | 18+ gate + terms-version acceptance    | Onboarding step gains the 18+ confirmation (D-042 wizard style), stored in `age_confirmed_at`; sign-in records `user.accepted_terms` with version; terms / privacy / community-guidelines v2 drafted (credits, virtual items are licences, DPDP/PDPL wording, grievance contact) and sent to counsel.                                | 2.5     | MV-W01-03  |
| MV-W01-09 | F-28    | ops      | Flags editor group + analytics names   | `/admin` flags editor shows the World group with audience helpers (country, cohort); PostHog event names for world mirrored from domain events in `lib/analytics`.                                                                                                                                                                   | 1       | MV-W01-03  |
| MV-W01-10 | Docs    | docs     | PROGRESS + runbook stubs               | PROGRESS.md World section; 06 runbook gets placeholders for 'earn exploit', 'race ran twice', 'room abuse'.                                                                                                                                                                                                                          | 0.5     | MV-W01-08  |
| MV-W01-11 | F-20    | frontend | STRETCH: World art pipeline            | `public/world/` asset convention (levels, themes, decor at 1x/2x, dark/light variants), `<WorldArt>` wrapper over `<MediaImage>` conventions, size budget check in CI.                                                                                                                                                               | 2       | MV-W01-02  |

---

## Sprint W02 — W1a Garage v1 — scene, slots, featured car, shop basics

**Goal.** A collector opens /world, sees their garage rendered from their real public items, arranges cars in slots, picks a featured car, and buys a theme or an extra slot with credits.

**Demo at end of sprint.** Founder places five cars, sets a featured car, buys the 'Neon Workshop' theme; the scene re-renders in all 6 themes at 360px and 1280px; a private item disappears from its slot when made private.

**Ships to production.** Garage view/editor and shop basics deployed behind `world` + `world_shop` (still OFF).

**Risks / watch-outs.** Scene renderer scope creep — it is CSS layers + CarCard, not a canvas; keep slot anchors in one JSON map per breakpoint. Bottom-nav change needs its D-xxx sign-off row.

**Planned hours:** 17.5 (+2 stretch)

| ID        | Feature | Type     | Task                             | What done looks like                                                                                                                                                                                  | Est (h) | Depends on |
| --------- | ------- | -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W02-01 | F-20    | frontend | /world home + nav entry          | Home: your garage card (level, score, featured car), 'Open garages' list placeholder, quests placeholder; BottomNav/side-rail gains World (sign-off row); empty/loading/error states; `t()` keys.     | 3       | MV-W01-04  |
| MV-W02-02 | F-20    | frontend | Garage scene renderer            | Layered illustrated scene by level + theme; slot anchor map per breakpoint; `CarCard` in slots; featured slot large; six themes; motion only from the D-045 register; no canvas/WebGL.                | 4       | MV-W02-01  |
| MV-W02-03 | F-20    | frontend | Garage editor                    | Slot picker from own public items (reuses garage list query), featured car, rename (first free, then `spend_rename`), save via server action with the layout zod schema; optimistic UI with rollback. | 3       | MV-W02-02  |
| MV-W02-04 | F-20    | backend  | Slot integrity consumer          | Consumer on `item.deleted` / `item.made_private` / `offer.completed` (seller side) removes the item from slots and featured; buyer gets a 'park it' notification stub; Vitest.                        | 2       | MV-W01-06  |
| MV-W02-05 | F-27    | frontend | Shop v1 + inventory              | Levels, themes, extra slot purchase via `buy_*` RPCs; price from data; XP-gate messaging; `<Paywall>` → /tokens when short; inventory list; receipts in /tokens/history.                              | 3       | MV-W01-05  |
| MV-W02-06 | F-20    | test     | Vitest + Playwright garage smoke | Service tests for layout rules; Playwright: open world → place car → set featured → buy theme (fixture balance via `?__visual=1`-style seed, never prod).                                             | 2       | MV-W02-05  |
| MV-W02-07 | Docs    | docs     | PROGRESS + F-20 AC check         | Tick F-20 acceptance criteria; PROGRESS.md.                                                                                                                                                           | 0.5     | MV-W02-06  |
| MV-W02-08 | F-20    | frontend | STRETCH: garage share image      | OG image route for `/world/g/[handle]` (featured car + level + handle) reusing the S8 profile OG pattern.                                                                                             | 2       | MV-W02-03  |

---

## Sprint W03 — W1b Visits & social — open house, kudos, guestbook, marketplace bridge

**Goal.** Garages become places people visit: open-house modes, invite links, visit counts, kudos, a host-moderated guestbook, and the bridge from a displayed car to its marketplace listing. `world` + `world_shop` turn ON for founders.

**Demo at end of sprint.** Two founders visit each other's garages, leave kudos and a guestbook line, one starts an offer from a slot; a blocked user cannot see the garage; the clean-language validator rejects a slur in the guestbook.

**Ships to production.** Visits, kudos, guestbook, open-house modes, invites, 'Open garages' list live behind `world` + `world_shop` ON for the founders cohort. Community guidelines v2 published.

**Risks / watch-outs.** Rate limits on visits/kudos must be triggers, not app code; the deferred MV-S6-04 clean-language validator becomes mandatory here — budget it honestly.

**Planned hours:** 18.5

| ID        | Feature | Type     | Task                                                           | What done looks like                                                                                                                                                                                                                           | Est (h) | Depends on |
| --------- | ------- | -------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W03-01 | F-21    | db       | Migration 0013 world_social                                    | `world_visits` (unique per day), `world_kudos`, `world_guestbook`, `world_invites` (expiring tokens), `reports.target_type` + garage/guestbook, `notifications.type` + visit/kudos; rate-limit triggers; blocks enforced in policies; pgTAP.   | 2.5     | MV-W01-03  |
| MV-W03-02 | F-21    | backend  | Visits / kudos / guestbook services + clean-language validator | `domain/world` visit record (dedup), kudos (1/day), guestbook create/hide; `lib/clean-language` server validator (MV-S6-04) shared with names/titles; blocks both ways; events `world.visited`, `world.kudos_given`, `world.guestbook_posted`. | 3       | MV-W03-01  |
| MV-W03-03 | F-21    | frontend | Visitor garage view                                            | `/world/g/[handle]`: scene read-only, kudos button, guestbook with host hide, 'For sale' badge + deep link, start-offer from slot (existing offers path), report garage; `public_profiles` only.                                               | 3       | MV-W03-02  |
| MV-W03-04 | F-21    | frontend | Open-house settings + invites                                  | Settings › World: open mode (public/followers/invite), who can invite/challenge me; invite link generation + invite-by-handle with notification; invite acceptance page.                                                                       | 2       | MV-W03-02  |
| MV-W03-05 | F-21    | frontend | Open garages list + recent visitors                            | `/world` 'Open garages' (own country default, All toggle), recent visitors (handles only) on own garage, visit/kudos notifications in the bell.                                                                                                | 2.5     | MV-W03-03  |
| MV-W03-06 | F-21    | backend  | Follow button + counts                                         | Pull the F-13 stretch forward: follow/unfollow on `/u/[handle]` and garage view using the existing `follows` table; follower-only open mode uses it.                                                                                           | 1.5     | MV-W03-01  |
| MV-W03-07 | F-21    | test     | pgTAP + Playwright visit flow                                  | RLS matrix for 0013 incl. blocked visitor; Playwright: visit → kudos → guestbook → start offer.                                                                                                                                                | 2       | MV-W03-05  |
| MV-W03-08 | F-28    | ops      | Guidelines v2 + World report queue                             | Publish community guidelines v2 (07 §9) on the legal page; `/admin` reports queue handles garage/guestbook targets; host hide audit via events.                                                                                                | 1.5     | MV-W03-02  |
| MV-W03-09 | Docs    | ops      | Flip `world` + `world_shop` for founders                       | Flag audience = founders cohort; PROGRESS.md; demo script.                                                                                                                                                                                     | 0.5     | MV-W03-07  |

---

## Sprint W04 — W2a Earn engine & quests

**Goal.** Credits can be earned, with the ceiling, idempotency and expiry rules of 07 §3 enforced server-side, and daily/weekly quests give collectors a reason to open the app.

**Demo at end of sprint.** A founder completes three daily quests and the 7-day streak; the ledger shows `source=earned` rows; a replay of the event log yields identical quest progress; `earn_tokens` is not callable from the client.

**Ships to production.** Quests, streaks and the earn RPC deployed behind `world_earn` (OFF until W2b).

**Risks / watch-outs.** Earn must be a consumer of events, never a client call; the daily ceiling and FIFO earned-first spend need their own tests. Keep the quest pool small (6 + 6).

**Planned hours:** 17.5 (+2 stretch)

| ID        | Feature | Type     | Task                                    | What done looks like                                                                                                                                                                                                                                                              | Est (h) | Depends on |
| --------- | ------- | -------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W04-01 | F-26    | db       | Migration 0014 quests_seasons           | `quests` (seed 6 daily + 6 weekly), `quest_progress`, `seasons`, `season_points`; `earn_tokens()` SECURITY DEFINER callable only by service role / triggers, daily ceiling + idempotency key inside; `expire_earned_tokens()` job fn; FIFO earned-first in `spend_tokens`; pgTAP. | 3       | MV-W01-03  |
| MV-W04-02 | F-26    | backend  | domain/quests consumer + replay         | Rules in `domain/quests/rules.ts`; progress from `domain_events` (trigger for cheap rules, jobs batch for the rest); completion → earn + XP + `quest.completed`; Vitest proves replay determinism (same as F-13).                                                                 | 4       | MV-W04-01  |
| MV-W04-03 | F-26    | backend  | World XP rules + login streak           | Add visit/kudos/host/attend/race/quest XP rules to `domain/gamification`; daily first-open streak with the 7-day credit; caps per 04 F-13.                                                                                                                                        | 1.5     | MV-W04-02  |
| MV-W04-04 | F-26    | ops      | Jobs: quest reset + earned expiry       | `supabase/functions/jobs`: daily/weekly reset, earned-credit expiry at 180 d with a T-14 d notification, idempotent runs; Deno tests on pure helpers.                                                                                                                             | 2       | MV-W04-01  |
| MV-W04-05 | F-26    | frontend | Quests panel + streak                   | `/world` quests panel (3 daily / 3 weekly, D-045 progress fill), streak chip, completion toast + notification; empty/loading states.                                                                                                                                              | 3       | MV-W04-02  |
| MV-W04-06 | F-27    | frontend | /tokens World section + history reasons | 'What credits buy in the World' block on `/tokens`; `/tokens/history` renders world reasons and earned vs purchased; expiry notice for earned balance.                                                                                                                            | 1.5     | MV-W04-01  |
| MV-W04-07 | F-26    | test     | Earn rules tests                        | Vitest: ceiling, idempotency, FIFO earned-first, expiry; pgTAP: `earn_tokens` denied to `authenticated`.                                                                                                                                                                          | 2       | MV-W04-04  |
| MV-W04-08 | Docs    | docs     | PROGRESS + F-26 AC                      | Tick F-26 acceptance criteria; PROGRESS.md.                                                                                                                                                                                                                                       | 0.5     | MV-W04-07  |
| MV-W04-09 | F-26    | backend  | STRETCH: referral earn                  | `earn_referral` on the invitee's first garage open, capped, tied to existing `invites`.                                                                                                                                                                                           | 2       | MV-W04-02  |

---

## Sprint W05 — W2b Shop complete, season v0, economy dashboard

**Goal.** The shop sells the full launch catalogue (decor placement, tunes placeholder, consumables), one free season track runs, garage score exists, and the owner can see sinks vs sources weekly. `world_earn` turns ON for founders.

**Demo at end of sprint.** Founder earns a theme through quests, places decor, climbs the season track; `/admin › World › Economy` shows sinks ÷ sources and earned vs purchased for the week; an earn freeze stops a test account.

**Ships to production.** Full shop, season v0, garage score, economy dashboard, earn-freeze tooling; `world_earn` ON for founders.

**Risks / watch-outs.** Economy dashboard is SQL views, not a BI tool (D-027 'no dashboards with charts beyond Top Brands' — use tables). Garage score must be replayable like XP.

**Planned hours:** 17

| ID        | Feature | Type     | Task                            | What done looks like                                                                                                                                                                           | Est (h) | Depends on |
| --------- | ------- | -------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W05-01 | F-27    | frontend | Shop complete + decor placement | Item kinds (decor/theme/signage/consumable), level-locked and season-limited labels, earned-only visible but not purchasable, decor slots in the editor with placement validation.             | 3.5     | MV-W02-05  |
| MV-W05-02 | F-27    | backend  | Inventory + placement service   | `effect jsonb` schema, durable uniqueness, placement rules, `world.item_placed` events; Vitest.                                                                                                | 2       | MV-W05-01  |
| MV-W05-03 | F-26    | frontend | Season v0 page + rollover job   | Season page (theme, free track milestones, end date, progress); jobs: season rollover (freeze, award, reset) with determinism test.                                                            | 3       | MV-W04-04  |
| MV-W05-04 | F-26    | backend  | Garage score + World badges     | Score consumer (event increments + nightly recompute), leaderboard-ready; seed World achievements (first visit, host, 10 kudos, season finisher).                                              | 2       | MV-W04-02  |
| MV-W05-05 | F-28    | ops      | Economy dashboard (admin)       | `/admin › World › Economy`: sinks ÷ sources, earned vs purchased spend share, ceiling hit rate, balance distribution, expired credits — SQL views, plain tables, weekly review template in 06. | 2.5     | MV-W04-01  |
| MV-W05-06 | F-28    | ops      | Earn freeze + runbook           | Admin RPC to freeze/unfreeze earn per user (logged as `tokens.adjusted`-style event), `world_earn` audience as the global freeze; runbook 'earn exploit'.                                      | 1.5     | MV-W05-05  |
| MV-W05-07 | F-26    | test     | Playwright quest → earn → buy   | End-to-end: complete quest, see earned credits, buy decor, place it.                                                                                                                           | 1.5     | MV-W05-02  |
| MV-W05-08 | Docs    | ops      | Flip `world_earn` + docs        | Founders audience; PROGRESS.md; F-27 AC tick.                                                                                                                                                  | 1       | MV-W05-07  |

---

## Sprint W06 — W3a Virtual meetups — host, RSVP, live room

**Goal.** A collector schedules a meetup at their garage, others RSVP, and at start time a live room opens with chat, a showcase grid and host controls. The state machine is an RPC, the host fee is a platform fee.

**Demo at end of sprint.** A founder hosts a 'JDM night' with 8 RSVPs; the room goes live on schedule, three showcase cars each, host mutes a test account; reminders arrive at T-24h and T-1h.

**Ships to production.** Virtual meetups deployed behind `world_meetups` (OFF until W3b).

**Risks / watch-outs.** Reuse deal-chat components and channel pattern — no new chat stack. Capacity is tied to garage level, so the shop must already sell levels (it does).

**Planned hours:** 18

| ID        | Feature | Type     | Task                                   | What done looks like                                                                                                                                                                                                                                                                    | Est (h) | Depends on |
| --------- | ------- | -------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W06-01 | F-23    | db       | Migration 0015 clubs_meetups           | `clubs`, `club_members`, `meetups`, `meetup_rsvps`, `meetup_showcase`; messaging thread kind `meetup`; `transition_meetup(id, action)` (draft→scheduled→live→ended→cancelled; host fee via `spend_tokens`, refund on cancel ≥ 24 h before), `rsvp_meetup()`; notification types; pgTAP. | 3.5     | MV-W01-03  |
| MV-W06-02 | F-23    | backend  | domain/meetups service + state machine | `state.ts` like deals; capacity by host level (+50 % Pro), visibility (public/followers/club/invite), blocks, co-hosts; events `meetup.*`; Vitest on transitions.                                                                                                                       | 3.5     | MV-W06-01  |
| MV-W06-03 | F-23    | frontend | Meetup list, detail, create form       | `/world/meetups` (upcoming / mine / club), detail with RSVP + showcase picker (≤3 public cars), single-page create form (virtual section first; in-person section hidden until W5).                                                                                                     | 3.5     | MV-W06-02  |
| MV-W06-04 | F-23    | frontend | Live room                              | Realtime chat reusing deal-chat components, showcase grid, reactions, host mute/kick/end; room opens only in `live`; mobile-first at 360px.                                                                                                                                             | 3.5     | MV-W06-03  |
| MV-W06-05 | F-23    | ops      | Reminders + auto transitions           | Jobs: T-24h / T-1h notifications + Resend email, scheduled→live→ended transitions; idempotent.                                                                                                                                                                                          | 1.5     | MV-W06-01  |
| MV-W06-06 | F-23    | test     | pgTAP + Playwright meetup flow         | RLS for 0015 (host/attendee/outsider/blocked); Playwright: create → RSVP → room message.                                                                                                                                                                                                | 2       | MV-W06-04  |
| MV-W06-07 | Docs    | docs     | PROGRESS + F-23 AC                     | PROGRESS.md; acceptance criteria tick.                                                                                                                                                                                                                                                  | 0.5     | MV-W06-06  |

---

## Sprint W07 — W3b Best-in-show, clubs v1, hosting rules

**Goal.** Meetups end with a best-in-show result and XP/credits for attending and hosting; clubs exist with a clubhouse and club-hosted meetups; host eligibility and suspension rules are enforced. `world_meetups` + `world_clubs` turn ON for founders.

**Demo at end of sprint.** Founders' meetup: 10 attendees, best-in-show voted and frozen at end, attendees earn credits; a club is created, three members join, the club schedules a recurring club night.

**Ships to production.** Best-in-show, photo wall, clubs, club meetups, hosting rules; `world_meetups` + `world_clubs` ON for founders.

**Risks / watch-outs.** Clubs can move to W6 if W3a slips (07 §14 question for Varun). Host eligibility rules must read upheld reports, so the S6 reports resolution fields are a dependency.

**Planned hours:** 15.5 (+2 stretch)

| ID        | Feature | Type     | Task                                                   | What done looks like                                                                                                                                                          | Est (h) | Depends on |
| --------- | ------- | -------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W07-01 | F-23    | backend  | Best-in-show + photo wall + attend/host rewards        | One vote per attendee, frozen at `ended`; results card; photo wall as `media` rows; attendance = joined room ≥ 10 min → `earn_attend`; host with ≥ 5 attendees → `earn_host`. | 3       | MV-W06-04  |
| MV-W07-02 | F-22    | backend  | domain/clubs service                                   | Create (slug citext), join modes (open/apply/invite), roles, member management, bans, blocks; events `club.*`; Vitest.                                                        | 2.5     | MV-W06-01  |
| MV-W07-03 | F-22    | frontend | Club page + create/join                                | Clubhouse: members' featured cars grid, feed (recent events), upcoming meetups; create club form; join/apply/invite; member list with roles.                                  | 3.5     | MV-W07-02  |
| MV-W07-04 | F-22    | frontend | Club meetups + recurring club night                    | Host a meetup as a club; recurring template spawns instances via jobs; club visibility mode on meetups.                                                                       | 2       | MV-W07-03  |
| MV-W07-05 | F-28    | ops      | Host eligibility + suspension                          | Host requires F-13 level ≥ 2 and no upheld report in 90 d; two upheld reports → hosting suspended (event + notification); admin meetup/club queues; appeal note field.        | 2       | MV-W07-01  |
| MV-W07-06 | F-22    | test     | Playwright club flow + pgTAP                           | Create club → join → club meetup; RLS for club roles.                                                                                                                         | 1.5     | MV-W07-04  |
| MV-W07-07 | Docs    | ops      | Flip `world_meetups` + `world_clubs`; founders' meetup | Founders audience; run the first real meetup as the demo; PROGRESS.md; F-22/F-23 AC.                                                                                          | 1       | MV-W07-06  |
| MV-W07-08 | F-22    | frontend | STRETCH: club leaderboard                              | Club ranking by members' garage score (plain table).                                                                                                                          | 2       | MV-W05-04  |

---

## Sprint W08 — W4a Racing core — stats, time trial, challenge, replay

**Goal.** Cars race in a seeded, server-side simulation: stats from catalogue segment, condition, rarity, tunes and driver level with a 10 % cap on paid/level influence; time trials and head-to-head challenges run and replay from the seed.

**Demo at end of sprint.** Same seed → identical result in CI; a founder beats a ghost time, challenges another founder, both watch the replay; an unmatched car races with the neutral archetype.

**Ships to production.** Racing core deployed behind `world_races` (OFF until W4b).

**Risks / watch-outs.** Stats model must be versioned from day one (results pin a version); `catalog_models.segment` is admin-curated and sparse at first — the neutral archetype must feel fair. No wagering language anywhere.

**Planned hours:** 18.5

| ID        | Feature | Type     | Task                             | What done looks like                                                                                                                                                                                                                                                                                              | Est (h) | Depends on |
| --------- | ------- | -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W08-01 | F-25    | backend  | Stats module v1                  | `domain/races/stats.ts`: archetype from `catalog_models.segment` (sports/muscle/exotic/truck/classic/fantasy/neutral), scale factor, condition → reliability, rarity bonus, tunes + driver level combined cap ≤ 10 % (test asserts it), seeded RNG (xorshift from seed + entry order); `race_stats_versions` pin. | 4       | —          |
| MV-W08-02 | F-25    | db       | Migration 0016 races             | `catalog_models.segment` (nullable enum), `race_stats_versions`, `races`, `race_entries`, `race_results` (no update/delete policies), season link; `enter_race()` (ownership + public + fee via `spend_tokens` with `spend_race_entry`), `lock_race()` sets seed; pgTAP incl. immutability.                       | 3       | MV-W08-01  |
| MV-W08-03 | F-25    | backend  | Edge `run-race` + scheduler      | Deno function: lock → derive seed → simulate (pure `lib.ts`) → write results once → emit `race.completed`; jobs trigger at `scheduled_at`; Deno tests on the pure sim; idempotent on race id.                                                                                                                     | 3.5     | MV-W08-02  |
| MV-W08-04 | F-25    | frontend | Race hub: time trial + challenge | `/world/races`: time trial vs ghost best (free), challenge a handle (free, accept/decline like offers), my races, results list; respects 'who can challenge me'.                                                                                                                                                  | 3.5     | MV-W08-03  |
| MV-W08-05 | F-25    | frontend | Replay viewer                    | Lane progress view rendered from seed + stats version (D-045 progress-fill motion), breakdown panel (why this car won), share result card.                                                                                                                                                                        | 2.5     | MV-W08-04  |
| MV-W08-06 | F-25    | test     | Determinism + immutability tests | Vitest: same seed/stats version → same result across runs; pgTAP: results cannot be updated even by owner; Playwright time trial.                                                                                                                                                                                 | 1.5     | MV-W08-05  |
| MV-W08-07 | Docs    | docs     | PROGRESS + F-25 AC               | PROGRESS.md; acceptance criteria tick.                                                                                                                                                                                                                                                                            | 0.5     | MV-W08-06  |

---

## Sprint W09 — W4b Race events, trophies, season points

**Goal.** Hosted bracket events (8/16 cars) with a platform entry fee, cosmetic prizes only, live ticker, season points, tunes in the shop and dispute tooling. Counsel's read of the racing posture is recorded. `world_races` turns ON for founders.

**Demo at end of sprint.** A 16-car bracket at a founder's garage runs round by round on prod, spectators watch the ticker, the winner gets a trophy item and a title; admin re-runs a round from its seed and gets the same result.

**Ships to production.** Bracket events, trophies/titles, ticker, tunes, dispute tooling; `world_races` ON for founders.

**Risks / watch-outs.** This is where the India Online Gaming Act exposure lives: entry fee is a platform fee and prizes are cosmetic — the rules engine must make a 'paid entry → credit reward' path impossible, with a test.

**Decisions locked this sprint:** Counsel confirmation of 07 §3 racing posture logged as a D-row

**Planned hours:** 16.5 (+2 stretch)

| ID        | Feature | Type     | Task                                    | What done looks like                                                                                                                                                                       | Est (h) | Depends on |
| --------- | ------- | -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------- |
| MV-W09-01 | F-25    | frontend | Bracket events                          | Create event at garage/club (capacity 8/16, fee from data), lock at capacity/time, rounds run by the scheduler, bracket view, entrants list; host cancel → fee refunds.                    | 4       | MV-W08-03  |
| MV-W09-02 | F-25    | backend  | Prizes: trophies, titles, season points | Trophy items are earned-only inventory; titles on profile/garage; season points consumer on `race.completed`; badge progress; a test asserts no credit reward exists for paid-entry races. | 2.5     | MV-W09-01  |
| MV-W09-03 | F-25    | frontend | Live ticker + spectator page            | Realtime broadcast of round results, spectator view, `race_result` notifications.                                                                                                          | 2.5     | MV-W09-01  |
| MV-W09-04 | F-27    | frontend | Tunes in shop + eligibility hints       | Tune items with `effect jsonb` (cap enforced server-side), 'accept the catalogue match to race with real stats' hint on unmatched items (links to S3 match flow).                          | 2       | MV-W05-01  |
| MV-W09-05 | F-28    | ops      | Dispute tooling                         | Admin: re-run race from seed, stats version shown per race, cancel-with-refund; runbook 'race ran twice'.                                                                                  | 1.5     | MV-W09-02  |
| MV-W09-06 | F-25    | test     | Playwright bracket + pgTAP              | Bracket end-to-end with mocked scheduler time; RLS for entries/results.                                                                                                                    | 2       | MV-W09-03  |
| MV-W09-07 | Legal   | docs     | Racing posture copy review + D-row      | Counsel confirmation of 07 §3/§10 recorded via /decide; copy audit for wagering language ('win', 'prize', 'stake') across race screens and terms.                                          | 1       | MV-W09-02  |
| MV-W09-08 | Docs    | ops      | Flip `world_races` + docs               | Founders audience; PROGRESS.md; F-25 AC.                                                                                                                                                   | 1       | MV-W09-06  |
| MV-W09-09 | F-26    | frontend | STRETCH: season league standings        | Monthly league table from `season_points` (plain table).                                                                                                                                   | 2       | MV-W09-02  |

---

## Sprint W10 — W5 In-person meetups

**Goal.** Collectors can list a real-world meetup with approximate location, RSVP, see the venue only once confirmed, check in for XP, and report problems. The platform is a listing service with safety rules, never the organiser.

**Demo at end of sprint.** A UAE founder lists a public-venue meetup; the public page shows city + area only; a confirmed attendee sees the venue; host checks attendees in; an under-18 or suspended host cannot create one.

**Ships to production.** In-person meetups behind `world_meetups_irl` ON for UAE founders first (country audience), India after the IT-Rules/grievance review.

**Risks / watch-outs.** Privacy of venue data (RLS to confirmed RSVPs only, tested); liability posture in copy; hosts may try to collect money in chat — guidelines + report path, no payment features.

**Planned hours:** 16

| ID        | Feature | Type     | Task                                            | What done looks like                                                                                                                                                                                 | Est (h) | Depends on |
| --------- | ------- | -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W10-01 | F-24    | db       | Migration 0017 meetups_irl                      | `meetups.kind = in_person` fields: `city`, `area_text`, `venue_private` (select policy = host or `checked_in/going` RSVP), `host_agreement_accepted_at`, check-in columns; pgTAP visibility matrix.  | 2       | MV-W06-01  |
| MV-W10-02 | F-24    | backend  | IRL rules service                               | Host must be 18+ confirmed + eligible; public fields pass a no-address validator; check-in (host confirms) → XP + `earn_attend`; cancellation notifications; events `meetup.checked_in`.             | 2.5     | MV-W10-01  |
| MV-W10-03 | F-24    | frontend | Create (in-person section) + listing + detail   | Same single-page form, in-person section (city/area, date, capacity, host rules, safety agreement checkbox); listing with safety banner; venue reveal for confirmed; RSVP + waitlist.                | 3.5     | MV-W10-02  |
| MV-W10-04 | F-24    | frontend | Host check-in + photo wall + report             | Host attendee list with check-in, post-event photo wall, report meetup/host, 'TinyTorque is not the organiser' disclaimer placement.                                                                 | 2.5     | MV-W10-03  |
| MV-W10-05 | F-28    | ops      | IRL guidelines, admin queue, insurance question | Guidelines IRL section (public venues, 18+, no alcohol, no money via platform, permits are the host's); admin IRL queue with 24 h first-action SLA; insurance/liability question logged for counsel. | 2       | MV-W10-02  |
| MV-W10-06 | F-24    | test     | pgTAP venue visibility + Playwright             | Matrix: host / going / waitlist / declined / outsider / blocked; Playwright list → RSVP → check-in.                                                                                                  | 2       | MV-W10-04  |
| MV-W10-07 | Docs    | ops      | Flip `world_meetups_irl` for UAE founders       | Country audience AE; PROGRESS.md; F-24 AC.                                                                                                                                                           | 1       | MV-W10-06  |
| MV-W10-08 | Docs    | docs     | PROGRESS + runbook                              | Runbook 'IRL incident report' path; PROGRESS.md.                                                                                                                                                     | 0.5     | MV-W10-07  |

---

## Sprint W11 — W6a Leaderboards, live-ops tooling, cost guards

**Goal.** Everything the owner needs to run seasons without code changes: leaderboards, labelled Spotlight, concurrency caps and cost alerts, moderation SLA view, season rollover end to end, admin World tools.

**Demo at end of sprint.** Season 1 rolls over on prod: leaderboards freeze, trophies are awarded, season 2 opens; `/admin` shows report age vs SLA and Realtime usage against plan limits.

**Ships to production.** Leaderboards, Spotlight, season rollover, admin World tools, cost alerts.

**Risks / watch-outs.** Leaderboards are materialised views refreshed by a job, never live queries; Spotlight must be labelled (01 §7, D-022) and is a consumable, not a ranking boost.

**Planned hours:** 18

| ID        | Feature | Type     | Task                                      | What done looks like                                                                                                                                | Est (h) | Depends on |
| --------- | ------- | -------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W11-01 | F-28    | db       | Migration 0018 world_ops                  | Materialised views: garage score, race wins, attendance (country/global/season); `world_spotlights` consumable; refresh job; pgTAP for public read. | 2.5     | MV-W05-04  |
| MV-W11-02 | F-21    | frontend | Leaderboards + Spotlight                  | `/world/leaderboards` (plain tables, country/global/season tabs); labelled Spotlight slot on 'Open garages' bought via `spend_spotlight`.           | 2.5     | MV-W11-01  |
| MV-W11-03 | F-28    | ops      | Concurrency caps + cost alerts            | Live meetups per hour cap by flag audience, Realtime/Edge/storage usage alerts at 70 % of plan, cost panel in `/admin`.                             | 2.5     | MV-W06-05  |
| MV-W11-04 | F-28    | ops      | Moderation SLA view + appeals             | Report age vs 24 h / 72 h SLA table, appeal note flow on resolved reports, host suspension automation audit.                                        | 2.5     | MV-W07-05  |
| MV-W11-05 | F-26    | backend  | Season rollover end to end + club leagues | Freeze leaderboards, award season trophies/titles, reset points, open next season from a seed row; club league points; determinism test.            | 3       | MV-W11-01  |
| MV-W11-06 | F-28    | frontend | Admin World tools                         | Buttons on existing admin pages: revoke item, earn freeze, cancel meetup with refund, re-run race, suspend host; each logs an event.                | 2.5     | MV-W09-05  |
| MV-W11-07 | F-28    | test     | Rollover + views tests                    | pgTAP for views and spotlight; Vitest rollover determinism.                                                                                         | 1.5     | MV-W11-05  |
| MV-W11-08 | Docs    | docs     | Runbooks + weekly review template         | 06: live-ops calendar, weekly economy review, moderation SLA, season rollover checklist.                                                            | 1       | MV-W11-07  |

---

## Sprint W12 — W6b Hardening & first public season

**Goal.** Full RLS matrix and critical-flow Playwright for the World, performance and six-theme visual review of every screen, legal v2 live, backups and kill-switch drills, then the first season opens to the whole pilot cohort.

**Demo at end of sprint.** Season 1 opens to the full cohort with a founders' launch meetup; all six World Playwright flows green in CI; terms v2 acceptance recorded on sign-in; a flag flip hides the World within one request.

**Ships to production.** World open to the full pilot cohort (all `world*` flags except `world_presence`); terms/privacy/guidelines v2 live; KPI dashboards; incident runbooks rehearsed.

**Risks / watch-outs.** This sprint has 3 h buffer for carry-over; if W4b or W5 slipped, launch with racing or IRL meetups still founders-only rather than cutting hardening.

**Planned hours:** 18.5 (+3 stretch)

| ID        | Feature | Type     | Task                                         | What done looks like                                                                                                                                                | Est (h) | Depends on |
| --------- | ------- | -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| MV-W12-01 | F-28    | test     | Full World RLS matrix + critical flows       | pgTAP across all 0012–0018 tables (owner/visitor/attendee/member/blocked/anon/admin); six Playwright World flows in CI on every preview.                            | 3       | MV-W11-07  |
| MV-W12-02 | F-20    | frontend | Performance + six-theme visual review        | Garage page SSR + cached scene JSON, image budgets, p95 < 2.5 s on 4G; D-056 visual review of all 13 screens × 6 themes at 360/1280 against the design pack; fixes. | 3.5     | MV-W11-02  |
| MV-W12-03 | F-28    | ops      | KPI funnels + economy SQL                    | PostHog funnels for 07 §11 KPIs; §3.4 metrics as saved SQL in the admin dashboard; weekly review scheduled.                                                         | 2       | MV-W11-08  |
| MV-W12-04 | Legal   | ops      | Terms / privacy / guidelines v2 live         | Counsel-approved v2 published; version bump forces re-acceptance (event); DPDP/PDPL consent copy; grievance contact on the legal page.                              | 2       | MV-W09-07  |
| MV-W12-05 | F-28    | ops      | Backup/restore drill + kill-switch rehearsal | Restore drill covering World tables on staging; rehearse `world_shop` + `world_earn` freeze and per-flag kill within a sprint demo; incident runbooks reviewed.     | 2       | MV-W12-01  |
| MV-W12-06 | F-26    | ops      | Launch: season 1 to the cohort               | Seed season 1, founders' launch meetup, flag audiences widened to the pilot cohort, in-app announcement + email; day-1 metrics check.                               | 2       | MV-W12-04  |
| MV-W12-07 | Docs    | docs     | Plan docs close-out                          | PROGRESS.md; 02 §8 updated (engine decision still deferred, presence/3D in the later register); 07 marked 'in execution' with deviations logged.                    | 1       | MV-W12-06  |
| MV-W12-08 | Buffer  | ops      | Carry-over buffer                            | Reserved for slips from W4b/W5/W6a.                                                                                                                                 | 3       | —          |
| MV-W12-09 | F-21    | frontend | STRETCH: presence prototype                  | Supabase Realtime Presence 'who is here' on garage pages behind `world_presence`, founders only, connection-count guard.                                            | 3       | MV-W03-03  |

---
