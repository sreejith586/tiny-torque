# Runbook — Tiny Torque / Mini Vault (MV-S10-02, F-19)

Operational reference for production. Short on purpose: what to check, what to run, who decides. Job-specific procedures (World jobs, H1 jobs, earn exploit) stay in `docs/plan/06-engineering-standards.md` §5; this file links to them.

|                |                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Production app | `https://tinytorque.hypermaxsolutions.com` (Vercel, region `bom1`, branch `main`)                           |
| Production DB  | Supabase project `whjqwcaoexbytspkaxfh` (ap-south-1)                                                        |
| Staging DB     | Supabase branch `bjhowyyyypeacfkgxwqr` (branch `staging`)                                                   |
| Repo           | `sreejith586/tiny-torque` — `staging` is the default branch, `main` is production                           |
| Status pages   | <https://www.vercel-status.com> · <https://status.supabase.com> (also linked in Settings › Help and status) |

> CLI trap: a local `supabase` checkout may be linked to **staging**. To touch prod always pass `--linked --project-ref whjqwcaoexbytspkaxfh` together and verify the result through the public API, not the CLI echo.

## 1. On-call and contacts

Solo operation during the pilot: one owner, no rota.

| Role                            | Who                                                                                               | Reach                                              | Decides                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| Owner / on-call                 | Sreejith (CTO)                                                                                    | phone + the alert inbox — **fill in before pilot** | everything below                             |
| Design / product second opinion | Varun                                                                                             | WhatsApp — **fill in**                             | copy and UX of user-facing incident messages |
| Legal                           | Hypermax FZE counsel — **fill in**                                                                | email                                              | data-breach notification, takedown requests  |
| Vendors                         | Supabase support (dashboard › Support), Vercel support, Stripe support, Resend, Anthropic console | —                                                  | —                                            |

Alert sources that reach the owner: Sentry issue alerts (email; §7), GitHub Actions failure emails (`h1-jobs.yml` daily job check, CI on `main`), Supabase usage emails, Stripe emails, `feedback_received` in-app notifications, the pilot WhatsApp group.

## 2. Incident severity

| Sev    | Meaning                                            | Examples                                                                                                                                          | Response                                                                                                                                                |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | Data exposure, money wrong, or everyone locked out | another collector's private data visible; tokens credited or charged wrongly; an unknown admin account; sign-in down for all; prod DB unreachable | Act immediately. Contain first (kill switch, suspend, roll back), then diagnose. Tell the pilot group within 1 h. Write the incident note the same day. |
| **S2** | A core flow is broken for many                     | garage does not load; cannot add cars; offers fail; scan down; chat down                                                                          | Same day. Kill-switch the feature if it misleads users; fix forward.                                                                                    |
| **S3** | Degraded or cosmetic                               | slow pages; one theme broken; a job failed once; wrong copy                                                                                       | Next working session. Add to known issues if collectors will notice.                                                                                    |

First five minutes, any severity:

1. **Is it us?** Check the two status pages. If a provider is down: post in the pilot group, do nothing else.
2. **What changed?** Vercel › Deployments (last production deploy), GitHub › `main` history, `db-migrate.yml` last run, `/admin/flags` "Last changed … by".
3. **Contain.** In order of preference: flip the kill switch (§4) → roll back the deployment (§3) → suspend the account (`/admin/users`) → take the feature's audience to zero.
4. **Then** read Sentry (issue + breadcrumbs: every `track()` is a breadcrumb), Vercel function logs, Supabase logs (API / Postgres / Auth), `/admin/world/economy` › Job runs.
5. **Write it down** — one entry in §9's format, in the PR that fixes it or in PROGRESS.md › session log.

