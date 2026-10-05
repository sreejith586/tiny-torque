import { test, expect, type Page } from '@playwright/test';

// D-027 visual guard, run against a LOCAL server (not the Vercel preview). The preview lags behind
// pushes and renders the fixture harness inconsistently, which made these screens flake; a local
// server built from the pushed code is deterministic. Covers the public pages (landing, login) and
// the marketplace fixture screens (market, listing-detail). Linux-only baselines; harness screens
// use the mv_visual cookie (src/lib/visual-fixtures.ts). LOCAL_VISUAL=1 starts the webServer.

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

type Screen = {
  name: string;
  path: string;
  harness?: boolean; // needs the mv_visual fixture cookie (marketplace routes)
  prepare?: (page: Page) => Promise<void>;
};

const SCREENS: Screen[] = [
  { name: 'landing', path: '/' },
  { name: 'login-email', path: '/login' },
  {
    name: 'login-phone',
    path: '/login',
    prepare: (page) => page.getByRole('button', { name: 'Use mobile number instead' }).click(),
  },
  { name: 'market', path: '/market', harness: true },
  { name: 'listing-detail', path: `/market/${FIXTURE_LISTING}`, harness: true },
];

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

async function seedHarness(page: Page) {
  await page
    .context()
    .addCookies([{ name: 'mv_visual', value: '1', url: 'http://localhost:3000' }]);
}

async function shoot(page: Page, screen: Screen, name: string) {
  if (screen.harness) await seedHarness(page);
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

// Login OTP step — the segmented cells (D-054). Stub the OTP send so the screen advances to the
// code step. Two themes: the Aurora Glass default + workshop-light.
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

// Tablet + wide desktop — one theme, to lock the responsive layouts: the centered shell (D-052),
// the centered auth column (D-052 fix), and the >=1440px left side-rail nav (D-053). Playwright's
// chromium desktop context reports hover:hover + pointer:fine, so the rail's media query fires.
for (const [label, vp] of [
  ['tablet', TABLET],
  ['desktop', DESKTOP],
] as const) {
  test.describe(label, () => {
    test.use({ viewport: vp });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('mini-vault-theme', 'workshop-light'));
    });
    for (const screen of SCREENS) {
      test(`${screen.name} @${label}`, async ({ page }) => {
        await shoot(page, screen, `${screen.name}-workshop-light-${label}.png`);
      });
    }
  });
}
