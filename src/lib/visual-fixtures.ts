import type { ProfileRow, CountryRow, PublicProfileRow } from '@/types/database';
import type { GarageItem } from '@/domain/garage';

// D-027 / D-041 visual-baseline harness. `?__visual=1` makes the signed-in pages (garage, car
// detail, profile; add/scan/offers need no data) render this deterministic fixture data with no
// Supabase session, at their real URLs, so Playwright can pixel-compare the bottom bar, headers,
// cards, buttons and icons in all six themes. Never honoured in production (VERCEL_ENV).

type SearchParams = URLSearchParams | Record<string, string | string[] | undefined>;

export function isVisualHarness(searchParams: SearchParams | undefined): boolean {
  if (process.env.VERCEL_ENV === 'production' || !searchParams) return false;
  if (searchParams instanceof URLSearchParams) return searchParams.has('__visual');
  return '__visual' in searchParams;
}

const OWNER = '00000000-0000-4000-8000-000000000001';

// 4:3 flat-colour "photo" so cards render the real <img> path without fetching anything.
const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#b45309"/><rect x="70" y="150" width="260" height="70" rx="18" fill="#fde68a"/><circle cx="130" cy="228" r="26" fill="#1f2937"/><circle cx="270" cy="228" r="26" fill="#1f2937"/></svg>'
  );

const base = {
  owner_id: OWNER,
  created_at: '2026-09-01T08:00:00.000Z',
  updated_at: '2026-09-01T08:00:00.000Z',
  deleted_at: null,
  source: 'manual',
  for_sale: false,
  open_to_offers: false,
  open_to_trade: false,
  ask_price: null,
  card_type: null,
  condition: null,
  rarity: null,
  series: null,
  variant: null,
  scale: '1:64',
  qty: 1,
  price_paid: 0,
  is_public: true,
  photos: [] as string[],
  photo: null as string | null,
  // garage_v2 (MV-S2-03) additive columns
  catalog_model_id: null as string | null,
  color: null as string | null,
  is_favorite: false,
  notes: null as string | null,
  currency: null as string | null,
  search: null as string | null,
  // media for display (DisplayMedia[]) — data-URL previews so the harness renders photos
  media: [] as { id: string; url?: string | null }[],
};

export const FIXTURE_ITEMS: GarageItem[] = [
  {
    ...base,
    id: '10000000-0000-4000-8000-000000000001',
    brand: 'Hot Wheels',
    model: 'Nissan Skyline GT-R (R34)',
    series: 'Fast & Furious',
    variant: 'Silver',
    rarity: 'Super Treasure Hunt',
    condition: 'Mint on card',
    card_type: 'Long card',
    price_paid: 45,
    photo: PHOTO,
    photos: [PHOTO, PHOTO],
    for_sale: true,
    open_to_offers: true,
    ask_price: 120,
    media: [
      { id: 'fix-1a', url: PHOTO },
      { id: 'fix-1b', url: PHOTO },
    ],
  },
  {
    ...base,
    id: '10000000-0000-4000-8000-000000000002',
    brand: 'Matchbox',
    model: 'Land Rover Defender 110',
    variant: 'Green',
    condition: 'Loose, good',
    qty: 2,
    price_paid: 12,
    photo: PHOTO,
    photos: [PHOTO],
    media: [{ id: 'fix-2', url: PHOTO }],
  },
  {
    ...base,
    id: '10000000-0000-4000-8000-000000000003',
    brand: 'Tomica',
    model: 'Toyota Land Cruiser',
    rarity: 'Regular',
    price_paid: 8,
    is_public: false,
  },
  {
    ...base,
    id: '10000000-0000-4000-8000-000000000004',
    brand: 'Mini GT',
    model: 'Porsche 911 GT3 RS',
    variant: 'Shark Blue',
    condition: 'Mint in box',
    price_paid: 65,
    photo: PHOTO,
    photos: [PHOTO],
    open_to_trade: true,
    media: [{ id: 'fix-4', url: PHOTO }],
  },
];

export const FIXTURE_COUNTRIES: CountryRow[] = [
  { code: 'AE', name: 'United Arab Emirates', dial_code: '+971', currency: 'AED', enabled: true },
  { code: 'IN', name: 'India', dial_code: '+91', currency: 'INR', enabled: true },
];

export const FIXTURE_PROFILE: ProfileRow = {
  id: OWNER,
  display_name: 'Varun',
  account_type: 'individual',
  store_name: null,
  location: 'Bengaluru',
  mobile: '+91 99999 00001',
  photo_url: null,
  plan: 'free',
  role: 'user',
  tokens: 0,
  created_at: '2026-09-01T08:00:00.000Z',
  updated_at: '2026-09-01T08:00:00.000Z',
  deleted_at: null,
  handle: 'varun',
  handle_changed_at: null,
  country_code: 'IN',
  city: 'Bengaluru',
  bio: null,
  pro_until: null,
  xp: 120,
  level: 3,
  scan_quota_used: 0,
  scan_quota_bonus: 0,
  scan_quota_reset_at: '2026-09-01T08:00:00.000Z',
  onboarding_completed_at: '2026-09-01T08:00:00.000Z',
  tutorial_dismissed_at: null,
};

// F-14: /u/{handle} reads public_profiles, not profiles — a distinct (narrower) shape.
export const FIXTURE_PUBLIC_PROFILE: PublicProfileRow = {
  id: FIXTURE_PROFILE.id,
  handle: FIXTURE_PROFILE.handle,
  display_name: FIXTURE_PROFILE.display_name,
  account_type: FIXTURE_PROFILE.account_type,
  store_name: FIXTURE_PROFILE.store_name,
  country_code: FIXTURE_PROFILE.country_code,
  city: FIXTURE_PROFILE.city,
  bio: FIXTURE_PROFILE.bio,
  level: FIXTURE_PROFILE.level,
  xp: FIXTURE_PROFILE.xp,
  created_at: FIXTURE_PROFILE.created_at,
  is_pro: FIXTURE_PROFILE.plan === 'pro',
};
