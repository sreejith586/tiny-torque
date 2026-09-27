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
const SCREENS: { name: string; path: string }[] = [
  { name: 'landing', path: '/' },
  { name: 'login-email', path: '/login' },
  { name: 'market', path: '/market' }, // static "coming soon" shell until S3; re-baseline then
];

test.skip(process.platform !== 'linux', 'screenshot baselines are Linux-only (CI + cloud)');

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}

for (const theme of THEMES) {
  test.describe(`theme ${theme}`, () => {
    test.use({ viewport: MOBILE });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('mini-vault-theme', t), theme);
    });

    for (const screen of SCREENS) {
      test(`${screen.name} @360`, async ({ page }) => {
        await page.goto(screen.path);
        await settle(page);
        await expect(page).toHaveScreenshot(`${screen.name}-${theme}-mobile.png`, {
          fullPage: true,
        });
      });
    }
  });
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP });
  test('landing @1280 (workshop-light)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mini-vault-theme', 'workshop-light'));
    await page.goto('/');
    await settle(page);
    await expect(page).toHaveScreenshot('landing-workshop-light-desktop.png', { fullPage: true });
  });
});
