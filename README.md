# Mini Vault

A Next.js (App Router, TypeScript) + Supabase rewrite of the Mini Vault
diecast car collector prototype. Phase 1 covers real phone-OTP auth and a
fully working personal garage (My Garage): add, edit, delete, search,
filter and sort your own collection, with photo uploads to Supabase
Storage.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Run the schema.** In the Supabase dashboard, go to
   **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it once. This
   creates the `profiles`, `collection_items`, `marketplace_listings`,
   `seller_reviews`, `wishlist_items` and `reports` tables (with RLS
   policies) and the public `car-photos` Storage bucket.

3. **Configure phone auth.** In the dashboard, go to
   **Authentication → Providers → Phone** and enable it. Supabase's
   default provider uses Twilio under the hood — you'll need a Twilio
   account (or configure MSG91 or another supported provider) and paste
   its credentials into that same settings page. This is a dashboard
   config step, not something the app code does — see the comment at the
   top of `src/app/(auth)/login/page.tsx`.

4. **Set environment variables.** Copy `.env.example` to `.env.local` and
   fill in your project's URL and anon key (Project Settings → API):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```

5. **Deploy the batch-scan Edge Function** (optional — only needed for the
   "Batch photo scan" feature under `/garage/scan`):

   ```bash
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase functions deploy scan-photo
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

   This deploys [`supabase/functions/scan-photo`](./supabase/functions/scan-photo),
   which takes one photo (e.g. several cars laid out on a table), asks
   Claude's vision model to identify each car in it, and returns a
   confidence score per car for the review-list UI. The API key is a
   server-side secret — it's never sent to the browser.

6. **Install and run:**

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## What's built (Phase 1)

- Next.js 14 App Router + TypeScript project structure, deployable as-is.
- Real Supabase Auth via phone OTP (send code → verify code), with
  `middleware.ts` protecting authenticated routes and refreshing the
  session on every request.
- Onboarding flow that upserts a `profiles` row on first login (display
  name, account type, store name for shops, location).
- **My Garage**: grid/list toggle, add-car form with progressive
  disclosure ("More details"), up to 3 photo uploads to the `car-photos`
  Storage bucket, a non-blocking duplicate warning (same brand + model +
  variant), and a detail page to edit any field, toggle public visibility,
  or delete the item.
- Client-side search, brand filter, public-only filter, and sort over the
  fetched collection.
- Profile page: view/edit profile fields, a 6-theme switcher (persisted to
  `localStorage`, not synced to Supabase — it's a device preference), and
  sign out.
- **Batch photo scan** (`/garage/scan`): upload one photo of several cars,
  a Supabase Edge Function (`supabase/functions/scan-photo`) calls Claude's
  vision model to identify each one, and the user reviews/edits every
  detected car (with a confidence badge) and picks which ones to bulk-add
  before anything is saved.
- Server-rendered, SEO-friendly landing page (proper `<title>`, meta
  description, OpenGraph tags) for signed-out visitors; redirects
  signed-in users straight to `/garage`.
- `/market` and `/offers` stub routes so the bottom nav doesn't 404.
- Typed database row shapes (`src/types/database.ts`) matching
  `supabase/schema.sql` field-for-field.

## What's next (Phase 2+)

See [`/mnt/user-data/outputs/mini-vault-features.md`] (or wherever that
spec doc lives in your workspace) for the full feature list. Not built
yet, deliberately out of scope for this phase:

- **Marketplace**: browsing/publishing listings, cash offers, trade
  proposals, buy-now, seller ratings/reviews, favorites.
- **Gamification**: XP/levels, achievement badges, daily quests, collector
  stats dashboard.
- ~~**AI photo scan**~~ — done (see "Batch photo scan" above). Not yet
  done: scanning multiple photos in one batch (currently one photo per
  scan), and auto-filling rarity/condition from packaging text.
- **Chat / in-app messaging** between buyers and sellers after a deal.
- **CSV import**: bulk-adding cars from a spreadsheet with a template and
  preview step.
- **Wishlist** and **reports/moderation** UI (the `wishlist_items` and
  `reports` tables exist in the schema and have data-layer functions in
  `src/lib/api.ts`, but there's no UI for them yet).

## Notes on what was simplified vs. the prototype

- The bottom nav and pages are functional and theme-aware, but not
  pixel-perfect to the prototype's exact spacing/animations — that's a
  later visual-polish pass, per the task scope.
- The duplicate-warning check runs a simple `ilike` match on
  brand/model/variant client-side (debounced), rather than the more
  elaborate matching a full "merge into existing item" flow might use —
  Phase 1 asks for a warning, not an auto-merge.
- Aurora Glass's "richer card treatment" and Leather & Chrome's nav
  styling are implemented as light CSS enhancements (`.theme-3d`,
  `.theme-leather` classes) rather than fully recreating the prototype's
  bespoke glass/leather visual effects.
