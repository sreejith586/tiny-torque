import { test, expect, type Page } from '@playwright/test';

// D-027 visual guard — ALL pixel baselines, generated against a LOCAL server built from the pushed
// code (never the Vercel preview, which lags behind pushes and renders the fixture harness
// inconsistently). Deterministic: a regen screenshots the exact committed code, so it never races a
// deploy. Signed-in screens render fixture data via the `?__visual=1` harness (src/lib/
// visual-fixtures.ts, proxy.ts), which is honoured off production. Linux-only; LOCAL_VISUAL=1 starts
// the webServer (playwright.config.ts).

const THEMES = [
  'workshop-light',
  'racing-green',
  'sunset-amber',
  'graphite-steel',
  'aurora-glass',
  'leather-chrome',
];
const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 834, height: 1112 };
const DESKTOP = { width: 1440, height: 900 };
const FIXTURE_LISTING = '20000000-0000-4000-8000-000000000001';
const FIXTURE_ITEM = '10000000-0000-4000-8000-000000000001';
const V = '?__visual=1'; // fixture harness (non-production only)

type Screen = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

// Public pages + signed-in fixture screens. Prototype-faithful set (D-027/D-044).
const SCREENS: Screen[] = [
  { name: 'landing', path: '/' },
  { name: 'login-email', path: '/login' },
  {
    name: 'login-phone',
    path: '/login',
    prepare: (page) => page.getByRole('button', { name: 'Use mobile number instead' }).click(),
  },
  { name: 'market', path: `/market${V}` },
  { name: 'listing-detail', path: `/market/${FIXTURE_LISTING}${V}` },
  { name: 'garage-grid', path: `/garage${V}` },
  {
    name: 'garage-list',
    path: `/garage${V}`,
    prepare: (page) => page.getByRole('button', { name: 'List' }).click(),
  },
  { name: 'car-detail', path: `/garage/${FIXTURE_ITEM}${V}` },
  { name: 'add-car', path: `/garage/add${V}` },
  {
    name: 'add-car-more',
    path: `/garage/add${V}`,
    prepare: (page) => page.getByRole('button', { name: 'More details' }).click(),
  },
  { name: 'scan', path: `/garage/scan${V}` },
  { name: 'profile', path: `/profile${V}` },
  { name: 'offers', path: `/offers${V}` },
  { name: 'onboarding', path: `/onboarding${V}` },
  { name: 'public-profile', path: `/u/varun${V}` },
];

// Screens checked at tablet + wide desktop too (responsive layouts: centered shell D-052, centered
// auth column, >=1440px side-rail nav D-053).
const RESPONSIVE = new Set([
  'landing',
  'login-email',
  'login-phone',
  'market',
  'listing-detail',
  'garage-grid',
]);

test.skip(process.platform !== 'linux', 'screenshot baselines are Linux-only (CI + cloud)');

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('load');
  // The brand splash (Splash.tsx) overlays the page for ~1.5s on load — wait for it to clear so
  // screenshots (and interactions) see the real page, not the splash.
  await page
    .locator('[data-splash]')
    .waitFor({ state: 'detached', timeout: 4000 })
    .catch(() => {});
}

async function shoot(page: Page, screen: Screen, name: string) {
  await page.goto(screen.path);
  await settle(page);
  if (screen.prepare) {
    await screen.prepare(page);
    await settle(page);
  }
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

// Mobile — all six themes, every screen.
for (const theme of THEMES) {
  test.describe(`theme ${theme}`, () => {
    test.use({ viewport: MOBILE });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('mini-vault-theme', t), theme);
    });
    for (const screen of SCREENS) {
      test(`${screen.name} @360`, async ({ page }) => {
        await shoot(page, screen, `${screen.name}-${theme}-mobile.png`);
      });
    }
  });
}

// Login OTP step — the segmented cells (D-054). Stub the OTP send so the screen advances.
test.describe('login otp', () => {
  test.use({ viewport: MOBILE });
  for (const theme of ['aurora-glass', 'workshop-light'] as const) {
    test(`login-otp ${theme} @360`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('mini-vault-theme', t), theme);
      await page.route('**/auth/v1/otp**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      );
      await page.goto('/login');
      await settle(page);
      await page.fill('#email', 'demo@example.com');
      await page.getByRole('button', { name: 'Send code' }).click();
      await page.locator('[aria-label="One-time code digit 1"]').waitFor();
      await settle(page);
      await expect(page).toHaveScreenshot(`login-otp-${theme}-mobile.png`, { fullPage: true });
    });
  }
});

// Tablet + wide desktop — workshop-light, the responsive-sensitive screens.
for (const [label, vp] of [
  ['tablet', TABLET],
  ['desktop', DESKTOP],
] as const) {
  test.describe(label, () => {
    test.use({ viewport: vp });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('mini-vault-theme', 'workshop-light'));
    });
    for (const screen of SCREENS.filter((s) => RESPONSIVE.has(s.name))) {
      test(`${screen.name} @${label}`, async ({ page }) => {
        await shoot(page, screen, `${screen.name}-workshop-light-${label}.png`);
      });
    }
  });
}
