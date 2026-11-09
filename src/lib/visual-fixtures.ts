import type { ProfileRow, CountryRow, PublicProfileRow } from '@/types/database';
import type { GarageItem } from '@/domain/garage';
import type { Badge } from '@/domain/gamification/types';
import type { Listing } from '@/domain/marketplace';
import type { TokenPackRow, TokenLedgerRow } from '@/domain/tokens';
import type { QuestBoard, QuestStatus, SeasonRow, SeasonTrackView } from '@/domain/quests';
import type { DealMessageRow } from '@/domain/messaging';
import {
  hostFee,
  type HostCapacity,
  type MeetupDetail,
  type MeetupListItem,
  type MeetupRow,
  type MeetupRsvpRow,
  type MeetupStatus,
  type PublicIdentity,
} from '@/domain/meetups';
import type {
  GuestbookEntry,
  OwnGarage,
  RecentVisitor,
  VisitorGarage,
  WorldGarageRow,
  WorldInventoryRow,
  WorldInviteRow,
  WorldItemRow,
  WorldLevelRow,
  WorldOpenGarageRow,
} from '@/domain/world/types';

// D-027 / D-041 visual-baseline harness. `?__visual=1` makes the signed-in pages (garage, car
// detail, profile; add/scan/offers need no data) render this deterministic fixture data with no
// Supabase session, at their real URLs, so Playwright can pixel-compare the bottom bar, headers,
// cards, buttons and icons in all six themes. Never honoured in production (VERCEL_ENV).

type SearchParams = URLSearchParams | Record<string, string | string[] | undefined>;

/** Name of the cookie the visual spec sets to trigger the harness. A cookie (unlike the ?__visual
 * query) reaches the server on every request and survives Vercel's redirects, so anon routes like
 * /market detect the harness deterministically — see src/app/market/page.tsx + src/proxy.ts. */
export const VISUAL_COOKIE = 'mv_visual';

/** The harness is never honoured in production (real data only there). */
export function harnessAllowed(): boolean {
  return process.env.VERCEL_ENV !== 'production';
}

export function isVisualHarness(searchParams: SearchParams | undefined): boolean {
  if (!harnessAllowed() || !searchParams) return false;
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
  bio: 'Hot Wheels mainlines and the odd Treasure Hunt. Bengaluru based.',
  banner_media_id: null,
  pro_until: null,
  xp: 320,
  level: 3,
  scan_quota_used: 0,
  scan_quota_bonus: 0,
  scan_quota_reset_at: '2026-09-01T08:00:00.000Z',
  onboarding_completed_at: '2026-09-01T08:00:00.000Z',
  tutorial_dismissed_at: null,
  purged_at: null,
  age_confirmed_at: '2026-09-01T08:00:00.000Z',
  terms_version: '1',
  suspended_until: null,
  rating_avg: null,
  rating_count: 0,
};

// F-14: /u/{handle} reads public_profiles, not profiles — a distinct (narrower) shape.
// F-13 (MV-S8-03): badge grid for the ?__visual harness — two unlocked, three in progress.
export const FIXTURE_BADGES: Badge[] = [
  {
    key: 'first_add',
    name: 'First Add',
    description: 'Add your first car to the garage.',
    icon: 'add',
    progress: 1,
    target: 1,
    unlocked: true,
    unlockedAt: '2026-09-02T08:00:00.000Z',
  },
  {
    key: 'growing_garage',
    name: 'Growing Garage',
    description: 'Reach 25 cars in your garage.',
    icon: 'garage',
    progress: 6,
    target: 25,
    unlocked: false,
    unlockedAt: null,
  },
  {
    key: 'treasure_hunter',
    name: 'Treasure Hunter',
    description: 'Own 5 cars rarer than common.',
    icon: 'bolt',
    progress: 2,
    target: 5,
    unlocked: false,
    unlockedAt: null,
  },
  {
    key: 'deal_maker',
    name: 'Deal Maker',
    description: 'Complete your first deal.',
    icon: 'offers',
    progress: 1,
    target: 1,
    unlocked: true,
    unlockedAt: '2026-09-20T08:00:00.000Z',
  },
  {
    key: 'value_collector',
    name: 'Value Collector',
    description: 'Your collection is worth 1,000 or more.',
    icon: 'market',
    progress: 310,
    target: 1000,
    unlocked: false,
    unlockedAt: null,
  },
];

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
  avatar_media_id: FIXTURE_PROFILE.photo_url,
  banner_media_id: FIXTURE_PROFILE.banner_media_id,
  rating_avg: null,
  rating_count: 0,
};

