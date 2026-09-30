-- 0005_feature_flags_seed — MV-S1-06, D-018 kill-switch catalogue.
-- Reference-data seed, following the same precedent as identity_v2's countries insert: reference
-- rows a persistent branch needs after `db push` go in a migration, not supabase/seed.sql (which
-- only applies on `db reset` / ephemeral preview branches, D-033).
-- All "not yet built" flags default OFF (D-028: deployable dark, flag first). email_otp is ON
-- because it's been the live sign-in path since S0. invite_only is OFF because no UI enforces it
-- yet (MV-S1-04) -- flip it on once onboarding actually checks it.

insert into public.feature_flags (key, enabled, audience, description) values
  ('invite_only', false, '{}', 'Pilot invite gate for onboarding (F-01, D-016). Not yet enforced by any UI.'),
  ('email_otp', true, '{}', 'Email OTP sign-in path (F-01, D-037). Live since S0.'),
  ('ai_scan', false, '{}', 'AI photo scan kill switch (F-03, D-018). Not yet built.'),
  ('ai_scan_group', false, '{}', 'Group/multi-photo AI scan (F-03). Not yet built.'),
  ('csv_import', false, '{}', 'CSV/spreadsheet garage import kill switch (F-04, D-018). Not yet built.'),
  ('marketplace_publish', false, '{}', 'Listing publish kill switch (F-06, D-018). Not yet built.'),
  ('offers', false, '{}', 'Offers/deals kill switch (F-08, D-018). Not yet built.'),
  ('deal_chat', false, '{}', 'Deal chat kill switch (F-09, D-018). Not yet built.'),
  ('token_purchase', false, '{}', 'Token pack purchase kill switch (F-11, D-018). Not yet built.'),
  ('pro_purchase', false, '{}', 'Pro plan purchase (F-11). Not yet built.')
on conflict (key) do nothing;
