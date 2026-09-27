# Mini Vault — project memory for Claude Code

> DRAFT — activate by moving to repo root as CLAUDE.md when Sprint 0 starts. Keep under 200 lines (guard.sh enforces). Long-form lives in `docs/plan/`.

## What this is
Diecast car collector platform: personal garage (manual / AI scan / CSV), public profiles, marketplace with offers & trades settled **offline**, token economy (Stripe one-time packs) funding AI scans and Pro. Pilot: invited collectors in **UAE + India**. Long-term: collectors' garages become a shared multiverse — we are NOT building that now, only keeping the data model ready (canonical catalogue, event log, domain layer, media rows).

Handover from Varun (design + Phase-1 Next.js/Supabase prototype). Owner/CTO: Sreejith. Solo builder + Claude Code, 1-week sprints.

## Session protocol — do this every session, in this order (D-023)
**Start**
1. Read `docs/plan/PROGRESS.md` (state, active task, blockers, next action).
2. Read `docs/plan/DECISIONS.md` — at least the ID + Decision columns. It is append-only and binding.
3. Read ONLY the task row in `docs/plan/05-sprint-plan.md` and the F-xx section in `04-feature-specs.md` / table section in `03-data-model.md` that the task touches. Do not read whole docs; use grep for the rest.
4. Reply with: task ID, the D-xxx rows this task touches, files you will change, migration yes/no, tests you will add. Wait for "go".

**During**
- One task per session. If a second task is unavoidable, finish and hand off the first (update PROGRESS.md) before starting.
- Before touching anything an accepted D-xxx covers: quote the ID and confirm. Contradicting one = stop, don't work around it.
- At natural checkpoints (migration applied, tests green) update PROGRESS.md **then** compact context; the summary must carry task ID, D-xxx touched, files changed, what's left.
- Reference files by path; never paste whole files into chat. Prefer targeted reads (`grep -n`, line ranges).
- If a spec (04) and Varun's prototype disagree, or a decision is missing → stop, write the question into PROGRESS.md › Blockers, ask.

**End**
1. Update `docs/plan/PROGRESS.md`: task board status, last session, next action, blockers, session log row (keep ≤ 5 rows).
2. If any decision was made, append a row to `docs/plan/DECISIONS.md` (never edit old rows; bump "Next ID").
3. Run `bash docs/plan/tools/guard.sh`; fix or explain failures in the PR.
4. Docs travel in the same PR as the code.
5. On sprint-end sessions: run the release checklist (06 §5), promote to prod, record prod version + date in PROGRESS.md.

## Read first (reference, not every session)
`05-sprint-plan.md` sprints/tasks · `04-feature-specs.md` rules & AC · `03-data-model.md` schema & migrations · `02-architecture-blueprint.md` ADRs · `06-engineering-standards.md` full contract.

## Stack (D-004)
Next.js 16 (App Router, RSC, Server Actions) · React 19 · TypeScript strict · Tailwind 4 + shadcn/ui **primitives only**, restyled to Varun's 6 theme token sets on `[data-theme]` · Supabase (Postgres+RLS, Auth phone/email OTP, Storage private buckets, Realtime, Edge Functions Deno) · zod · TanStack Query (client lists only) · Vitest · pgTAP · Playwright · Sentry · PostHog · Stripe Checkout · Anthropic vision (Edge Function `ai-scan`). Region ap-south-1 / Vercel bom1 (D-005).

