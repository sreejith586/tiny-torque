# 06 — Engineering Standards & Development Contract

> Status: DRAFT v1 — 2026-09-27. This is the contract between you and Claude Code (and anyone who joins later). `CLAUDE.md` at repo root is the short, always-loaded version of this document; this file is the reference.

---

## 1. Working agreement with Claude Code

1. **One task, one branch, one PR.** Branch `mv/S{n}-{id}-{slug}` (e.g. `mv/S2-04-garage-service`). PR title `[MV-S2-04] Garage domain service`. Claude Code never merges; you review and squash-merge.
2. **Plan before code.** For any task ≥ 2 h, Claude Code first writes a 5–10 line plan in the PR description (files touched, migration yes/no, tests to add) and waits for your "go". Smallest safe change first; no drive-by refactors outside the task's files.
3. **Order inside a task:** migration → `supabase gen types` → domain `schema.ts`/`types.ts` → `repo.ts` → `service.ts` + Vitest → UI → Playwright (if critical flow) → docs touch.
4. **Never** paste SQL into the Supabase dashboard. Every schema change is a migration file. Never edit an applied migration; add a new one.
5. **Never** call Supabase from a component or route file. Only `domain/*/repo.ts` and `lib/supabase/*` import `@supabase/*` (ESLint enforces).
6. **Every user-facing string** goes through `lib/i18n/t()` with an `en.json` key (no translations yet — this keeps i18n non-breaking later).
7. **Reversibility flag in every PR:** `Reversible: yes | no — why` (irreversible = data migration that drops/transforms columns, region/provider choices, public URL shapes, pricing).
8. **Ask, don't assume,** when a spec (04) and the prototype disagree; record the answer in the spec.
9. **Stop conditions:** failing CI, a missing decision, or scope creep beyond the task → stop and report; do not "helpfully" continue.
10. **Decision log is binding.** `docs/plan/DECISIONS.md` is append-only; every session reads it; contradicting an `accepted` row is a regression → stop and ask. New decisions get a row in the same PR. `tools/guard.sh` runs in CI and pre-push.
11. **State lives in `docs/plan/PROGRESS.md`, not in chat.** Read first, update last, every session (protocol in CLAUDE.md). One task per session. Compact context only after PROGRESS.md is current.
12. **UX fidelity to Varun's prototype (D-027).** Same 6 themes (exact token values), same screens, flows, copy tone and interaction patterns. shadcn provides accessible primitives restyled to those tokens — nothing visually new. No complex components (data grids, kanban, command palettes, multi-step wizards, chart dashboards beyond Top Brands). Deviations need Varun's sign-off logged in DECISIONS.md.

## 2. Repository layout & conventions

```
mini-vault/
  CLAUDE.md                 short project memory for Claude Code (kept < 200 lines, includes session protocol)
  docs/plan/                these documents + DECISIONS.md (append-only) + PROGRESS.md (session state) + tools/guard.sh
  docs/adr/                 long-form ADRs (ADR-14+) when a DECISIONS.md row needs more than one line
  src/app/                  routes only (page.tsx, layout.tsx, loading.tsx, error.tsx, actions.ts)
  src/domain/<module>/      types.ts · schema.ts (zod) · service.ts · repo.ts · index.ts · __tests__/
  src/components/ui/        shadcn (generated, don't hand-edit beyond tokens)
  src/components/<area>/    feature components (client or server, marked)
  src/lib/                  supabase/{client,server,middleware}.ts · analytics.ts · flags.tsx · image.ts · money.ts · i18n/
  src/types/supabase.ts     GENERATED — never edit
  supabase/migrations/      NNNN_name.sql
  supabase/functions/       ai-scan/ stripe-webhook/ jobs/ (Deno; shared/ for common code)
  supabase/tests/           pgTAP RLS tests, one file per migration
  supabase/seed/            seed.sql + csv loaders (countries, packs, brands, castings, flags)
  e2e/                      Playwright specs + fixtures
```

Naming: tables/columns `snake_case`; TS `camelCase`; enums as Postgres enums mirrored by zod enums in `schema.ts`; route segments kebab-case; components PascalCase; server actions in `actions.ts` next to the route, thin, calling services.

## 3. Code standards