// F-06: /market browse renders these through the `?__visual=1` harness (anon-friendly, no session).
const listingBase = {
  source_item_id: null as string | null,
  seller_id: OWNER,
  seller_type: 'individual' as string | null,
  seller_photo: null as string | null,
  seller_name: 'Varun' as string | null,
  seller_location: null as string | null,
  seller_mobile: null as string | null,
  model: null as string | null,
  variant: null as string | null,
  rarity: null as string | null,
  condition: 'mint' as string | null,
  qty: 1,
  open_to_offers: true,
  open_to_trade: false,
  photo: null as string | null,
  photos: [] as unknown as Listing['photos'],
  offers: [] as unknown as Listing['offers'],
  status: 'active' as Listing['status'],
  created_at: '2026-09-20T08:00:00.000Z',
  updated_at: '2026-09-20T08:00:00.000Z',
  deleted_at: null as string | null,
  catalog_model_id: null as string | null,
  listing_type: 'sale' as Listing['listing_type'],
  currency: 'AED',
  country_code: 'AE' as string | null,
  min_offer: null as number | null,
  description: null as string | null,
  view_count: 0,
  favorite_count: 0,
  offer_count: 0,
  expires_at: '2026-11-20T08:00:00.000Z',
  sold_at: null as string | null,
  sold_offer_id: null as string | null,
  search: null as unknown as Listing['search'],
};

export const FIXTURE_LISTINGS: Listing[] = [
  {
    ...listingBase,
    id: '20000000-0000-4000-8000-000000000001',
    // marketplace bridge (W03): this listing sells the featured car in the garage fixtures
    source_item_id: FIXTURE_ITEMS[0]!.id,
    brand: 'Hot Wheels',
    model: 'Nissan Skyline GT-R',
    variant: 'Blue',
    price: 45,
    listing_type: 'sale',
    favorite_count: 3,
    media: [{ id: 'fix-l1', url: PHOTO }],
  },
  {
    ...listingBase,
    id: '20000000-0000-4000-8000-000000000002',
    brand: 'Tomica',
    model: 'Toyota Supra',
    variant: 'Red',
    price: 30,
    listing_type: 'both',
    open_to_trade: true,
    offer_count: 2,
    media: [{ id: 'fix-l2', url: PHOTO }],
  },
  {
    ...listingBase,
    id: '20000000-0000-4000-8000-000000000003',
    brand: 'Mini GT',
    model: 'Lamborghini Huracán',
    price: 60,
    listing_type: 'trade',
    open_to_offers: false,
    open_to_trade: true,
    media: [{ id: 'fix-l3', url: PHOTO }],
  },
];

// S7 tokens store / history (MV-S7-05).
export const FIXTURE_PACKS: TokenPackRow[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    sku: 'pack_small',
    tokens: 50,
    price_amount: 19,
    price_currency: 'AED',
    stripe_price_id: null,
    active: true,
    sort_order: 1,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    sku: 'pack_large',
    tokens: 150,
    price_amount: 49,
    price_currency: 'AED',
    stripe_price_id: null,
    active: true,
    sort_order: 2,
  },
];

export const FIXTURE_LEDGER: TokenLedgerRow[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    user_id: OWNER,
    delta: 50,
    balance_after: 50,
    reason: 'purchase',
    ref_type: 'token_purchase',
    ref_id: null,
    idempotency_key: 'fix-evt-1',
    source: 'purchased',
    remaining: 30,
    consumed_earned: null,
    created_at: '2026-09-05T08:00:00.000Z',
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    user_id: OWNER,
    delta: -20,
    balance_after: 30,
    reason: 'spend_listing_slot',
    ref_type: null,
    ref_id: null,
    idempotency_key: null,
    source: 'purchased',
    remaining: null,
    consumed_earned: 0,
    created_at: '2026-09-10T08:00:00.000Z',
  },
];

