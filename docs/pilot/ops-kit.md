# Pilot ops kit (MV-S10-08, F-19)

Everything needed to run the invite-only pilot (D-016: 30–80 collectors incl. 3–5 shops, UAE + India, 8–12 weeks): cohorts and invite codes, onboarding messages, the feedback channel, the weekly KPI report and the known-issues page.

## 1. Cohorts and invite codes

Codes are minted on **`/admin/invites`** — one batch per cohort. The cohort name is stored on every code and travels with the sign-up (`invite.redeemed` event), so the weekly report can be split by it. Sign-up needs a code while the `invite_only` flag is ON — it is OFF today; switching it ON in `/admin/flags` is part of the launch seeding (MV-S11-01), so do it before the first invite goes out.

| Cohort (use exactly these names) | Who                                     | Codes          | Seats per code    | Expiry  |
| -------------------------------- | --------------------------------------- | -------------- | ----------------- | ------- |
| `founders`                       | Sreejith, Varun, 3–5 trusted collectors | 1              | 10                | never   |
| `uae-shops`                      | 2–3 shops in the UAE                    | one per shop   | 3 (owner + staff) | 30 days |
| `india-shops`                    | 2–3 shops in India                      | one per shop   | 3                 | 30 days |
| `uae-collectors`                 | individual collectors, UAE              | one per person | 1                 | 30 days |
| `india-collectors`               | individual collectors, India            | one per person | 1                 | 30 days |
| `wave-2`                         | waitlist / referrals after week 2       | as needed      | 1                 | 14 days |

Rules of thumb:

