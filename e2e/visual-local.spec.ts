import { test, expect, type Page } from '@playwright/test';

// D-027 visual guard for ANON fixture screens (e.g. /market) — run against a LOCAL server, not the
// Vercel preview. The preview serves this route's `?__visual` harness render inconsistently (a cold
// prerendered-shell vs warm-function race at Vercel's edge), so these baselines live here and are
// generated/compared against `pnpm start` on the Linux CI runner for determinism. Everything else
// stays in visual.spec.ts against the preview. See src/lib/visual-fixtures.ts (mv_visual cookie).

const THEMES = [
  'workshop-light',
  'racing-green',
  'sunset-amber',
  'graphite-steel',
  'aurora-glass',
  'leather-chrome',
];
const MOBILE = { width: 390, height: 844 };
type Screen = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

const SCREENS: Screen[] = [
  { name: 'market', path: '/market' }, // harness via the mv_visual cookie (set in beforeEach)
];

test.skip(process.platform !== 'linux', 'screenshot baselines are Linux-only (CI + cloud)');

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('load');
}

for (const theme of THEMES) {
  test.describe(`theme ${theme}`, () => {
    test.use({ viewport: MOBILE });
    test.beforeEach(async ({ context, page }) => {
      await context.addCookies([{ name: 'mv_visual', value: '1', url: 'http://localhost:3000' }]);
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
