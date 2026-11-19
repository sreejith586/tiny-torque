-- flag_descriptions_refresh — MV-S11 polish. The D-018 kill-switch catalogue was seeded in
-- 20260929010000 while nothing was built, so /admin/flags still described shipped features as
-- "Not yet built." Reference-data copy only; `enabled` and `audience` are untouched.
update public.feature_flags set description = v.description
from (values
  ('invite_only',         'Pilot invite gate: onboarding needs a valid invite code (F-01, D-016); enforced by the database since S11.'),
  ('email_otp',           'Email one-time-code sign-in (F-01, D-037). Live since S0.'),
  ('ai_scan',             'AI photo scan kill switch (F-03, D-018): single-car scan on the add-car screen.'),
  ('ai_scan_group',       'Batch photo scan kill switch (F-03): one photo of several cars, metered per scan.'),
  ('csv_import',          'Spreadsheet (CSV/XLSX) garage import kill switch (F-04, D-018).'),
  ('marketplace_publish', 'Listing publish kill switch (F-06, D-018): OFF hides Publish and stops new listings going live.'),
  ('offers',              'Offers and trade proposals kill switch (F-08, D-018): OFF shows Deals as "coming soon".'),
  ('deal_chat',           'Deal chat kill switch (F-09, D-018): messaging inside an accepted deal.'),
  ('token_purchase',      'Token pack purchase via Stripe Checkout (F-11, D-018). Keep OFF until real Stripe keys and pricing (D-024).'),
  ('pro_purchase',        'Pro plan purchase via Stripe (F-11). Keep OFF until real Stripe keys and pricing (D-024).')
) as v(key, description)
where feature_flags.key = v.key;