// ---------- Collectors World (MV-W02, F-20/F-27) — dark until the world* flags turn on ----------
export const FIXTURE_WORLD_LEVELS: WorldLevelRow[] = [
  {
    level: 1,
    name: 'Shed',
    display_slots: 4,
    decor_slots: 2,
    visitor_cap: 10,
    host_cap: 0,
    price: 0,
    min_xp_level: 1,
    max_extra_slots: 2,
  },
  {
    level: 2,
    name: 'Garage',
    display_slots: 8,
    decor_slots: 4,
    visitor_cap: 25,
    host_cap: 10,
    price: 40,
    min_xp_level: 2,
    max_extra_slots: 3,
  },
  {
    level: 3,
    name: 'Showroom',
    display_slots: 12,
    decor_slots: 6,
    visitor_cap: 50,
    host_cap: 25,
    price: 90,
    min_xp_level: 3,
    max_extra_slots: 4,
  },
  {
    level: 4,
    name: 'Warehouse',
    display_slots: 20,
    decor_slots: 8,
    visitor_cap: 100,
    host_cap: 50,
    price: 180,
    min_xp_level: 4,
    max_extra_slots: 5,
  },
  {
    level: 5,
    name: 'Vault',
    display_slots: 30,
    decor_slots: 12,
    visitor_cap: 200,
    host_cap: 100,
    price: 350,
    min_xp_level: 5,
    max_extra_slots: 6,
  },
];

const WI = (n: number) => `50000000-0000-4000-8000-00000000000${n}`;
export const FOUNDERS_SEASON_ID = '00000000-0000-4000-8000-00000000f001';
/** A Spotlight bought "20 hours ago" relative to the viewer — keeps the active label honest. */
const FIXTURE_SPOTLIGHT_UNTIL = new Date(Date.now() + 20 * 3600_000).toISOString();

const worldItemBase = {
  description: null,
  season_id: null,
  active: true,
  art_path: null,
  effect: {} as Record<string, string>,
  sort_order: 0,
  created_at: '2026-10-20T00:00:00.000Z',
};
export const FIXTURE_WORLD_ITEMS: WorldItemRow[] = [
  {
    ...worldItemBase,
    id: WI(1),
    sku: 'theme_neon_workshop',
    kind: 'theme',
    name: 'Neon Workshop',
    price: 25,
    min_level: 1,
    sort_order: 10,
  },
  {
    ...worldItemBase,
    id: WI(2),
    sku: 'theme_showroom_white',
    kind: 'theme',
    name: 'Showroom White',
    price: 25,
    min_level: 3,
    sort_order: 11,
  },
  {
    ...worldItemBase,
    id: WI(3),
    sku: 'decor_neon_sign',
    kind: 'decor',
    name: 'Neon sign',
    price: 10,
    min_level: 1,
    sort_order: 20,
  },
  {
    ...worldItemBase,
    id: WI(4),
    sku: 'signage_welcome',
    kind: 'signage',
    name: 'Welcome board',
    price: 0,
    min_level: 1,
    sort_order: 30,
  },
  {
    ...worldItemBase,
    id: WI(5),
    sku: 'trophy_first_meetup',
    kind: 'trophy',
    name: 'First meetup',
    price: null,
    min_level: 1,
    sort_order: 40,
  },
  {
    ...worldItemBase,
    id: WI(6),
    sku: 'extra_display_slot',
    kind: 'consumable',
    name: 'Extra display slot',
    price: 15,
    min_level: 1,
    effect: { grants: 'display_slot' },
    sort_order: 1000,
  },
  {
    ...worldItemBase,
    id: WI(7),
    sku: 'garage_rename',
    kind: 'consumable',
    name: 'Garage rename',
    price: 5,
    min_level: 1,
    effect: { grants: 'rename' },
    sort_order: 1001,
  },
  // ---- W05 (0014c placeholder catalogue): Spotlight, tunes, season-limited decor, season trophy ----
  {
    ...worldItemBase,
    id: WI(8),
    sku: 'spotlight_24h',
    kind: 'consumable',
    name: 'Spotlight (24 h)',
    description: 'Your garage at the top of Open garages for 24 hours. Labelled Spotlight.',
    price: 20,
    min_level: 1,
    effect: { grants: 'spotlight', hours: '24' },
    sort_order: 1002,
  },
  {
    ...worldItemBase,
    id: WI(9),
    sku: 'tune_street',
    kind: 'tune',
    name: 'Street tune',
    description: 'A small boost to acceleration in races (racing arrives later).',
    price: 30,
    min_level: 2,
    effect: { stat: 'accel', pct: '2' },
    sort_order: 50,
  },
  {
    ...worldItemBase,
    id: WI(10),
    sku: 'decor_founders_banner',
    kind: 'decor',
    name: 'Founders banner',
    description: "Only sold during the Founders' Season.",
    price: 15,
    min_level: 1,
    season_id: FOUNDERS_SEASON_ID,
    sort_order: 24,
  },
  {
    ...worldItemBase,
    id: WI(11),
    sku: 'decor_tool_wall',
    kind: 'decor',
    name: 'Tool wall',
    price: 15,
    min_level: 1,
    sort_order: 21,
  },
  {
    ...worldItemBase,
    id: WI(12),
    sku: 'trophy_season_finisher',
    kind: 'trophy',
    name: 'Season finisher',
    description: 'Earned by finishing a season track.',
    price: null,
    min_level: 1,
    sort_order: 60,
  },
];

