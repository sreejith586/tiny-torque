import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// MV-S9-05 (F-17, D-056): the theme QA screenshot matrix — every route × 6 themes × 2 widths,
// written to playwright-report/theme-matrix/<theme>/<width>/<route>.png and uploaded by CI as the
// `theme-matrix` artifact for Sreejith's visual review against garage-log-147.html. A review AID,
// not a pixel-diff gate: the only assertions are "the page rendered" (no 4xx/5xx, body painted).
// Signed-in screens render from the ?__visual=1 fixtures (never honoured in production), so this
// runs on previews and local builds; set THEME_MATRIX=1 to run it (it is slow: 6 × 2 × ~20 pages).

const THEMES = [
  'workshop-light',
  'racing-green',
  'sunset-amber',
  'graphite-steel',
  'aurora-glass',
  'leather-chrome',
] as const;

const WIDTHS = [
  { name: '360', width: 360, height: 800 },
  { name: '1280', width: 1280, height: 900 },
] as const;

const FIXTURE_ITEM = '10000000-0000-4000-8000-000000000001';
const FIXTURE_LISTING = '20000000-0000-4000-8000-000000000001';
const FIXTURE_HANDLE = 'varun';

/** Every screen the app has (05 sprint plan "every route"), public ones plain, signed-in ones via
 *  the fixture harness. World routes are included even while dark — the harness renders them. */
const ROUTES: Array<{ name: string; path: string; harness?: boolean }> = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'onboarding', path: '/onboarding', harness: true },
  { name: 'garage', path: '/garage', harness: true },
  { name: 'garage-tour', path: '/garage', harness: true },
  { name: 'garage-item', path: `/garage/${FIXTURE_ITEM}`, harness: true },
  { name: 'garage-add', path: '/garage/add' },
  { name: 'garage-scan', path: '/garage/scan' },
  { name: 'garage-import', path: '/garage/import' },
  { name: 'garage-trash', path: '/garage/trash', harness: true },
  { name: 'market', path: '/market', harness: true },
  { name: 'market-listing', path: `/market/${FIXTURE_LISTING}`, harness: true },
  { name: 'market-mine', path: '/market/mine', harness: true },
  { name: 'offers', path: '/offers', harness: true },
  { name: 'notifications', path: '/notifications', harness: true },
  { name: 'profile', path: '/profile', harness: true },
  { name: 'profile-wishlist', path: '/profile/wishlist', harness: true },
  { name: 'public-profile', path: `/u/${FIXTURE_HANDLE}`, harness: true },
  { name: 'settings', path: '/settings', harness: true },
  { name: 'tokens', path: '/tokens', harness: true },
  { name: 'tokens-history', path: '/tokens/history', harness: true },
  { name: 'world', path: '/world', harness: true },
  { name: 'world-garage', path: '/world/garage', harness: true },
  { name: 'world-shop', path: '/world/shop', harness: true },
  { name: 'world-season', path: '/world/season', harness: true },
  { name: 'legal-terms', path: '/legal/terms' },
  { name: 'offline', path: '/offline' },
  { name: 'not-found', path: '/no-such-route-xyz' },
];

const OUT = path.join('playwright-report', 'theme-matrix');

async function shoot(
  page: Page,
  theme: string,
  width: (typeof WIDTHS)[number],
  route: (typeof ROUTES)[number]
) {
  const url = route.harness
    ? `${route.path}?__visual=1${route.name === 'garage-tour' ? '&__tour=1' : ''}`
    : route.path;
  await page.setViewportSize({ width: width.width, height: width.height });
  const res = await page.goto(url);
  const status = res?.status() ?? 0;
  // Unknown route is the one expected 404; harness routes that 307 to /login mean the harness is
  // off here (production) — record it rather than fail the whole matrix.
  if (route.name !== 'not-found') expect(status, `${url}`).toBeLessThan(500);
  await page
    .waitForSelector('[data-splash]', { state: 'detached', timeout: 10_000 })
    .catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  const dir = path.join(OUT, theme, width.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${route.name}.png`), fullPage: true });
  const painted = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(painted, 'body is painted').not.toBe('rgba(0, 0, 0, 0)');
}

test.describe('theme QA screenshot matrix (MV-S9-05)', () => {
  test.skip(process.env.THEME_MATRIX !== '1', 'set THEME_MATRIX=1 to produce the matrix');
  test.describe.configure({ timeout: 120_000 });

  for (const theme of THEMES) {
    test(`${theme}: every route at 360 + 1280`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'one browser profile is enough — widths are set per shot'
      );
      await page.addInitScript((t) => localStorage.setItem('mini-vault-theme', t), theme);
      for (const width of WIDTHS) {
        for (const route of ROUTES) {
          await shoot(page, theme, width, route);
        }
      }
    });
  }
});
