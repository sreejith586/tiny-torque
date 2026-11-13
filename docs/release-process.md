# Release process and dry run (MV-S10-07, F-19)

How a sprint goes from `staging` to production, the gate in front of the database step, and the rehearsal that proves rollback works. Decisions behind it: D-028 (prod deploy every sprint), D-035 / D-039 (PR `staging → main`, merge commit), D-050 (`db-migrate.yml` applies migrations on push), D-006 (forward-only migrations). Roles: **only Sreejith merges, promotes, pushes to `staging` / `main` and touches secrets.**

## 1. What happens on a promotion

1. PR `staging → main` is merged with **Create a merge commit**.
2. The push to `main` triggers, in parallel: `db-migrate.yml` (`supabase db push --include-all` against prod), CI on `main`, and the Vercel production build.
3. Vercel serves the new build when it finishes — usually **after** the migrations have applied, but that order is not guaranteed.

Because of step 3 every release must hold in both orders: new code on old schema for a minute, and old code on new schema. That is why migrations are additive and features ship behind flags (CLAUDE.md rules 4, 10, 17).

## 2. Promotion checklist — the gate before `db push`

Copy into the promotion PR body and tick every line. If a line cannot be ticked, do not merge.

**Before merging `staging → main`**

- [ ] Every sprint PR is merged into `staging`; `staging` CI is green (checks, lighthouse, migrations + gen-types drift, pgTAP).
- [ ] Preview / staging Playwright smoke is green on the last `staging` deployment.
- [ ] `git diff origin/main..origin/staging --stat -- supabase/migrations` reviewed: every file is **new** (none modified), timestamps are later than the last one applied to prod, names of the two tracks do not collide.
- [ ] Each new migration is classed: _additive_ (table / column / function / index / policy) or _behavioural_ (replaces a function, policy, trigger or constraint the running app depends on). Behavioural ones have a pgTAP test and a note on what the previous app version does against them.
- [ ] No destructive statement (`drop table`, `drop column`, `alter … type`, `delete` without a marker) unless this is the second release of a two-release change and the first has been on prod ≥ 1 sprint.
- [ ] `staging` has run these migrations for at least one deploy (`db-migrate.yml` on `staging` green) and the app worked on top of them.
- [ ] New flags are seeded OFF; nothing user-facing turns on by merging.
- [ ] New secrets / env vars the release needs are already set in Vercel (Production) and Supabase Edge secrets — a deploy never waits on a secret.
- [ ] Edge Functions changed? (`git diff origin/main..origin/staging --stat -- supabase/functions`) → deploy them right after the merge: `supabase functions deploy <name> --project-ref whjqwcaoexbytspkaxfh` (`jobs` and `stripe-webhook` with `--no-verify-jwt`).
- [ ] Last good production deployment noted (Vercel deployment id) — the rollback target.
- [ ] A quiet hour, and 30 minutes free afterwards.

**After merging**

- [ ] `db-migrate.yml` run on `main` is green; its log lists exactly the expected migrations.
- [ ] CI on `main` is green.
- [ ] Vercel production deployment succeeded.
- [ ] Smoke on prod: `/`, `/login`, `/market`, `/offline`, `/manifest.webmanifest`, `/sw.js` → 200; `/garage` signed out → login; sign in; garage loads; open a listing; `/admin` Overview shows numbers; `/admin/flags` unchanged.
- [ ] Response headers present: `curl -sI https://tinytorque.hypermaxsolutions.com/login | grep -i -E "content-security|strict-transport"`.
- [ ] Scheduled jobs intact: `select jobname, schedule, active from cron.job order by 1;`
- [ ] Sentry: no new issue in the first 15 minutes.
- [ ] PROGRESS.md › Production updated (PR, merge commit, run ids, date). Flag flips are a separate, deliberate step.

**Stop conditions** — roll back the app (§3 A) and investigate if: `db-migrate.yml` is red, the production build fails, sign-in fails, or Sentry shows a new error on a core route.

## 3. Rollback rehearsal — run once before the pilot (owner)

Rehearse on **staging first**, then the app-only step on production in a quiet hour. Record the timings in §4.

**A. App rollback (staging, then prod).**

1. Vercel › Deployments › note the current production deployment `D2` and the previous one `D1`.
2. Promote `D1` to production. Time it.
3. Check `/login` and `/market` serve; confirm the build id changed (view source: the `_next/static/<id>` path).
4. Promote `D2` back. Time it. Smoke again.

**B. Forward-fix a bad migration (staging only).**

1. On a branch, add a migration that creates a throwaway function `public.rehearsal_marker()` — the "bad" release. PR → `staging`; let `db-migrate.yml` apply it.
2. Add a second migration that drops it — the forward fix. PR → `staging`; confirm `db-migrate.yml` is green and `select to_regproc('public.rehearsal_marker')` is null.
3. Time from "decided to fix" to "fix applied". This is the real database rollback time: one PR plus one workflow run.

**C. Kill switch.**

1. On staging, turn `offers` OFF in `/admin/flags`. Within ~60 s (the flag cache) the offer actions are gone from a listing page.
2. Turn it back ON. Confirm "Last changed … by" shows your handle and a `flag.updated` event exists.

**D. Half-applied migration (read-through only).** Read `docs/runbook.md` §3 "A half-applied migration" and D-051; make sure the `supabase migration repair` command and the prod project ref are at hand. Do not run it.

## 4. Dry-run record

| Date          | Step                             | Environment | Duration | Result | Notes                        |
| ------------- | -------------------------------- | ----------- | -------- | ------ | ---------------------------- |
| _not yet run_ | A. app rollback                  | staging     |          |        |                              |
|               | A. app rollback                  | production  |          |        |                              |
|               | B. forward-fix migration         | staging     |          |        |                              |
|               | C. kill switch                   | staging     |          |        |                              |
|               | Full promotion with §2 checklist | production  |          |        | first use: the S10 promotion |

## 5. Sentry alert routing (owner, in the Sentry dashboard)

The rules to create are listed in `docs/runbook.md` §7. After creating them, prove the route end to end: use Sentry's own "Send test notification" on each rule, confirm the email arrives at the on-call inbox, and note the date here.

| Rule                   | Created | Test notification received |
| ---------------------- | ------- | -------------------------- |
| New issue (production) |         |                            |
| Error spike            |         |                            |
| Regression             |         |                            |