export const FIXTURE_WORLD_INVENTORY: WorldInventoryRow[] = [
  {
    id: '51000000-0000-4000-8000-000000000001',
    user_id: OWNER,
    item_id: WI(3),
    acquired_via: 'purchase',
    ledger_id: null,
    durable: true,
    expires_at: null,
    created_at: '2026-10-21T08:00:00.000Z',
  },
  {
    id: '51000000-0000-4000-8000-000000000002',
    user_id: OWNER,
    item_id: WI(1),
    acquired_via: 'purchase',
    ledger_id: null,
    durable: true,
    expires_at: null,
    created_at: '2026-10-22T08:00:00.000Z',
  },
  {
    id: '51000000-0000-4000-8000-000000000003',
    user_id: OWNER,
    item_id: WI(11),
    acquired_via: 'purchase',
    ledger_id: null,
    durable: true,
    expires_at: null,
    created_at: '2026-11-01T08:00:00.000Z',
  },
  {
    id: '51000000-0000-4000-8000-000000000004',
    user_id: OWNER,
    item_id: WI(8),
    acquired_via: 'purchase',
    ledger_id: null,
    durable: false,
    expires_at: FIXTURE_SPOTLIGHT_UNTIL,
    created_at: '2026-11-05T12:00:00.000Z',
  },
];

export const FIXTURE_WORLD_GARAGE: WorldGarageRow = {
  user_id: OWNER,
  level: 2,
  name: "Varun's Garage",
  open_mode: 'public',
  featured_item_id: FIXTURE_ITEMS[0]!.id,
  theme_item_id: WI(1),
  layout: {
    version: 1,
    slots: [
      { slot: 0, itemId: FIXTURE_ITEMS[1]!.id },
      { slot: 1, itemId: FIXTURE_ITEMS[3]!.id },
    ],
    decor: [{ slot: 0, itemId: WI(3) }],
  },
  score: 120,
  extra_slots: 1,
  rename_count: 1,
  visit_count: 37,
  kudos_count: 12,
  created_at: '2026-10-20T00:00:00.000Z',
  updated_at: '2026-10-22T08:00:00.000Z',
};

export const FIXTURE_WORLD_OWN: OwnGarage = {
  garage: FIXTURE_WORLD_GARAGE,
  level: FIXTURE_WORLD_LEVELS[1]!,
  nextLevel: FIXTURE_WORLD_LEVELS[2]!,
  displayCapacity: FIXTURE_WORLD_LEVELS[1]!.display_slots + FIXTURE_WORLD_GARAGE.extra_slots,
  inventory: FIXTURE_WORLD_INVENTORY,
  layout: {
    version: 1,
    slots: [
      { slot: 0, itemId: FIXTURE_ITEMS[1]!.id },
      { slot: 1, itemId: FIXTURE_ITEMS[3]!.id },
    ],
    decor: [{ slot: 0, itemId: WI(3) }],
  },
};

