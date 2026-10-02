import { test, expect, type Page } from '@playwright/test';

// D-027 visual guard: pixel baselines of the prototype-faithful screens, all six themes.
// A UI change that alters these screenshots fails CI until the baselines are regenerated in the
// same PR (`pnpm test:e2e:update`), which makes any drift from Varun's prototype visible in review.
// Baselines are generated on Linux (CI/cloud); on other platforms the tests are skipped.

const THEMES = [
  'workshop-light',
  'racing-green',
  'sunset-amber',
  'graphite-steel',
  'aurora-glass',
  'leather-chrome',
];
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const BASE = process.env.BASE_URL || 'http://localhost:3000';
type Screen = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

// Public screens.
const PUBLIC_SCREENS: Screen[] = [
  { name: 'landing', path: '/' },
  { name: 'login-email', path: '/login' },
  {
    name: 'login-phone',
    path: '/login',
    prepare: (page) => page.getByRole('button', { name: 'Use mobile number instead' }).click(),
  },
  { name: 'market', path: '/market?__visual=1' }, // S4-04 browse; harness via the mv_visual cookie
];

// Signed-in screens rendered with fixture data through the `?__visual=1` harness
// (src/lib/visual-fixtures.ts, proxy.ts). Real URLs keep BottomNav's active tab.
const SIGNED_IN_SCREENS: Screen[] = [
  { name: 'garage-grid', path: '/garage?__visual=1' },
  {
    name: 'garage-list',
    path: '/garage?__visual=1',
    prepare: (page) => page.getByRole('button', { name: 'List' }).click(),
  },
  { name: 'car-detail', path: '/garage/10000000-0000-4000-8000-000000000001?__visual=1' },
  { name: 'add-car', path: '/garage/add?__visual=1' },
  {
    name: 'add-car-more',
    path: '/garage/add?__visual=1',
    prepare: (page) => page.getByRole('button', { name: 'More details' }).click(),
  },
  { name: 'scan', path: '/garage/scan?__visual=1' },
  { name: 'profile', path: '/profile?__visual=1' },
  { name: 'offers', path: '/offers?__visual=1' },
  { name: 'onboarding', path: '/onboarding?__visual=1' },
  { name: 'public-profile', path: '/u/varun?__visual=1' },
];

const SCREENS: Screen[] = [...PUBLIC_SCREENS, ...SIGNED_IN_SCREENS];

test.skip(process.platform !== 'linux', 'screenshot baselines are Linux-only (CI + cloud)');

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // 'load', not 'networkidle': PostHog (AnalyticsInit, loaded on every page) keeps background
  // network activity going indefinitely, so networkidle routinely hung the full 30s per screen
  // (~80 screens x themes here) and blew the job's 20-minute timeout. toHaveScreenshot() below
  // already retries until consecutive frames stabilize, so this is still a reliable wait.
  await page.waitForLoadState('load');
}

for (const theme of THEMES) {
  test.describe(`theme ${theme}`, () => {
    test.use({ viewport: MOBILE });
    test.beforeEach(async ({ context, page }) => {
      // The mv_visual cookie triggers the fixture harness reliably on anon routes (/market), where
      // the ?__visual query isn't dependably delivered to the Server Component on Vercel.
      await context.addCookies([{ name: 'mv_visual', value: '1', url: BASE }]);
      await page.addInitScript((t) => localStorage.setItem('mini-vault-theme', t), theme);
    });

    for (const screen of SCREENS) {
      test(`${screen.name} @360`, async ({ page }) => {
        await page.goto(screen.path);
        await settle(page);
        if (screen.prepare) {
          await screen.prepare(page);
          await settle(page);
        }
        await expect(page).toHaveScreenshot(`${screen.name}-${theme}-mobile.png`, {
          fullPage: true,
        });
      });
    }
  });
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP });
  for (const screen of [PUBLIC_SCREENS[0], SIGNED_IN_SCREENS[0]]) {
    test(`${screen.name} @1280 (workshop-light)`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('mini-vault-theme', 'workshop-light'));
      await page.goto(screen.path);
      await settle(page);
      await expect(page).toHaveScreenshot(`${screen.name}-workshop-light-desktop.png`, {
        fullPage: true,
      });
    });
  }
});
