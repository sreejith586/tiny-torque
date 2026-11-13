-- MV-S10-06 (F-17) — load-sanity seed: 100 collectors, 5 000 garage items, 1 000 listings,
-- 500 offers, all marked so `cleanup-load.sql` removes exactly these rows.
--
--   STAGING ONLY. Never run against production.
--   psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm=staging -f scripts/load/seed-load.sql
--
-- Marker: every seeded profile has handle `load_NNNN` and its id starts with `10ad0000-`; items,
-- listings and offers hang off those profiles. Triggers are switched off for the session
-- (session_replication_role = replica) so the seed does not write 6 500 domain events, XP,
-- notifications or trip the per-plan listing limit and the offer rate limit — the point is table
-- volume for the read paths, not a simulation of activity. Idempotent: re-running adds nothing.
\if :{?confirm}
\else
  \echo 'Refusing to run: pass -v confirm=staging (this seed is for the staging database only).'
  \quit
\endif
select :'confirm' = 'staging' as ok \gset
\if :ok
\else
  \echo 'Refusing to run: confirm must be exactly "staging".'
  \quit
\endif

begin;
set local session_replication_role = replica;

-- ---------- 100 collectors (80 individuals, 20 shops; AE / IN split) ----------
insert into auth.users (id)
select ('10ad0000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid
from generate_series(1, 100) g
on conflict (id) do nothing;

insert into public.profiles (id, display_name, account_type, store_name, handle, country_code, city, plan, onboarding_completed_at)
select ('10ad0000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       'Load collector ' || g,
       case when g % 5 = 0 then 'shop' else 'individual' end::public.account_type,
       case when g % 5 = 0 then 'Load shop ' || g end,
       'load_' || lpad(g::text, 4, '0'),
       case when g % 2 = 0 then 'AE' else 'IN' end,
       case when g % 2 = 0 then 'Dubai' else 'Mumbai' end,
       'free', now()
from generate_series(1, 100) g
on conflict (id) do nothing;

-- ---------- 5 000 garage items (50 per collector) ----------
insert into public.collection_items
  (id, owner_id, brand, model, series, scale, rarity, condition, qty, price_paid, currency, is_public, for_sale, created_at)
select ('10ad0001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       ('10ad0000-0000-4000-8000-' || lpad((1 + (n - 1) / 50)::text, 12, '0'))::uuid,
       (array['Hot Wheels', 'Matchbox', 'Tomica', 'Majorette', 'Mini GT', 'Greenlight', 'Maisto', 'Kyosho'])[1 + n % 8],
       (array['Skyline GT-R', 'Porsche 911', 'Civic Type R', 'Mustang GT', 'Land Cruiser', 'Supra', 'Defender', 'Countach',
              'F40', 'Beetle', 'Bronco', 'RX-7', 'NSX', 'Golf GTI', 'Camaro', '911 Turbo'])[1 + (n * 7) % 16]
         || ' #' || n,
       (array['Mainline', 'Premium', 'Car Culture', 'Limited', 'Basic'])[1 + n % 5],
       '1:64',
       (array['common', 'common', 'common', 'uncommon', 'rare', 'super-rare', 'treasure-hunt', 'chase'])[1 + n % 8],
       (array['mint', 'near-mint', 'good', 'played'])[1 + n % 4],
       1 + n % 3,
       5 + (n % 60),
       case when ((n - 1) / 50) % 2 = 1 then 'AED' else 'INR' end,
       n % 3 <> 0,
       n % 5 = 0,
       now() - (n || ' minutes')::interval
from generate_series(1, 5000) n
on conflict (id) do nothing;

-- ---------- 1 000 listings (10 per collector, from their for_sale items) ----------
insert into public.marketplace_listings
  (id, source_item_id, seller_id, seller_type, seller_name, brand, model, rarity, condition, price, qty,
   open_to_offers, open_to_trade, status, listing_type, currency, country_code, description, expires_at, created_at)
select ('10ad0002-0000-4000-8000-' || lpad(i.n::text, 12, '0'))::uuid,
       i.id, i.owner_id,
       p.account_type::text, p.display_name,
       i.brand, i.model, i.rarity, i.condition,
       20 + (i.n % 400), 1,
       true, i.n % 2 = 0,
       case when i.n % 20 = 0 then 'sold' else 'active' end::public.listing_status,
       (enum_range(null::public.listing_type))[1],
       i.currency, p.country_code,
       'Load-test listing ' || i.n,
       now() + interval '30 days',
       now() - (i.n || ' minutes')::interval
from (
  select c.*, (substring(c.id::text from 25))::bigint as n
  from public.collection_items c
  where c.id::text like '10ad0001-%' and c.for_sale
) i
join public.profiles p on p.id = i.owner_id
on conflict (id) do nothing;

-- ---------- 500 offers (pending / accepted / declined / completed mix; buyer ≠ seller) ----------
insert into public.offers (id, listing_id, buyer_id, seller_id, type, amount, currency, status, created_at, expires_at, completed_at)
select ('10ad0003-0000-4000-8000-' || lpad(o.rn::text, 12, '0'))::uuid,
       o.id,
       ('10ad0000-0000-4000-8000-' || lpad((1 + (o.seller_n + 7 + o.rn % 13) % 100)::text, 12, '0'))::uuid,
       o.seller_id,
       'cash', o.price + 5, o.currency,
       (array['pending', 'pending', 'accepted', 'declined', 'completed'])[1 + o.rn % 5]::public.offer_status,
       now() - (o.rn || ' hours')::interval,
       now() + interval '3 days',
       case when o.rn % 5 = 4 then now() - (o.rn || ' minutes')::interval end
from (
  select l.id, l.seller_id, l.price, l.currency,
         (substring(l.seller_id::text from 25))::int as seller_n,
         row_number() over (order by l.id) as rn
  from public.marketplace_listings l
  where l.id::text like '10ad0002-%' and l.status = 'active'
  order by l.id
  limit 500
) o
on conflict (id) do nothing;

update public.marketplace_listings l
   set offer_count = (select count(*) from public.offers o where o.listing_id = l.id)
 where l.id::text like '10ad0002-%';

commit;

analyze public.profiles, public.collection_items, public.marketplace_listings, public.offers;

select 'profiles' as seeded, count(*) from public.profiles where handle like 'load\_%'
union all select 'collection_items', count(*) from public.collection_items where id::text like '10ad0001-%'
union all select 'marketplace_listings', count(*) from public.marketplace_listings where id::text like '10ad0002-%'
union all select 'offers', count(*) from public.offers where id::text like '10ad0003-%';