// ---------- W03 visits & social (MV-W03-03/04/05) ----------
const VISITOR_A = '00000000-0000-4000-8000-000000000011';
const VISITOR_B = '00000000-0000-4000-8000-000000000012';

export const FIXTURE_WORLD_VISITOR: VisitorGarage = {
  garage: {
    user_id: OWNER,
    level: FIXTURE_WORLD_GARAGE.level,
    name: FIXTURE_WORLD_GARAGE.name,
    open_mode: 'public',
    featured_item_id: FIXTURE_WORLD_GARAGE.featured_item_id,
    theme_item_id: FIXTURE_WORLD_GARAGE.theme_item_id,
    score: FIXTURE_WORLD_GARAGE.score,
    visit_count: 48,
    kudos_count: 17,
    created_at: FIXTURE_WORLD_GARAGE.created_at,
  },
  level: FIXTURE_WORLD_LEVELS[1]!,
  layout: FIXTURE_WORLD_OWN.layout,
  owner: { id: OWNER, handle: FIXTURE_PROFILE.handle, displayName: FIXTURE_PROFILE.display_name },
};

export const FIXTURE_WORLD_GUESTBOOK: GuestbookEntry[] = [
  {
    id: '52000000-0000-4000-8000-000000000001',
    body: 'That R34 is unreal. Treasure Hunt too?!',
    createdAt: '2026-10-30T09:12:00.000Z',
    hidden: false,
    author: { id: VISITOR_A, handle: 'diecast_dxb', displayName: 'Rafiq' },
  },
  {
    id: '52000000-0000-4000-8000-000000000002',
    body: 'Came for the Defender, stayed for the lighting.',
    createdAt: '2026-10-28T18:40:00.000Z',
    hidden: false,
    author: { id: VISITOR_B, handle: 'blr_castings', displayName: 'Meera' },
  },
];

export const FIXTURE_WORLD_VISITORS: RecentVisitor[] = [
  { visitorId: VISITOR_A, handle: 'diecast_dxb', displayName: 'Rafiq', visitedOn: '2026-11-02' },
  { visitorId: VISITOR_B, handle: 'blr_castings', displayName: 'Meera', visitedOn: '2026-11-01' },
];

export const FIXTURE_WORLD_OPEN: WorldOpenGarageRow[] = [
  {
    user_id: VISITOR_A,
    name: 'Rafiq’s Showroom',
    level: 3,
    score: 310,
    featured_item_id: null,
    visit_count: 120,
    kudos_count: 44,
    updated_at: '2026-11-02T10:00:00.000Z',
    handle: 'diecast_dxb',
    display_name: 'Rafiq',
    country_code: 'AE',
    city: 'Dubai',
    spotlight_until: FIXTURE_SPOTLIGHT_UNTIL,
  },
  {
    user_id: OWNER,
    name: FIXTURE_WORLD_GARAGE.name,
    level: 2,
    score: 120,
    featured_item_id: FIXTURE_WORLD_GARAGE.featured_item_id,
    visit_count: 48,
    kudos_count: 17,
    updated_at: '2026-11-01T10:00:00.000Z',
    handle: FIXTURE_PROFILE.handle,
    display_name: FIXTURE_PROFILE.display_name,
    country_code: 'IN',
    city: 'Bengaluru',
    spotlight_until: null,
  },
  {
    user_id: VISITOR_B,
    name: 'Meera’s Shed',
    level: 1,
    score: 40,
    featured_item_id: null,
    visit_count: 9,
    kudos_count: 3,
    updated_at: '2026-10-30T10:00:00.000Z',
    handle: 'blr_castings',
    display_name: 'Meera',
    country_code: 'IN',
    city: 'Bengaluru',
    spotlight_until: null,
  },
];