- TypeScript `strict`, `noUncheckedIndexedAccess`, no `any` (use `unknown` + zod).
- Zod at every boundary: server action input, route handler input, Edge Function body, CSV rows, AI model output.
- Services return `Result<T, DomainError>`-style discriminated unions for expected failures (quota exceeded, limit reached, invalid transition); throw only for bugs.
- Money: integer minor units in TS (`fils`/`paise`) with `currency`; `numeric(12,2)` in DB; format via `lib/money` with `Intl.NumberFormat`.
- Dates: `timestamptz` in DB, ISO strings over the wire, `Temporal`/`date-fns` in TS; display in user's locale.
- Images: never `<img>`; always `<MediaImage>` (transforms + signed URLs).
- Styling: Tailwind semantic tokens only (`bg-panel`, `text-cream`…); no hex in components; theme extras via `.theme-3d` / `.theme-leather` selectors in `globals.css`.
- UI vocabulary is closed (D-027): card, list row, bottom nav, top bar, sheet (bottom on mobile), dialog, toggle row, select, chips, photo carousel, toast, empty state, skeleton. Adding a new pattern is a decision, not a task.
- Accessibility: every interactive element keyboard reachable; dialogs/sheets from shadcn (focus trap built in); `aria-label` on icon buttons.
- Analytics: `track('event.name', props)` from `lib/analytics` only; event names mirror `domain/events` catalogue.

## 4. Testing standards

| Layer | Tool | Rule |
|---|---|---|
| Domain rules | Vitest | Every `service.ts` rule has a test; repo mocked; ≥ 80 % line coverage on `domain/` |
| Schemas | Vitest | zod schemas: valid + invalid fixtures |
| RLS | pgTAP (`supabase test db`) | One file per migration; owner/stranger/anon/admin matrix; runs in CI |
| RPCs/triggers | pgTAP | Listing limit, offer transitions incl. concurrency, token idempotency & balance property |
| Edge Functions | Deno test | Mocked `fetch`; fixtures for Anthropic + Stripe payloads |
| Critical flows | Playwright | sign-in, add item, scan (mocked fn), publish, offer→accept→sold, chat, buy tokens (Stripe test) — run on every PR preview |
| Visual/theme | Playwright screenshots | Route × theme × width matrix from S9; diff threshold 0.2 % |
| Accessibility | axe-playwright | No serious/critical violations |
| Performance | Lighthouse CI | Budgets: perf ≥ 90, a11y ≥ 90 on staging, mobile profile |

## 5. Environments, release & rollback

- **Envs (D-033):** `local` (`supabase start`, or `scripts/db-validate.sh` without Docker) · `preview` = Vercel preview + Supabase **preview branch** per PR (migrations, `seed.sql`, `config.toml` applied automatically; keys injected by the Supabase↔Vercel integration) · `prod` = the single hosted Supabase project (Pro) + Vercel production from `main`. No staging project. Separate Stripe modes; PostHog projects per env.
- **Cadence (D-028):** production deploy every sprint end (Sunday after the demo, which itself runs on prod). Incomplete work ships dark behind its flag. If the sprint's increment isn't safely deployable by Saturday, cut scope to what is — never skip the deploy.
- **Release checklist (prod):** PR checks + preview e2e green → merge to `main` → Supabase GitHub integration applies the PR's migrations to prod on merge (or `supabase db push` manually if the integration's prod sync is off — pick one, never both) → Vercel builds `main` → smoke on prod (sign-in, browse, garage) → flags set → announce. Irreversible migrations ship in two releases: add-and-backfill, then drop.
- **Rollback:** Vercel promote previous deployment (seconds). DB: forward-fix migration preferred; destructive changes only after the two-release rule, so previous app version keeps working.
- **Kill switches:** `ai_scan`, `offers`, `deal_chat`, `token_purchase`, `csv_import`, `marketplace_publish`, `invite_only` — documented in admin Flags with owner and effect.
- **Secrets:** Vercel + Supabase secrets only; rotation procedure in runbook; service-role key never in Next.js runtime.

## 6. Observability

Sentry (errors + performance traces, release tagging from commit SHA), PostHog (product), Vercel Analytics (web vitals), Supabase logs (Edge + Postgres), pg_cron run log table. Alerts: Sentry new-issue + spike → email/Slack; Anthropic spend threshold (daily check job) → email; Supabase usage 80 % → email.

## 7. Documentation rules

- `CLAUDE.md`: what the project is, the session protocol, the working rules, module map, commands, current sprint, do/don't. Updated in the docs step of every task that changes structure.
- `docs/plan/DECISIONS.md`: append-only decision log (D-xxx). `docs/plan/PROGRESS.md`: session hand-off state (≤ 120 lines).
- `docs/adr/ADR-NNN-title.md` for any new decision (template: context, decision, alternatives, reversibility, consequences).
- `docs/plan/04-feature-specs.md` is living; behaviour changes update it in the same PR.
- `docs/runbook.md` from Sprint 10.
- No other prose docs; comments explain *why*, not *what*.

## 8. Sprint rituals (solo-friendly)

- **Monday (30 min):** lock sprint from `05-sprint-plan.md`; create branch list; note any dependency not yet on staging.
- **Daily (5 min):** update task status in Jira (or the CSV → your Jira import) — Claude Code can draft the standup from commits.
- **Sunday (45 min):** demo to Varun on staging against the sprint's "Demo" line; retro three bullets; carry-over goes to next sprint or S11 buffer — never silently extends the current sprint.
