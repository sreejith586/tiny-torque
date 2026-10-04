import { test, expect, type Page } from '@playwright/test';

// D-027 visual guard for ANON fixture screens (market browse + listing detail) — run against a
// LOCAL server, not the Vercel preview (which renders this route's harness inconsistently). These
// are the garage-log-147.html-matched listing screens (D-044/D-045), checked at mobile AND tablet
// (the mockup is responsive at min-width:700px → 3-column grid). Harness via the mv_visual cookie.

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
type Screen = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

const SCREENS: Screen[] = [
  { name: 'market', path: '/market' },
  { name: 'listing-detail', path: `/market/${FIXTURE_LISTING}` },
];

test.skip(process.platform !== 'linux', 'screenshot baselines are Linux-only (CI + cloud)');

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('load');
}

async function seedHarness(page: Page) {
  await page
    .context()
    .addCookies([{ name: 'mv_visual', value: '1', url: 'http://localhost:3000' }]);
}

// Mobile — all six themes.
for (const theme of THEMES) {
  test.describe(`theme ${theme}`, () => {
    test.use({ viewport: MOBILE });
    test.beforeEach(async ({ page }) => {
      await seedHarness(page);
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

// Tablet — one theme, to lock the responsive (3-column) layout.
test.describe('tablet', () => {
  test.use({ viewport: TABLET });
  test.beforeEach(async ({ page }) => {
    await seedHarness(page);
    await page.addInitScript(() => localStorage.setItem('mini-vault-theme', 'workshop-light'));
  });
  for (const screen of SCREENS) {
    test(`${screen.name} @834`, async ({ page }) => {
      await page.goto(screen.path);
      await settle(page);
      await expect(page).toHaveScreenshot(`${screen.name}-workshop-light-tablet.png`, {
        fullPage: true,
      });
    });
  }
});

// Wide desktop — one theme, to lock the >=1440px left side-rail nav (D-053). Playwright's
// chromium desktop context reports hover:hover + pointer:fine, so the rail's media query fires.
test.describe('desktop', () => {
  test.use({ viewport: DESKTOP });
  test.beforeEach(async ({ page }) => {
    await seedHarness(page);
    await page.addInitScript(() => localStorage.setItem('mini-vault-theme', 'workshop-light'));
  });
  for (const screen of SCREENS) {
    test(`${screen.name} @1440`, async ({ page }) => {
      await page.goto(screen.path);
      await settle(page);
      await expect(page).toHaveScreenshot(`${screen.name}-workshop-light-desktop.png`, {
        fullPage: true,
      });
    });
  }
});