export const FIXTURE_WORLD_INVITES: WorldInviteRow[] = [
  {
    id: '53000000-0000-4000-8000-000000000001',
    garage_user_id: OWNER,
    token: 'a'.repeat(64),
    invitee_id: null,
    expires_at: '2026-11-09T10:00:00.000Z',
    max_uses: 10,
    used_count: 2,
    revoked_at: null,
    created_at: '2026-11-02T10:00:00.000Z',
  },
  {
    id: '53000000-0000-4000-8000-000000000002',
    garage_user_id: OWNER,
    token: 'b'.repeat(64),
    invitee_id: VISITOR_B,
    expires_at: '2026-11-09T10:00:00.000Z',
    max_uses: 1,
    used_count: 0,
    revoked_at: null,
    created_at: '2026-11-02T11:00:00.000Z',
  },
];

// ---------- W04 quests & season (MV-W04-05, F-26) — dark until `world_earn` turns on ----------
const quest = (
  key: string,
  cadence: QuestStatus['cadence'],
  title: string,
  event: string,
  threshold: number,
  progress: number,
  rewardCredits: number,
  rewardXp: number
): QuestStatus => ({
  key,
  cadence,
  title,
  description: null,
  event,
  threshold,
  progress,
  percent: Math.round((progress / threshold) * 100),
  completed: progress >= threshold,
  completedAt: progress >= threshold ? '2026-11-06T09:00:00.000Z' : null,
  rewardCredits,
  rewardXp,
  periodStart: cadence === 'daily' ? '2026-11-06' : '2026-11-02',
  periodEnd: cadence === 'daily' ? '2026-11-07' : '2026-11-09',
});

export const FIXTURE_QUEST_BOARD: QuestBoard = {
  daily: [
    quest('visit_garage', 'daily', 'Visit a garage', 'world.visited', 1, 1, 2, 10),
    quest('give_kudos', 'daily', 'Give kudos', 'world.kudos_given', 1, 0, 2, 10),
    quest('sign_guestbook', 'daily', 'Sign a guestbook', 'world.guestbook_posted', 1, 0, 2, 10),
  ],
  weekly: [
    quest('weekly_visits', 'weekly', 'Visit 10 garages this week', 'world.visited', 10, 4, 8, 40),
    quest('weekly_kudos', 'weekly', 'Give kudos 5 times', 'world.kudos_given', 5, 5, 8, 40),
    quest('weekly_open_days', 'weekly', 'Open TinyTorque on 5 days', 'user.opened', 5, 3, 8, 40),
  ],
  streak: 3,
  season: {
    id: '00000000-0000-4000-8000-00000000f001',
    name: "Founders' Season",
    theme: 'founders',
    startsAt: '2026-11-10T00:00:00.000Z',
    endsAt: '2027-01-05T00:00:00.000Z',
    points: 120,
  },
};

// ---- W05: seasons + the season track page (MV-W05-01/03) ----
export const FIXTURE_SEASONS: SeasonRow[] = [
  {
    id: FOUNDERS_SEASON_ID,
    name: "Founders' Season",
    theme: 'founders',
    starts_at: '2026-11-10T00:00:00.000Z',
    ends_at: '2027-01-05T00:00:00.000Z',
    track: [
      { points: 50, reward_credits: 5, label: 'Warm-up' },
      { points: 150, reward_credits: 10, label: 'On the road' },
      {
        points: 300,
        reward_credits: 25,
        label: 'Season finisher',
        reward_item_sku: 'trophy_season_finisher',
      },
    ],
    announced_at: '2026-11-10T00:00:00.000Z',
    closed_at: null,
    created_at: '2026-11-06T00:00:00.000Z',
  },
];

export const FIXTURE_SEASON_TRACK: SeasonTrackView = {
  season: {
    id: FOUNDERS_SEASON_ID,
    name: "Founders' Season",
    theme: 'founders',
    startsAt: '2026-11-10T00:00:00.000Z',
    endsAt: '2027-01-05T00:00:00.000Z',
    points: 120,
  },
  milestones: [
    {
      index: 1,
      label: 'Warm-up',
      points: 50,
      rewardCredits: 5,
      rewardItemSku: null,
      reached: true,
      paid: true,
      remaining: 0,
    },
    {
      index: 2,
      label: 'On the road',
      points: 150,
      rewardCredits: 10,
      rewardItemSku: null,
      reached: false,
      paid: false,
      remaining: 30,
    },
    {
      index: 3,
      label: 'Season finisher',
      points: 300,
      rewardCredits: 25,
      rewardItemSku: 'trophy_season_finisher',
      reached: false,
      paid: false,
      remaining: 180,
    },
  ],
  next: {
    index: 2,
    label: 'On the road',
    points: 150,
    rewardCredits: 10,
    rewardItemSku: null,
    reached: false,
    paid: false,
    remaining: 30,
  },
  percent: 70,
  daysLeft: 42,
  finisherItemSku: 'trophy_season_finisher',
};

