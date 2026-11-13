# Beta launch checklist (MV-S11-01)

The shortest path from "S11 is merged" to "the first invite is sent". Everything here is an owner step — dashboards, prod SQL, secrets, flag flips. Code for all of it is on `main` once the S11 PR is promoted. Order matters; each step says how to tell it worked.

## 0. Before anything else

- [ ] S11 PR merged into `staging`, CI green, then promoted `staging → main` (`docs/release-process.md` §2). `db-migrate.yml` on `main` lists `20261113200000_invite_gate` and `20261113201000_scan_metering`.
- [ ] The two prod security checks from S10 are done (`docs/security-review.md` §1).

## 1. Edge Functions and their secrets (≈ 10 min)

The scan screen now calls **`ai-scan` only**. Until this step is done, scanning on prod answers "switched off".

- [ ] Secrets present on the prod project: `ANTHROPIC_API_KEY`, `JOBS_SECRET` (`supabase secrets list --project-ref whjqwcaoexbytspkaxfh`).
- [ ] Deploy the metered scan function:

  ```bash
  supabase functions deploy ai-scan --project-ref whjqwcaoexbytspkaxfh
  ```

- [ ] Redeploy jobs (W07 changed it; also still open from S9):

  ```bash
  supabase functions deploy jobs --no-verify-jwt --project-ref whjqwcaoexbytspkaxfh
  ```

- [ ] **Delete the retired scan endpoint.** The Phase-1 `scan-photo` function is still deployed and still calls Anthropic for anyone holding the public anon key, with no quota or log:

  ```bash
  supabase functions delete scan-photo --project-ref whjqwcaoexbytspkaxfh
  ```

- [ ] Anthropic console: a monthly spend limit and an email alert (start: USD 50).

## 2. Admin account (≈ 2 min)

Since S10 nobody can make themselves admin through the app, by design. Run this **as the database owner** against prod (`psql`, or `supabase db query --linked --project-ref whjqwcaoexbytspkaxfh`):

```sql
update public.profiles set role = 'admin' where handle = '<your handle>';
select id, handle, role from public.profiles where role = 'admin';
```

- [ ] Exactly the accounts you expect are listed. `/admin` opens for you.

## 3. Flags — `/admin/flags` (≈ 5 min)

| Flag                                         | Set to                     | Why                                                                         |
| -------------------------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| `invite_only`                                | **ON**                     | closes sign-up to people holding a code; enforced by the database since S11 |
| `ai_scan`                                    | **ON**                     | single scan                                                                 |
| `ai_scan_group`                              | **ON**                     | the Batch photo scan screen uses the group scan                             |
| `csv_import`                                 | ON if shops will bulk-load | spreadsheet import                                                          |
| `offers`, `marketplace_publish`, `deal_chat` | already ON                 | —                                                                           |
| `token_purchase`, `pro_purchase`             | **OFF**                    | until real Stripe keys and pricing (D-024)                                  |
| every `world*` flag                          | OFF                        | Collectors World is not part of the beta                                    |

- [ ] Each row shows "Last changed … by @you".

## 4. Prove the whole path yourself, on a clean browser (≈ 10 min)

Use an email address that has never signed in, in a private window.

- [ ] `/admin/invites` → cohort `founders`, 1 code, 10 sign-ups, no expiry → copy the code.
- [ ] Private window → `/login` → email code arrives (Resend) → the wizard asks for the invite code first.
- [ ] Type the code in lower case with a space — it is accepted. Close the tab. Sign in again — you are **not** asked for the code a second time.
- [ ] Finish onboarding → you land in an empty garage with the first-run tour.
- [ ] Add a car by hand. Then Batch photo scan with one carded car → candidates appear → save.
- [ ] `/admin` Overview: collectors +1, scans this month +1, AI scan cost > $0. `/admin/scan-jobs` shows the job. `/admin/invites`: `founders` 1 / 10.
- [ ] Settings › Send feedback → you (as admin) get the notification and see it on `/admin/feedback`.
- [ ] A second private window, another new email, **no code** → onboarding cannot be completed.

If any line fails, stop and fix before inviting anyone (`docs/runbook.md` §8).

## 5. Minimum alerting (≈ 10 min)

- [ ] Sentry: one issue alert — "a new issue is created", environment `production` → your email. Send its test notification.
- [ ] Supabase: spend cap ON, usage emails ON.
- [ ] You are watching `/admin/feedback` and `/admin/reports` daily for the first week.

## 6. Send the first invites

- [ ] Shops first (`uae-shops`, `india-shops`: one code per shop, 3 sign-ups, 30 days), collectors a few days later — cohorts, templates and the nudge messages are in `docs/pilot/ops-kit.md`.
- [ ] Keep the private sheet: name · cohort · code · sent · joined.
- [ ] Day 1–7: open `/admin` and `/admin/kpis` every morning; reply to every piece of feedback within a working day.

## Can wait until after the first cohort is in

Restore drill and rollback rehearsal (`docs/runbook.md` §5, `docs/release-process.md` §3) · k6 run on staging · PostHog dashboards · real Stripe keys + pricing (D-024) · counsel review of the legal drafts · phone-number sign-in (D-025) · Varun's starter catalogue.

## Who joined, by cohort

```sql
select cohort, count(*) as collectors, min(redeemed_at)::date as first, max(redeemed_at)::date as latest
from public.invite_redemptions group by 1 order by 2 desc;
```
