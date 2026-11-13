// MV-S10-06 (F-17) — load sanity with k6: browse, search and garage, the three read paths every
// session hits. STAGING ONLY, after scripts/load/seed-load.sql (docs/load-test.md).
//
//   k6 run \
//     -e BASE_URL=https://<staging-host> \
//     -e SUPABASE_URL=https://<staging-ref>.supabase.co \
//     -e SUPABASE_ANON_KEY=<staging anon key> \
//     [-e USER_JWT=<access token of a test collector>] [-e USER_ID=<their uuid>] \
//     [-e VERCEL_BYPASS=<protection bypass secret>] \
//     scripts/load/k6-browse.js
//
// Two layers on purpose:
//   * pages    — the Next.js routes a visitor loads (`/`, `/market`, a search, a listing page);
//   * rest     — the PostgREST calls behind them, with the same filters and keyset order the repos
//                send (src/domain/marketplace/repo.ts browsePage, src/domain/garage/repo.ts
//                listPage), so a slow query shows up without the page render around it.
// The garage calls run only when USER_JWT + USER_ID are given (garage rows are owner-only by RLS).
// Thresholds are the pilot's reliability criterion (01 §6): p95 < 2.5 s per page, < 0.5 % errors;
// the REST layer gets a tighter 500 ms.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const SUPABASE_URL = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const ANON = __ENV.SUPABASE_ANON_KEY || '';
const USER_JWT = __ENV.USER_JWT || '';
const USER_ID = __ENV.USER_ID || '';
const BYPASS = __ENV.VERCEL_BYPASS || '';

if (!BASE_URL || !SUPABASE_URL || !ANON) {
  throw new Error('BASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY are required');
}
if (/tinytorque\.hypermaxsolutions\.com/.test(BASE_URL) || /whjqwcaoexbytspkaxfh/.test(SUPABASE_URL)) {
  throw new Error('This script must not run against production.');
}

const pageTime = new Trend('page_duration', true);
const restTime = new Trend('rest_duration', true);
const errors = new Rate('errors');

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 }, // warm up
        { duration: '2m', target: 30 }, // ≈ the whole pilot cohort online at once
        { duration: '1m', target: 60 }, // 2× head-room
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    page_duration: ['p(95)<2500'],
    rest_duration: ['p(95)<500'],
    errors: ['rate<0.005'],
    http_req_failed: ['rate<0.005'],
  },
};

const SEARCH_TERMS = ['supra', 'porsche', 'mustang', 'civic', 'defender', 'tomica', 'hot wheels', 'rx-7'];
const COUNTRIES = ['AE', 'IN'];
// The repo's own column list (browsePage) — marketplace_listings has column-level grants, so a
// `select=*` or a column outside this list is a 401 for anon, not a slow query.
const LISTING_COLS =
  'id,source_item_id,seller_id,seller_type,seller_name,seller_photo,brand,model,variant,rarity,condition,' +
  'price,qty,open_to_offers,open_to_trade,catalog_model_id,listing_type,currency,country_code,min_offer,' +
  'description,view_count,favorite_count,offer_count,expires_at,sold_at,status,created_at';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function pageHeaders() {
  return BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {};
}

function restHeaders(jwt) {
  return { apikey: ANON, Authorization: `Bearer ${jwt || ANON}`, Accept: 'application/json' };
}

function page(name, path) {
  const res = http.get(`${BASE_URL}${path}`, { headers: pageHeaders(), tags: { name } });
  pageTime.add(res.timings.duration, { name });
  const ok = check(res, { [`${name} 200`]: (r) => r.status === 200 });
  errors.add(!ok);
  return res;
}

function rest(name, path, jwt) {
  const res = http.get(`${SUPABASE_URL}/rest/v1/${path}`, { headers: restHeaders(jwt), tags: { name } });
  restTime.add(res.timings.duration, { name });
  const ok = check(res, { [`${name} 200`]: (r) => r.status === 200 });
  errors.add(!ok);
  return res;
}

/** The browse filter exactly as browsePage() builds it. */
function browseQuery(extra) {
  const now = new Date().toISOString();
  return (
    `marketplace_listings?select=${LISTING_COLS}` +
    `&status=eq.active&deleted_at=is.null&or=(expires_at.gte.${now},expires_at.is.null)` +
    (extra || '')
  );
}

export default function browseSession() {
  const country = pick(COUNTRIES);
  const term = pick(SEARCH_TERMS);
  let listingId = null;

  group('pages', () => {
    page('landing', '/');
    page('market', '/market');
    page('market search', `/market?q=${encodeURIComponent(term)}`);
  });

  group('rest: browse', () => {
    const first = rest(
      'browse country newest',
      browseQuery(`&country_code=eq.${country}&order=created_at.desc,id.desc&limit=25`)
    );
    try {
      const rows = first.json();
      if (Array.isArray(rows) && rows.length > 0) listingId = pick(rows).id;
    } catch {
      /* counted by the status check */
    }
    rest('browse all newest', browseQuery('&order=created_at.desc,id.desc&limit=25'));
    rest('browse country price', browseQuery(`&country_code=eq.${country}&order=price.asc,id.asc&limit=25`));
  });

  group('rest: search', () => {
    rest(
      'search',
      browseQuery(`&search=wfts(simple).${encodeURIComponent(term)}&order=created_at.desc,id.desc&limit=25`)
    );
  });

  if (listingId) {
    group('pages: listing', () => {
      page('listing detail', `/market/${listingId}`);
    });
  }

  if (USER_JWT && USER_ID) {
    group('rest: garage', () => {
      rest(
        'garage list',
        `collection_items?select=*&owner_id=eq.${USER_ID}&deleted_at=is.null&order=created_at.desc,id.desc&limit=25`,
        USER_JWT
      );
      rest(
        'garage search',
        `collection_items?select=*&owner_id=eq.${USER_ID}&deleted_at=is.null&search=wfts(simple).${encodeURIComponent(
          term
        )}&order=created_at.desc,id.desc&limit=25`,
        USER_JWT
      );
      rest(
        'offers received',
        `offers?select=*&seller_id=eq.${USER_ID}&order=created_at.desc&limit=200`,
        USER_JWT
      );
    });
  }

  sleep(1 + Math.random() * 2); // think time
}
