# Tiny Torque — Privacy Policy v2 (DRAFT — FOR COUNSEL REVIEW — NOT PUBLISHED)

> Status: **draft v2, 2026-10-20**, prepared for counsel from `docs/plan/07-collectors-world.md` §6.6, §9, §10. Not legal advice; not in force until counsel signs off and it is published. Open questions for counsel are marked ⚖️.
>
> **What changed from v1:** DPDP (India) and PDPL (UAE) wording; data residency (Mumbai) for UAE users; 18+ and the age-confirmation record; Collectors World data (garages, visits, kudos, guestbook, meetups, races, clubs); approximate-location handling for in-person meetups; consent events; retention of the credits ledger.

## 1. Who is responsible

Hypermax FZE (UAE) is the data controller / data fiduciary. ⚖️ Confirm the DPDP "Data Fiduciary" designation and whether a Consent Manager integration is required at pilot scale.

## 2. What we collect

- **Account:** mobile number or email (for one-time codes), display name, handle, country, city (optional), profile photo (optional), account type, store name (shops).
- **Age and consent:** the date you confirmed you are 18+, and the Terms/Privacy version you accepted (stored on your profile and in our event log).
- **Your garage:** the items you catalogue, photos, notes, prices paid, public/private settings.
- **Marketplace:** listings, offers, deal chat messages, reviews, reports and blocks.
- **Credits:** purchases (via Stripe; we never see card numbers), the credits ledger, items and levels bought, earned credits and their expiry.
- **Collectors World:** your garage layout and settings, who visited whose garage (per day), kudos, guestbook messages, meetups you host or attend, race entries and results, club membership, quests and season progress.
- **In-person meetups:** city and an **approximate** area for the public listing; an exact venue only if the host chooses to share it, visible only to confirmed attendees. We never show your exact location to anyone else.
- **Technical:** device/browser type, IP address (for abuse prevention and rate limits), crash reports (Sentry), product analytics (PostHog — no phone numbers or message content).

## 3. What we never show other users

Your mobile number, email, exact location, and private items. Other collectors see only your public profile (handle, display name, country, city, bio, level, public items) and what you choose to open in the World.

## 4. Why we process it (legal bases)

Providing the Service (contract); keeping the community safe and preventing fraud, bots and earn farming (legitimate interest / legal obligation); accounting and tax for credit sales (legal obligation); product analytics (consent where required). ⚖️ Map each purpose to DPDP "specified purpose" notices and PDPL legal bases; confirm whether analytics needs separate consent in either country.

## 5. Children

The Service is for adults (18+). We do not knowingly collect data from anyone under 18 and we do not offer the Service to minors. If we learn an account belongs to a minor we will close it and delete the data. ⚖️ If an under-18 flow is ever added: DPDP requires verifiable parental consent and forbids behavioural tracking of children; PostHog and all World features would need a child mode.

## 6. Where your data lives

Data is stored with Supabase in **Mumbai, India (ap-south-1)**, with web hosting on Vercel (Mumbai edge). For UAE residents this means your data is stored outside the UAE. ⚖️ PDPL cross-border transfer basis for UAE users (consent, contractual safeguards or adequacy) — wording needed here.

## 7. Who we share it with

Service providers that process data on our behalf: Supabase (database, storage, authentication), Vercel (hosting), Stripe (payments), Resend (email), Twilio or MSG91 (SMS codes), Sentry (errors), PostHog (analytics), Anthropic (AI photo scan — the photo you submit is sent for recognition and not used to train models). No data sales. Authorities where required by law.

## 8. How long we keep it

Account data while your account exists. On deletion we anonymise personal data immediately; **credits ledger and purchase records are retained for accounting with your identity pseudonymised** (⚖️ confirm retention periods: UAE 5 years, India 8 years under GST?). Event-log rows are retained for security auditing with the same pseudonymisation. Guestbook messages, meetup records and race results you took part in may remain visible to others with your handle replaced.

## 9. Your rights

Access, correction, deletion (in-app: Settings → Delete account), export (in-app: Settings → Export), withdrawal of consent, and complaint. ⚖️ DPDP: nominate a person in case of death/incapacity; grievance redressal timelines. PDPL: right to object to automated decisions (none are made that produce legal effects).

## 10. Security

Row-level access control on every table, private storage buckets, signed-in access only for personal data, and no third-party fonts or trackers beyond those listed. Report a vulnerability to the contact below.

## 11. Contact and grievance officer

⚖️ Name, address and email of the grievance officer / data protection contact; acknowledgement and resolution timelines.

## 12. Changes

We show the new version at sign-in and record your acceptance.