Data-exposure incidents additionally: note the first and last time the exposure was possible, which rows, whether logs show access; rotate any key that could have been seen (§6); legal decides on notification (UAE PDPL / India DPDP — counsel's call, not ours).

## 3. Rollback

**App (seconds, always safe to try first).** Vercel › project › Deployments › pick the last good production deployment › **Promote to Production** (or `vercel promote <deployment-url>`). This does not touch the database. `main` stays ahead of what is serving — follow up with a revert PR `staging → main` so the next promotion does not re-ship the bug.

**Database — forward-fix, never "down".** There are no down migrations (D-006). A bad migration is fixed by a new migration:

- Additive change (new table / column / function / index / policy) that misbehaves → new migration that corrects or drops it; the previous app version keeps working because it never referenced the new object.
- A function or policy replaced with a bad version → new migration that re-creates the previous body (copy it from the earlier migration file).
- Destructive changes only ever ship in the second of two releases (add + backfill, then drop), so the app version before the drop still works. If a drop went out too early: restore the column / table from PITR into a scratch project (§5) and copy the data back with `insert … select` — do **not** restore over prod.
- A half-applied migration (`db-migrate.yml` red): read the job log, fix the SQL in a new commit, re-run. If `schema_migrations` is out of step with reality, `supabase migration repair --status applied|reverted <version> --linked --project-ref whjqwcaoexbytspkaxfh` — and record it in DECISIONS.md (precedent: D-051).

**Rollback order when both moved:** roll the app back first (old code on new schema is the tested direction), then forward-fix the schema.

**Data mistakes** (a bad `update`, an admin action on the wrong account): PITR into a scratch project, extract the rows, write them back by hand. Token balances are a ledger — correct them with `admin_adjust_tokens(user, delta, note)`, never by editing rows.

## 4. Kill switches

`/admin/flags` (admin only; every change is logged as `flag.updated` and shown as "Last changed … by"). Enabled OFF = the feature is off for everyone within a minute (flag cache TTL 60 s per server instance).

| Flag                                   | Turns off                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `ai_scan`                              | photo scanning (cost + Anthropic outage)                                        |
| `offers`                               | new offers / buy now / trades                                                   |
| `deal_chat`                            | deal chat                                                                       |
| `marketplace_publish`                  | publishing new listings                                                         |
| `csv_import`                           | spreadsheet import                                                              |
| `token_purchase`                       | starting a Stripe checkout (enforced server-side since S10)                     |
| `invite_only`                          | when ON, sign-up needs an invite code                                           |
| `world`, `world_shop`, `world_earn`, … | Collectors World (D-077; `world_shop` + `world_earn` together = economy freeze) |

Per-account containment: `/admin/users` › Suspend (7 days; lifts the same way) and Freeze earn.

## 5. Backups and the restore drill

Supabase Pro keeps daily backups; **Point-in-Time Recovery is an add-on — confirm it is enabled on the prod project** (Dashboard › Database › Backups › Point in Time). Storage objects (photos) are **not** in a database backup.

### Restore drill — procedure (owner runs it; first run before pilot, then quarterly)

Goal: prove a restore works and learn how long it takes. Never restore over production as a drill.

1. Note the start time. Dashboard › prod project › Database › Backups › **Restore to a new project** (PITR: pick a timestamp ~10 minutes ago). Name it `tinytorque-restore-drill-YYYYMMDD`, same region.
2. Wait for the new project to become healthy. Note the time.
3. Verify against prod (run both queries on both projects; counts on the restore must be ≤ prod and within the last 10 minutes of activity):

   ```sql
   select 'profiles' t, count(*) from profiles
   union all select 'collection_items', count(*) from collection_items
   union all select 'marketplace_listings', count(*) from marketplace_listings
   union all select 'offers', count(*) from offers
   union all select 'token_ledger', count(*) from token_ledger
   union all select 'domain_events', count(*) from domain_events;

   select max(version) from supabase_migrations.schema_migrations;
   select count(*) from pg_policies where schemaname = 'public';
   select jobname, schedule from cron.job order by 1;   -- pg_cron rows survive?
   ```

4. Spot-check one collector end to end: their profile row, five items, and that the ledger sums to the balance — `select p.tokens, (select coalesce(sum(delta), 0) from token_ledger l where l.user_id = p.id) as ledger from profiles p where p.id = '<id>';` (the two numbers are equal).
5. Confirm what is **not** there: Storage objects, Edge Function secrets, Auth provider settings, custom SMTP — list what you had to re-enter.
6. Note the end time. **Delete the scratch project** (it is billed).
7. Record the drill:

| Date          | Restore target time | Start → healthy | Verification done | Rows matched | Not restored (re-entered by hand) | Notes |
| ------------- | ------------------- | --------------- | ----------------- | ------------ | --------------------------------- | ----- |
| _not yet run_ |                     |                 |                   |              |                                   |       |

**Real restore (S1, data lost or corrupted):** freeze writes first (kill switches + `invite_only` ON), restore to a **new** project, verify as above, then either copy the affected rows back into prod (preferred — keeps everything after the incident) or, only if prod is unusable, repoint the app: update `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel, re-deploy, re-set Edge Function secrets, re-deploy the three functions, re-point the Stripe webhook, update `db-migrate.yml`'s project ref. Expect collectors to sign in again.

## 6. Secrets and key rotation

Nothing secret lives in the repo. Values are only in the three stores below.

| Secret                                                                     | Store                                         | Used by                                      | Rotate when                                                                          |
| -------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Supabase anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)                        | Vercel env (Production / Preview)             | browser + Next server                        | JWT secret rotation only (public by design)                                          |
| Supabase service-role key (`SUPABASE_SERVICE_ROLE_KEY`)                    | Supabase Edge secrets (automatic)             | `ai-scan`, `stripe-webhook`, `jobs`          | leak suspected; a person with access leaves                                          |
| Supabase JWT secret                                                        | Supabase dashboard                            | signs anon + service keys and sessions       | leak of the service-role key (rotating it replaces both keys and signs everyone out) |
| DB passwords (`SUPABASE_PROD_DB_PASSWORD`, `SUPABASE_STAGING_DB_PASSWORD`) | GitHub Actions secrets                        | `db-migrate.yml`, `seed-demo.yml`            | leak; yearly                                                                         |
| `SUPABASE_ACCESS_TOKEN`                                                    | GitHub Actions secret                         | `db-migrate.yml` (link)                      | leak; yearly; owner's account change                                                 |
| `STRIPE_SECRET_KEY`                                                        | Vercel env + Supabase Edge secrets            | checkout (Next server), `stripe-webhook`     | leak; staff change                                                                   |
| `STRIPE_WEBHOOK_SECRET`                                                    | Supabase Edge secrets                         | `stripe-webhook`                             | endpoint re-created; leak                                                            |
| `ANTHROPIC_API_KEY`                                                        | Supabase Edge secrets                         | `ai-scan`                                    | leak; unexpected spend                                                               |
| `JOBS_SECRET`                                                              | Supabase Edge secrets + GitHub Actions secret | `jobs` function, `h1-jobs.yml`               | leak; yearly                                                                         |
| Resend SMTP password                                                       | Supabase Auth › SMTP settings                 | sign-in emails                               | leak; yearly                                                                         |
| `SENTRY_AUTH_TOKEN`, `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`               | Vercel env                                    | source maps; error reporting (DSN is public) | token: leak                                                                          |
| `NEXT_PUBLIC_POSTHOG_KEY`                                                  | Vercel env                                    | analytics (public)                           | —                                                                                    |
| `VERCEL_AUTOMATION_BYPASS_SECRET`                                          | Vercel + GitHub Actions secret                | preview e2e                                  | leak; yearly                                                                         |

**Rotation procedure (same shape for every secret):**

1. Create the new value at the provider (do not revoke the old one yet where the provider allows two — Stripe rolling keys, Anthropic, Resend, Sentry, GitHub tokens).
2. Put it in every store listed for that secret. Vercel env changes need a **redeploy** of production to take effect; Edge secrets (`supabase secrets set NAME=… --project-ref whjqwcaoexbytspkaxfh`) apply on the next invocation; GitHub secrets apply on the next run.
3. Verify the consumer: checkout session starts (Stripe), a scan completes (Anthropic), `curl -X POST …/jobs -H "x-jobs-secret: …" -d '{"track":"h1","job":"expire_offers"}'` returns 200 (`JOBS_SECRET`), a sign-in email arrives (Resend), `db-migrate.yml` manual run is green (DB password / access token).
4. Revoke the old value. Note the date in the table below.

**Supabase keys are different:** anon and service-role keys cannot be rotated one by one — Dashboard › Settings › API › **Generate new JWT secret** replaces both and invalidates every session. Do it only for a real service-role leak, in a quiet hour: generate → update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (Production and Preview) → redeploy → smoke sign-in → post in the pilot group that everyone needs to sign in again.

**A secret was committed or pasted somewhere public:** treat as leaked regardless of how fast it was removed — rotate first, clean history second.

| Secret                        | Last rotated | By  |
| ----------------------------- | ------------ | --- |
| _fill in as rotations happen_ |              |     |

## 7. Alerts to configure (owner, dashboards)

| Alert                        | Where                             | Rule                                                                       |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| New error type in production | Sentry › Alerts › Issue alert     | "A new issue is created" in environment `production` → email owner         |
| Error spike                  | Sentry › Alerts › Metric alert    | error count > 20 in 1 h, or users affected > 5 → email owner               |
| Regression                   | Sentry › Issue alert              | "issue changes state from resolved to unresolved" → email                  |
| Job failed                   | already live                      | `h1-jobs.yml` fails when any `job_runs` row errored in 24 h → GitHub email |
| Anthropic spend              | Anthropic console › Limits        | monthly limit + email at 50 % / 80 % (start: USD 50 / month for the pilot) |
| Supabase usage               | Supabase › Organization › Billing | spend cap ON, usage emails ON (DB size, egress, MAU, storage)              |
| Vercel usage                 | Vercel › Usage                    | notifications at 75 % of plan limits                                       |
| Stripe                       | Stripe › Settings › Notifications | failed payments, disputes, webhook failures                                |
| Uptime                       | optional: any HTTP monitor        | `GET /login` every 5 min                                                   |

`/admin` Overview shows this month's scan cost, token revenue and an SMS estimate; `/admin/kpis` shows weekly scan cost — look at both in the Monday review (`docs/pilot/ops-kit.md`).

## 8. Common situations

| Symptom                                        | Likely cause                                      | Do                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| "Could not start checkout" / "aren't open yet" | `token_purchase` flag off, or Stripe keys missing | expected until payments go live; otherwise check the flag, then Vercel env                                          |
| Scan errors for everyone                       | Anthropic outage / key / spend limit              | `ai_scan` OFF, check console, rotate or raise the limit, ON                                                         |
| Scan error for one collector                   | quota exhausted (402)                             | known issue; grant `scan_pack` via `admin_adjust_tokens` if deserved                                                |
| Nobody receives sign-in codes                  | Resend down / SMTP password / Auth rate limit     | Supabase › Auth logs; Resend dashboard; status pages                                                                |
| A collector cannot sign up                     | invite code used up / expired                     | `/admin/invites` — mint a new code for their cohort                                                                 |
| Listings vanished                              | `expire_listings` ran (correct) or a block        | `/market/mine` › Expired; `select * from job_runs order by started_at desc limit 20`                                |
| Daily job email from GitHub                    | a `job_runs` row errored                          | 06 §5 "H1 scheduled jobs" / "Scheduled jobs"                                                                        |
| Abuse report                                   | —                                                 | `/admin/reports` → dismiss / remove listing / warn / suspend; policy: `/legal/abuse`                                |
| Suspicious token balance                       | earn exploit or a forged write                    | 06 §5 "earn exploit"; `select * from token_ledger where user_id = … order by created_at`                            |
| Unknown admin account                          | S1 — see `docs/security-review.md` finding 6      | set `role = 'user'` in SQL, suspend, review `domain_events` for that actor, rotate nothing unless keys were exposed |
| KPI page stale                                 | nightly refresh failed                            | `/admin/kpis` › Refresh now; `job_runs` where `job = 'refresh_pilot_kpis'`                                          |

## 9. Incident note template

```
Date / time (UTC) · Severity · Detected by
What users saw:
Timeline: first bad event → detected → contained → fixed
Cause:
Containment (flag / rollback / suspension):
Fix (PR / migration):
Data affected (who, what, how many):
Follow-ups (owner, date):
```
