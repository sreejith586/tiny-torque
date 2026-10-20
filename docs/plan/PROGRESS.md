# PROGRESS.md — session-to-session working state

> **This file is the hand-off between sessions.** Read it first (after CLAUDE.md), update it last. Keep it under 120 lines: it is state, not history — history is in git and in the sprint plan. One task per session unless the tasks are trivially small.

## Current position

- **Sprint:** S5+S6 + the UI fidelity pass + two bug-fix rounds are all **complete and live on `main`/prod** (last promotion [PR #87](https://github.com/sreejith586/tiny-torque/pull/87)). **S7 (tokens/Stripe/entitlements) is merged to `staging` via [PR #91](https://github.com/sreejith586/tiny-torque/pull/91) (2026-10-19), not yet promoted to prod** — see the S7 section below. The Collectors World (H3) plan proposal is in `07-collectors-world.md` ([PR #92](https://github.com/sreejith586/tiny-torque/pull/92)). Next up: promote S7, then S8 (gamification) or whatever Sreejith prioritizes.
- **Collectors World (H3) track runs in parallel since 2026-10-20 (D-066):** its state lives in [`PROGRESS-WORLD.md`](PROGRESS-WORLD.md) — World tasks (`MV-Wnn-nn`) are never tracked in this file.
- **Production:** LIVE — **`https://tinytorque.hypermaxsolutions.com`**. Last promotion: [PR #87](https://github.com/sreejith586/tiny-torque/pull/87) (standalone-PWA header safe-area fix). S7 is on `staging`, not in prod yet.
- **Feature flags on prod**: `offers` = **true**, `marketplace_publish` = **true**, `deal_chat` = **true**. `pro_purchase`/`token_purchase` = false (S7 not promoted yet — correctly dark; stays dark after promotion until real Stripe keys land).
- **Two rounds of post-fidelity-pass bug fixes, both found from Sreejith's own prod screenshots/device testing, both now live**: (1) [#84](https://github.com/sreejith586/tiny-torque/pull/84) — deal-chat bubbles collapsing to near-zero width on short messages (a circular `max-width:78%` resolving against its own shrink-to-fit flex wrapper, fixed by moving the cap to `.bubble-wrap` so it resolves against the row's definite width instead), iOS's 16px input auto-zoom-on-focus threshold (every input was 15px), and a real PWA manifest + apple-mobile-web-app-\* meta tags + icons. (2) [#86](https://github.com/sreejith586/tiny-torque/pull/86) — the new standalone-PWA mode's translucent status bar meant the app header needed its own `env(safe-area-inset-top)`, same pattern `.bottom-nav` already used for the bottom safe area.
- **⚠️ Supabase CLI gotcha**: this sandbox's local `supabase/.temp/project-ref` is linked to **staging** (`bjhowyyyypeacfkgxwqr`), not prod, regardless of what `supabase projects list` shows as the account's main project. Plain `supabase db query --linked` silently hits staging. **To target prod, always pass `--linked --project-ref whjqwcaoexbytspkaxfh` together**, and verify any prod write against the public PostgREST API directly, not just the CLI's own echo.
- **Switching branches with an existing `.next/` can break `pnpm typecheck`** (Next's typed-routes validator caches the previous branch's route list) — `rm -r .next` (not `-rf`, that pattern is denied) before typechecking after a branch switch if you see a `Cannot find module '.../page.js'` error that isn't yours.
- **A same-branch fix-up commit does NOT clear GitHub's "this PR has a conflict" state**, even when the end content is a clean superset of both sides. The fix is a real two-parent (or, as above, three-way) merge commit via `git commit-tree`, pushed as a plain non-force commit.
- **Supabase:** prod = `whjqwcaoexbytspkaxfh`, staging = `bjhowyyyypeacfkgxwqr` (ap-south-1, Supabase Branching). `db-migrate.yml` auto-applies on push to `staging`/`main` (D-050).
- **No automated visual-regression suite** (D-056) — eyeball new UI against `garage-log-147.html`/`fd3b02d`. Functional smoke (`smoke.spec.ts`, `onboarding.spec.ts`) runs on every preview deploy.
- **Parked (pre-existing):** marketplace_v2 release-2 destructive drop (D-006 two-release rule); D-024 pricing placeholders; Varun's catalogue CSV/scan fixtures; product fork (S3-05); `/login` ignores `?next=` on successful sign-in.

## S0–S6 — COMPLETE, live on prod. Details in git + 05-sprint-plan.md.

MV-S6-04 (clean-language validator) is the one explicitly-deferred exception.

## S7 — Tokens, Pro & entitlements — MERGED to `staging` ([PR #91](https://github.com/sreejith586/tiny-torque/pull/91)), awaiting promotion

Full sprint built in one session per Sreejith: "use sandbox setup or mockup API keys... make sure
end-to-end development is done... we can look at sandbox and production API keys later" (see D-064
for exactly what "end-to-end" means here — code+tests complete, an actual purchase click fails
gracefully until real Stripe keys land).

- **Migration `20261016000000_tokens.sql`**: `token_packs`/`token_ledger`/`token_purchases`/
  `entitlement_grants`, `credit_tokens`/`spend_tokens`/`admin_adjust_tokens` RPCs, and
  `is_pro`/`entitlement_listing_slots`/`entitlement_scan_quota` replaced from their 0005/0006
  placeholders to be grant-aware. **D-065**: credits (not spends) can take the balance negative —
  needed so a refund-after-spend still posts, per F-11's no-clawback policy.
- **`src/types/supabase.ts` hand-edited again** (same reason as S5-04 — no Docker/DATABASE_URL in
  this sandbox): added the 4 new tables, 4 new enums, 3 new RPC signatures. Needs a real
  `pnpm gen:types` diff-check once this migration is live on staging.
- **`src/lib/payments/`**: a `PaymentProvider` interface (D-011) + a Stripe implementation. Real
  Stripe SDK code (Checkout Sessions, metadata-based refund lookup since our schema has no
  payment_intent column) — `STRIPE_SECRET_KEY` is a placeholder, so it'll throw a clear
  "not configured" error until real keys are set, not silently fail.
- **`supabase/functions/stripe-webhook/`**: signature-verified (constructEventAsync, Deno has no
  Node crypto), handles `checkout.session.completed` (credit) and `charge.refunded` (debit via
  PaymentIntent metadata lookup), idempotent on Stripe's event.id. Deno tests on the pure
  `deriveAction`/`paymentIntentMetadata` helpers (same lib.ts/index.ts split as `ai-scan`) — not
  run locally (no Deno in this sandbox), CI-only like `ai-scan`'s.
- **`domain/entitlements`**: `photoLimit` now takes `isPro: boolean` instead of a raw `plan`
  string — Pro is derived from `pro_until > now()` OR `plan='pro'` (`isProActive()`), not a flat
  plan value (data-model's own wording). Added `isPro()` (DB-backed) alongside it.
- **UI**: `/tokens` (store + balance + "what tokens buy"), `/tokens/success` (polls purchase
  status), `/tokens/cancel`, `/tokens/history` (ledger list). Balance chip in the header
  (realtime via the same channel pattern as the notif bell). `Paywall.tsx`'s CTA now links to
  `/tokens` instead of a disabled "coming soon" button.
- **Pricing is placeholder data** (D-064) — `pack_small` 50/AED19, `pack_large` 150/AED49; spend
  costs 20/15/60 tokens. D-024 itself is still "proposed," not accepted — changing these later is
  a data-only migration.
- **Not done** (judged out of this task's scope, noted not silently dropped): the scan-quota
  402-response from `ai-scan` was never actually wired to show `<Paywall context="scan">` in the
  scan UI — a pre-existing S3 gap, not introduced here. No admin UI button for `admin_adjust_tokens`
  (the RPC exists and is admin-gated, just nothing in `/admin` calls it yet). No Playwright
  Stripe-test-mode E2E yet — needs real test keys to actually run against Stripe's test card flow.
- **Next**: promote `staging → main` (D-039) and apply the tokens migration to prod (D-040). Verify
  `db-migrate.yml` applied `20261016000000_tokens.sql` on staging. Once real Stripe test keys exist,
  smoke-test an actual purchase end to end before flipping `token_purchase`/`pro_purchase`.

## Release procedure (every sprint end, D-035/D-039/D-040)

1. PR `sprint-N → staging` (merge commit) → Vercel staging deploy → smoke.
2. PR `staging → main` (merge commit) → Vercel production deployment.
3. `db-migrate.yml` auto-applies new migrations to the target (D-050) — verify via the job log.
4. Prod smoke; record version + date here. **Flipping a kill-switch flag is a separate, deliberate step.**

## Blockers / open questions

- D-005 region: confirm the Supabase project is `ap-south-1` — never explicitly confirmed.
- D-024 token/listing-slot pricing — S7 shipped with placeholders (D-064); still needs a real decision before launch. D-025 India SMS route (phone OTP, D-037).
- Real Stripe account/keys (Hypermax FZE) — needed before S7's purchase flow actually works; code is ready (D-064).
- `pnpm gen:types` needs Docker or a DATABASE_URL, neither available here — S7's `src/types/supabase.ts` was corrected to CI's real `gen:types` output in 149376d (PR #91); still worth a diff-check once the migration is live on prod.
- Varun: starter catalogue CSV (~200 castings), 20-photo scan-accuracy fixture set — still pending from him.
- `follows` RLS grants full public SELECT on raw pairs; spec (03 §2.12) says "public read **count**" — dormant until any UI reads `follows`.
- MV-S6-04's banned-word list is a deferred decision, not forgotten.
- The `ai-scan` 402 (quota exhausted) response has never been wired to show the scan Paywall in the UI — pre-existing S3 gap, noticed while touching Paywall.tsx this session, not fixed (out of scope).

## Decisions made this sprint

See DECISIONS.md, D-029…D-065. This session added D-064 (S7 ships with placeholder token pricing/Stripe keys — code+tests complete, real purchase needs real keys later) and D-065 (credits, not spends, may take the token balance negative — needed for post-spend refunds, per F-11's no-clawback policy).

## Carry-over register

- none

## Session log (last 5 sessions only — trim older)

| Date       | Task(s)                                                                                                                          | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | PR                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 2026-10-19 | Collectors World (H3) plan proposal (07-collectors-world.md, PR #92); recorded S7 merged to staging via PR #91                   | Plan is proposal-only (no D-rows); S7 was merged by Sreejith as #91 — PROGRESS updated to match; promotion to prod is next                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                                                                                                     |
| 2026-10-16 | Built the full S7 sprint (tokens/Stripe/entitlements) in one session                                                             | "Use sandbox setup or mockup API keys... make sure end-to-end development is done." Built the migration (packs/ledger/purchases/grants, credit_tokens/spend_tokens/admin_adjust_tokens RPCs, grant-aware entitlement functions), `src/lib/payments` (PaymentProvider + Stripe impl), `supabase/functions/stripe-webhook` (ai-scan's lib.ts/index.ts split, Deno-tested), `domain/tokens`+`domain/entitlements` updates, and the `/tokens` store/success/cancel/history UI + header balance chip + Paywall CTA wiring. Found and fixed a real design bug along the way before it shipped: the first draft of `credit_tokens` would have blocked a refund-after-spend from posting (D-065). Pricing + Stripe keys are placeholders (D-064) — not yet opened as a PR.                                                                                                                                                                                                                                                                    | none yet                                                                                                            |
| 2026-10-15 | Promoted S5+S6 to prod, built + promoted full UI fidelity pass, fixed two rounds of post-promotion bugs from real device testing | Merged #79 (stacked-PR fix) then #80 — S5+S6 fully live, `deal_chat` flipped on. Ran a full UI pixel-fidelity + motion pass against `garage-log-147.html`: screen-by-screen discrepancy audit, explicit sign-off on two flow/scope judgment calls via AskUserQuestion (D-062 Add Car chooser, D-063 Profile Top-Brands/reviews), built as 4 commits on #82, promoted via #83. Sreejith then found two real bugs by actually using the deployed app: a prod screenshot showed deal-chat bubbles collapsing to near-zero width (root-caused to a circular `max-width:78%` against an auto-sized flex wrapper, reproduced/verified with isolated DOM injection before touching the component; also fixed iOS's 16px input auto-zoom threshold and added the PWA manifest in the same PR, #84 → promoted #85); then, after adding the app to his home screen, the header sat under the status bar in standalone mode (translucent-status-bar overlay needs its own safe-area padding, same pattern as `.bottom-nav`, #86 → promoted #87). | [#79](https://github.com/sreejith586/tiny-torque/pull/79)–[#87](https://github.com/sreejith586/tiny-torque/pull/87) |
| 2026-10-14 | Fixed #76/#77/#78's failing CI (pgTAP, stale types, invalid test UUIDs, an enum cast)                                            | Four real bugs across three PRs, all caught by CI rather than assumed fixed: #76's `review_received` trigger depended on #74's schema but was built independent of it (fixed by rebasing onto #74); `message.sent` was only emitted by a second app-level call, never atomically with the insert (moved to a DB trigger); #77/#78 had stale generated types (same class of miss as #74 — Postgres sets, `never` vs `number \| null`) and a pgTAP fixture with invalid hex digits in a UUID; `resolve_report`'s status update needed an explicit enum cast. Each fix verified via a live CI re-run, not assumed.                                                                                                                                                                                                                                                                                                                                                                                                                       | [#76](https://github.com/sreejith586/tiny-torque/pull/76)–[#78](https://github.com/sreejith586/tiny-torque/pull/78) |