- Personal codes (1 seat) for individuals: you can see who has not joined and nudge them; a leaked code is worth one sign-up.
- A shared code only for a group you trust to pass it on (founders, a shop's staff).
- **End** a code on `/admin/invites` if it leaks; seats already used stay.
- Keep a private sheet: name · WhatsApp · cohort · code · sent on · joined on. The app deliberately does not store who a code was meant for.
- Shops first (they bulk-load stock, so collectors arrive to a market that has cars), collectors a few days later.

## 2. Onboarding messages

Replace the `{…}` parts. Keep them short; the app explains itself.

**WhatsApp — individual collector**

> Hi {name}! We're opening Tiny Torque to a small group of diecast collectors in {UAE/India} and I'd love you in it. It's a place to keep your garage (scan a car with your phone and it fills in the details), and to buy, sell and trade with other collectors.
>
> Your invite code: _{CODE}_ (it's yours only, valid for 30 days)
> Join here: https://tinytorque.hypermaxsolutions.com
>
> Sign in with your email, enter the code, add your first five cars — that's the whole start. It's a pilot, so things will be rough in places; tell me what breaks. 🙏

**WhatsApp — shop**

> Hi {name}, Tiny Torque is a new marketplace built only for diecast, starting with a small invited group in {UAE/India}. Shops get in first so collectors arrive to real stock.
>
> Shop invite code: _{CODE}_ (good for you + 2 staff, 30 days)
> https://tinytorque.hypermaxsolutions.com
>
> You can import your stock from a spreadsheet (Add Car › Import), then publish listings from your garage. Deals are settled directly between you and the buyer — we take no commission and handle no payment. Happy to sit with you for 20 minutes to get the first batch in.

**Email — subject: Your invite to Tiny Torque (pilot)**

> Hi {name},
>
> Tiny Torque is opening to a small group of diecast collectors in the UAE and India, and you're invited.
>
> **Your invite code: {CODE}** — valid until {date}.
>
> 1. Open https://tinytorque.hypermaxsolutions.com and sign in with this email address.
> 2. Enter the code when asked.
> 3. Add your first cars — by photo scan, by hand, or by importing a spreadsheet.
>
> A few honest notes: this is a pilot, so expect rough edges (the known ones are listed under Settings › Help and status). Deals between collectors are settled directly between you — Tiny Torque never handles the money. Buying tokens is not open yet.
>
> If anything breaks or annoys you, tell us from Settings › Send feedback. That is the point of the pilot.
>
> Thanks for being early,
> {sender}

**Day-3 nudge (WhatsApp, to people who joined but have < 5 cars)**

> Hey {name} — saw you got in 🙌 Tip: Add Car › Scan, point at a carded car, and it fills in brand and model for you. Five cars and your garage starts to look like one.

**Day-10 nudge (to collectors with a garage and no listing)**

> Got doubles you'd part with? Open the car in your garage › List for sale. Takes about a minute, and you choose whether to accept offers or trades.

Find who to nudge:

```sql
-- joined, fewer than 5 cars
select p.handle, p.created_at::date, count(i.id) as cars
from profiles p left join collection_items i on i.owner_id = p.id and i.deleted_at is null
where p.deleted_at is null and p.created_at > now() - interval '14 days'
group by 1, 2 having count(i.id) < 5 order by 2;
```

## 3. Feedback channel

| Channel                                                     | For                                     | Lands in                                                  |
| ----------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| **Settings › Send feedback** (bug / idea / other, 10 a day) | anything about the app                  | `/admin/feedback` + an in-app notification to every admin |
| **Report** on a listing / collector / message               | abuse, fakes, scams                     | `/admin/reports` (policy: `/legal/abuse`)                 |
| Pilot WhatsApp group (announcement-only + one "help" group) | outages, quick questions, release notes | the owner's phone                                         |
| `hello@tinytorque.hypermaxsolutions.com`                    | legal, privacy, appeals                 | the shared inbox                                          |

Working agreement for the pilot: look at `/admin/feedback` and `/admin/reports` daily; answer bugs in the group within a working day ("seen / known / fixed in the next release"); every confirmed bug that collectors will keep hitting goes on the known-issues page the same day.

## 4. Known-issues page

`/legal/known-issues` (public, linked from Settings › Help and status). The list is data in `src/lib/known-issues.ts`: add or remove an item, bump `KNOWN_ISSUES_UPDATED`, ship it with the next PR. An item leaves the list in the PR that fixes it. Keep entries to one plain sentence and a workaround.

## 5. Weekly KPI report — every Monday

Open `/admin/kpis` (press **Refresh now**), `/admin` and PostHog's "Pilot KPIs" dashboard. Definitions and targets: `docs/pilot/kpi-definitions.md`. Paste into the pilot log / WhatsApp to Varun:

```
Tiny Torque pilot — week of {Mon date} (week {n} of the pilot)

Cohort: {total collectors} signed up ({+new} this week) · WAU {wau}
  by cohort: founders {n} · uae-shops {n} · india-shops {n} · uae-collectors {n} · india-collectors {n}

Success criteria                         this week   target   trend
1 Activation (≥5 cars in 7 days)            {..}%     ≥ 60%    {↑↓→}
2 Scan share of cars added                  {..}%     ≥ 40%
3 Scan suggestions accepted                 {..}%     ≥ 60%
4 Sign-ups who published a listing          {..}%     ≥ 35%
5 Offers per live listing (month)           {..}      ≥ 0.5
6 Completed deals with a review (total)     {..}      ≥ 15
7 Token buyers ÷ WAU                        {..}%     ≥ 8%
8 W4 retention (cohort of {date})           {..}%     ≥ 40%
9 Reports actioned ÷ listings               {..}%     < 2%
10 p95 page load / error rate               {..}s / {..}%   < 2.5 s / < 0.5%

Volume: {cars added} cars · {scans} scans (${scan cost}) · {listings} listings · {offers} offers · {deals} deals
Money: token revenue {AED ..} / {INR ..} · scan cost ${..} · SMS est. ${..}
Trust: {reports} reports ({actioned} actioned) · {suspensions} suspensions · {feedback} feedback messages

Top 3 things collectors said:
1.
2.
3.

Incidents / downtime:
Shipped this week:
Next week:
Decisions needed:
```

Monday routine alongside it: World economy review if any `world*` flag is on (06 §5), `job_runs` errors in the last 7 days, Anthropic / Supabase / Vercel usage against the alerts in `docs/runbook.md` §7.

## 6. Launch-day checklist (pointer)

Seeding production, flag defaults and the launch itself are Sprint 11 (MV-S11-01). Before sending the first invite: `docs/release-process.md` §2 promotion done, the restore drill recorded (`docs/runbook.md` §5), Sentry rules tested, `invite_only` ON, the founders code redeemed by you on a clean browser.
