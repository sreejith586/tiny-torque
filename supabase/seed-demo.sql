-- Demo marketplace data for STAGING ONLY (D-055). NOT a migration and NOT reference data, so it
-- never goes in seed.sql (D-033) and never auto-applies to prod. Run manually via the
-- `seed-demo.yml` workflow against the staging branch DB. Idempotent: fixed UUIDs + ON CONFLICT
-- DO NOTHING, so re-running is a no-op.
--
-- Creates three demo sellers (auth.users + profiles) and a spread of active listings
-- (sale / trade / both, AE + IN, individual + shop). No media rows — listings with a null
-- source_item_id render the car-silhouette placeholder, which is fine for a browse demo.

begin;

-- ── Sellers ────────────────────────────────────────────────────────────────────────────────
-- auth.users: minimal rows (these demo accounts never sign in; anon browse only). Token columns
-- are set to '' for the NOT NULL '' defaults some Supabase versions carry; no password needed.
insert into auth.users
  (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token,
   raw_app_meta_data, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'demo-aarav@tinytorque.test',  now() - interval '2 years', now() - interval '2 years', now(),
   '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'demo-dubaidiecast@tinytorque.test', now() - interval '3 years', now() - interval '3 years', now(),
   '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'demo-meera@tinytorque.test',  now() - interval '1 year', now() - interval '1 year', now(),
   '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles
  (id, display_name, account_type, store_name, country_code, handle, plan, created_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'Aarav''s Garage',  'individual', null,                'IN', 'aarav',       'pro',  now() - interval '2 years'),
  ('a0000000-0000-4000-8000-000000000002', 'Dubai Diecast Co.', 'shop',       'Dubai Diecast Co.', 'AE', 'dubaidiecast', 'pro',  now() - interval '3 years'),
  ('a0000000-0000-4000-8000-000000000003', 'Meera Collects',    'individual', null,                'AE', 'meera',       'free', now() - interval '1 year')
on conflict (id) do nothing;

-- ── Listings ───────────────────────────────────────────────────────────────────────────────
insert into public.marketplace_listings
  (id, seller_id, seller_type, seller_name, brand, model, variant, condition, rarity,
   price, currency, listing_type, country_code, qty, open_to_offers, open_to_trade,
   status, description, created_at, expires_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'individual', 'Aarav''s Garage',
   'Hot Wheels', 'Nissan Skyline GT-R (R34)', 'Bayside Blue', 'Mint on card', 'regular',
   1200, 'INR', 'both', 'IN', 1, true, true, 'active',
   'Clean R34 from the 2023 JDM series. Card has light shelf wear only.', now() - interval '2 days', now() + interval '28 days'),

  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'individual', 'Aarav''s Garage',
   'Tomica', 'Toyota Supra A80', 'Red', 'Mint', 'regular',
   950, 'INR', 'sale', 'IN', 1, true, false, 'active',
   'Tomica Premium casting, displayed only. Box included.', now() - interval '5 days', now() + interval '25 days'),

  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'individual', 'Meera Collects',
   'Mini GT', 'Lamborghini Huracán STO', 'Arancio Xanto', 'Mint', 'limited',
   0, 'AED', 'trade', 'AE', 1, false, true, 'active',
   'Open to trades only — looking for JDM chases. No cash offers please.', now() - interval '1 day', now() + interval '29 days'),

  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'shop', 'Dubai Diecast Co.',
   'Hot Wheels', 'Mazda RX-7 FD', 'Black', 'Good', 'regular',
   60, 'AED', 'both', 'AE', 3, true, true, 'active',
   'Loose, in great shape. Multiple available.', now() - interval '3 days', now() + interval '27 days'),

  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'shop', 'Dubai Diecast Co.',
   'Kyosho', 'Honda NSX Type R', 'Championship White', 'Mint', 'premium',
   320, 'AED', 'sale', 'AE', 1, false, false, 'active',
   '1:64 Kyosho, sealed. A grail for NSX collectors.', now() - interval '8 days', now() + interval '22 days'),

  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'individual', 'Aarav''s Garage',
   'Hot Wheels', 'Datsun 240Z', 'Spectraflame Green', 'Mint on card', 'super treasure hunt',
   800, 'INR', 'sale', 'IN', 1, true, false, 'active',
   'STH with the circle-flame logo. Protector included.', now() - interval '6 hours', now() + interval '30 days'),

  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002', 'shop', 'Dubai Diecast Co.',
   'Tarmac Works', 'Nissan GT-R (R35) Nismo', 'Gunmetal', 'Mint', 'regular',
   180, 'AED', 'both', 'AE', 1, true, true, 'active',
   'Tarmac Works Global64. Rubber tyres, opening parts.', now() - interval '4 days', now() + interval '26 days'),

  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'individual', 'Aarav''s Garage',
   'Majorette', 'Bugatti Chiron', 'French Blue', 'Good', 'regular',
   650, 'INR', 'sale', 'IN', 1, true, false, 'active',
   'Majorette Deluxe, light play wear. Great starter grail.', now() - interval '10 days', now() + interval '20 days'),

  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000002', 'shop', 'Dubai Diecast Co.',
   'Mini GT', 'Porsche 911 (992) GT3', 'Racing Yellow', 'Mint', 'limited',
   140, 'AED', 'trade', 'AE', 1, false, true, 'active',
   'Shop trade stock — swap for Mini GT Skylines or Datsuns.', now() - interval '12 hours', now() + interval '29 days'),

  ('b0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000003', 'individual', 'Meera Collects',
   'Hot Wheels', 'Toyota AE86 Sprinter Trueno', 'White / Black', 'Mint on card', 'chase',
   110, 'AED', 'both', 'AE', 1, true, true, 'active',
   'The Takumi hauler''s favourite. Panda livery, carded.', now() - interval '7 days', now() + interval '23 days')
on conflict (id) do nothing;

commit;