// ---------- W06 virtual meetups (MV-W06-03/04, F-23) — dark until `world_meetups` turns on ----------
const MEETUP_A = '00000000-0000-4000-8000-00000000a001'; // Rafiq hosts, the viewer is going
const MEETUP_B = '00000000-0000-4000-8000-00000000a002'; // the viewer hosts (draft → scheduled)
const MEETUP_C = '00000000-0000-4000-8000-00000000a003'; // Meera hosts, followers only, viewer waitlisted
const RAFIQ: PublicIdentity = { id: VISITOR_A, handle: 'diecast_dxb', displayName: 'Rafiq' };
const MEERA: PublicIdentity = { id: VISITOR_B, handle: 'blr_castings', displayName: 'Meera' };
const ME: PublicIdentity = { id: OWNER, handle: 'varun', displayName: 'Varun' };
/** Fixed instants (Nov 2026) so the rendered "when" never depends on the review date. */
const MEETUP_A_START = '2026-11-21T18:00:00.000Z';
const MEETUP_B_START = '2026-11-28T15:30:00.000Z';
const MEETUP_C_START = '2026-11-22T14:00:00.000Z';

const meetupRow = (
  over: Partial<MeetupRow> & Pick<MeetupRow, 'id' | 'host_id' | 'title'>
): MeetupRow => ({
  club_id: null,
  garage_user_id: over.host_id,
  kind: 'virtual',
  theme: null,
  description: null,
  starts_at: MEETUP_A_START,
  ends_at: '2026-11-21T20:00:00.000Z',
  capacity: 10,
  showcase_limit: 3,
  visibility: 'public',
  status: 'scheduled',
  fee_paid: 5,
  fee_ledger_id: null,
  refund_ledger_id: null,
  scheduled_at: '2026-11-10T09:00:00.000Z',
  started_at: null,
  ended_at: null,
  cancelled_at: null,
  created_at: '2026-11-10T09:00:00.000Z',
  updated_at: '2026-11-10T09:00:00.000Z',
  ...over,
});

const FIXTURE_MEETUP_A = meetupRow({
  id: MEETUP_A,
  host_id: VISITOR_A,
  title: 'JDM night',
  theme: 'Skylines, Supras, Silvias',
  description: 'Bring your best JDM castings. Three cars each, stories welcome.',
  capacity: 10,
});
const FIXTURE_MEETUP_B = meetupRow({
  id: MEETUP_B,
  host_id: OWNER,
  title: 'Treasure Hunt show-and-tell',
  theme: 'TH & Super TH',
  starts_at: MEETUP_B_START,
  ends_at: '2026-11-28T17:00:00.000Z',
  capacity: 8,
  status: 'draft',
  fee_paid: 0,
  scheduled_at: null,
});
const FIXTURE_MEETUP_C = meetupRow({
  id: MEETUP_C,
  host_id: VISITOR_B,
  title: 'Matchbox Monday',
  starts_at: MEETUP_C_START,
  ends_at: '2026-11-22T15:30:00.000Z',
  capacity: 2,
  visibility: 'followers',
});

export const FIXTURE_HOST_CAPACITY: HostCapacity = {
  cap: 10,
  level: 2,
  levelName: 'Garage',
  isPro: false,
  fee: hostFee,
};

export const FIXTURE_MEETUPS: MeetupListItem[] = [
  { meetup: FIXTURE_MEETUP_A, host: RAFIQ, goingCount: 6, myRsvp: 'going', isHost: false },
  { meetup: FIXTURE_MEETUP_C, host: MEERA, goingCount: 2, myRsvp: 'waitlist', isHost: false },
  { meetup: FIXTURE_MEETUP_B, host: ME, goingCount: 0, myRsvp: null, isHost: true },
];