## Non-negotiable rules (each maps to a DECISIONS.md row)
1. One task → one branch `mv/S{n}-{id}-{slug}` → one PR titled `[MV-Sn-nn] …`. Never merge; Sreejith reviews. (D-002, D-020)
2. Task ≥ 2 h: short plan in the PR first, wait for "go". (D-020)
3. Order: migration → `pnpm gen:types` → domain schema/types → repo → service + Vitest → UI → Playwright (critical flows) → docs. (D-020)
4. Schema changes ONLY as `supabase/migrations/NNNN_name.sql`. Never edit an applied migration. Destructive changes ship in two releases. (D-006)
5. `@supabase/*` imports only in `src/domain/*/repo.ts` and `src/lib/supabase/*`. Components/routes call `domain/*/service` only. (D-007)
6. zod at every boundary (actions, route handlers, Edge bodies, CSV rows, AI output). (D-013)
7. Entitlements asked ONLY via `domain/entitlements`; DB triggers/RPCs are the backstop. (D-003, D-021)
8. Offer status changes ONLY via RPC `transition_offer`; token balance ONLY via RPC `spend_tokens` / Stripe webhook. (D-021)
9. Every service mutation emits a `domain_events` row; XP/badges/notifications consume events. (D-009)
10. Money, messaging, AI, ranking features sit behind a feature flag. (D-018)
11. User-facing strings via `t()` keys in `src/lib/i18n/en.json`.
12. **UX fidelity (D-027):** Varun's prototype is the visual and interaction reference — 6 themes with the exact `theme.ts` values, same screens, same flows, same copy tone. Build with the existing patterns (cards, sheets, bottom nav, toggles, carousels). Do NOT introduce new complex components (data grids, kanban, command palettes, multi-step wizards beyond what the prototype has, dashboards with charts beyond Top Brands). shadcn = accessible primitives restyled to tokens, nothing more. A screen that deviates needs Varun's sign-off logged in DECISIONS.md.
13. Tailwind semantic tokens only (`bg-panel`, `text-cream`, `border-border`…). No hex in components. Check work in all 6 themes at 360px + 1280px. (D-027)
14. `<MediaImage>` for all images; store storage *paths*, never full URLs. (D-010)
15. Never expose `profiles.mobile` or any PII to other users; read others via `public_profiles` view.
16. Stop and report on: failing CI, missing decision, scope beyond the task, spec vs prototype conflict, any D-xxx conflict. (D-023)
17. **Every sprint ends with a production deploy (D-028).** Build so the increment is deployable dark: flag first, feature second. Never leave `main` in a state that cannot be promoted to prod.

## Commands
```
pnpm dev · pnpm build · pnpm lint · pnpm typecheck
pnpm test            # vitest
pnpm test:e2e        # playwright (needs BASE_URL)
pnpm gen:types       # supabase gen types → src/types/supabase.ts
bash docs/plan/tools/guard.sh        # decision guard (also in CI)
python3 docs/plan/tools/render.py    # regenerate 05-sprint-plan.md + backlog.csv from backlog.json
supabase start | stop | db reset | db diff -f <name> | test db
supabase functions serve ai-scan --env-file supabase/.env.local
```

## Module map
`src/domain/{identity,garage,catalog,ai,marketplace,deals,messaging,tokens,entitlements,gamification,trust,flags,events}` · routes in `src/app/{(auth),garage,market,offers,deals,profile,u/[handle],settings,tokens,admin,api}` · Edge: `supabase/functions/{ai-scan,stripe-webhook,jobs}`.

## Definition of Done (short)
Migration on local+staging with pgTAP · deployable to prod dark behind its flag · service Vitest · UI in 6 themes with loading/empty/error, matching prototype · events emitted · flag if risky · Playwright updated for critical flows · guard.sh + CI green · PROGRESS.md updated · docs touched · reviewed by Sreejith.

## Current sprint
S0 — Foundation (see PROGRESS.md for the live board). Update this line at each sprint lock.

## Don't
- Don't add H2/H3 features (promoted listings, ranking boosts, 3D, presence) — stretch register only. (D-017)
- Don't paste SQL in the dashboard. Don't write `photos` jsonb after migration 0004. Don't use service-role key in Next.js.
- Don't refactor outside the task's files. Don't "improve" Varun's UX or invent components. Don't "fix" prototype behaviour without a spec change.
- Don't rely on chat memory for state — if it isn't in PROGRESS.md or DECISIONS.md, it didn't happen.