const rsvpRow = (
  over: Partial<MeetupRsvpRow> & Pick<MeetupRsvpRow, 'meetup_id' | 'user_id'>
): MeetupRsvpRow => ({
  status: 'going',
  role: 'attendee',
  muted_at: null,
  removed_at: null,
  checked_in_at: null,
  created_at: '2026-11-11T10:00:00.000Z',
  updated_at: '2026-11-11T10:00:00.000Z',
  ...over,
});

/** The detail page in two seats: `attendee` = the viewer is going to Rafiq's JDM night (showcase
 *  picker, RSVP); `host` = the viewer's own draft (host controls, schedule + fee). `live` flips the
 *  status so the room renders. `id` is echoed back so in-app links keep working. */
export function fixtureMeetupDetail(
  id: string,
  seat: 'host' | 'attendee',
  status: MeetupStatus | null = null
): MeetupDetail {
  const base = seat === 'host' ? FIXTURE_MEETUP_B : FIXTURE_MEETUP_A;
  const meetup: MeetupRow = {
    ...base,
    id,
    status: status ?? base.status,
    started_at: status === 'live' ? '2026-11-21T18:00:00.000Z' : base.started_at,
  };
  const itemA = FIXTURE_ITEMS[0]!;
  const itemB = FIXTURE_ITEMS[1]!;
  const itemC = FIXTURE_ITEMS[3]!;
  if (seat === 'host') {
    return {
      meetup,
      host: ME,
      viewer: {
        id: OWNER,
        isHost: true,
        isCohost: false,
        isStaff: true,
        rsvp: null,
        isMember: true,
        muted: false,
      },
      attendees: [
        { user: RAFIQ, status: 'going', role: 'cohost', muted: false, removed: false },
        { user: MEERA, status: 'going', role: 'attendee', muted: true, removed: false },
      ],
      goingCount: 2,
      waitlistCount: 0,
      showcase: [
        { id: 'sc-1', userId: VISITOR_A, itemId: itemC.id, position: 0, item: itemC, owner: RAFIQ },
      ],
      invites: [{ user: MEERA, createdAt: '2026-11-11T10:00:00.000Z' }],
    };
  }
  const mine = rsvpRow({ meetup_id: id, user_id: OWNER });
  return {
    meetup,
    host: RAFIQ,
    viewer: {
      id: OWNER,
      isHost: false,
      isCohost: false,
      isStaff: false,
      rsvp: mine,
      isMember: true,
      muted: false,
    },
    attendees: [
      { user: ME, status: 'going', role: 'attendee', muted: false, removed: false },
      { user: MEERA, status: 'going', role: 'attendee', muted: false, removed: false },
    ],
    goingCount: 6,
    waitlistCount: 1,
    showcase: [
      { id: 'sc-2', userId: OWNER, itemId: itemA.id, position: 0, item: itemA, owner: ME },
      { id: 'sc-3', userId: OWNER, itemId: itemB.id, position: 1, item: itemB, owner: ME },
      { id: 'sc-4', userId: VISITOR_B, itemId: itemC.id, position: 0, item: itemC, owner: MEERA },
    ],
    invites: [],
  };
}

const roomLine = (
  id: string,
  sender: string,
  body: string,
  reaction: string | null,
  at: string
): DealMessageRow => ({
  id,
  kind: 'meetup',
  meetup_id: MEETUP_A,
  offer_id: null,
  sender_id: sender,
  body,
  reaction,
  read_at: null,
  created_at: at,
});
export const FIXTURE_ROOM_MESSAGES: DealMessageRow[] = [
  roomLine(
    'rm-1',
    VISITOR_A,
    'Welcome in! Show us what you brought.',
    null,
    '2026-11-21T18:00:30.000Z'
  ),
  roomLine(
    'rm-2',
    OWNER,
    'R34 first — the one from the Dubai swap meet.',
    null,
    '2026-11-21T18:01:10.000Z'
  ),
  roomLine('rm-3', VISITOR_B, 'fire', 'fire', '2026-11-21T18:01:20.000Z'),
  roomLine(
    'rm-4',
    VISITOR_B,
    'That paint is unreal. Is it the 2019 release?',
    null,
    '2026-11-21T18:01:45.000Z'
  ),
];
