import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// MV-S9-04 (F-17): axe-core over the app's screens — public ones as-is, signed-in ones rendered
// from the ?__visual=1 fixtures (src/lib/visual-fixtures.ts, never honoured in production, so this
// runs against previews and local builds only). Fails on any serious/critical WCAG 2.1 A/AA
// violation, colour-contrast included, in the default theme (the six themes' token pairs are
// checked by scripts/contrast-check.mjs); also runs the light theme on two pages since it is the
// only light palette.

const SCREENS: Array<{ path: string; harness?: boolean }> = [
  { path: '/' },
  { path: '/login' },
  { path: '/offline' },
  { path: '/legal/terms' },
  { path: '/market', harness: true },
  { path: '/garage', harness: true },
  { path: '/garage/add' },
  { path: '/profile', harness: true },
  { path: '/settings', harness: true },
  { path: '/tokens', harness: true },
  { path: '/onboarding', harness: true },
];

async function audit(page: Page, path: string, harness?: boolean) {
  const url = harness ? `${path}?__visual=1` : path;
  const res = await page.goto(url);
  expect(res?.status(), `${url} should render`).toBeLessThan(400);
  // Let the splash finish and lazy bits settle so axe sees the real screen.
  await page
    .waitForSelector('[data-splash]', { state: 'detached', timeout: 10_000 })
    .catch(() => {});
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The brand splash is aria-hidden and gone in 3.5 s; the tour overlay is a modal by design.
    .exclude('[data-splash]')
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  const summary = serious
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n` +
        v.nodes
          .slice(0, 4)
          .map((n) => `   ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1] ?? ''}`)
          .join('\n')
    )
    .join('\n');
  expect(serious, `${url}\n${summary}`).toEqual([]);
}

for (const s of SCREENS) {
  test(`axe: ${s.path}${s.harness ? ' (fixtures)' : ''} has no serious WCAG A/AA violations`, async ({
    page,
  }) => {
    test.skip(
      !!s.harness && process.env.E2E_PRODUCTION === '1',
      'fixture screens are not rendered in production'
    );
    await audit(page, s.path, s.harness);
  });
}

test('axe: workshop-light (the one light theme) on /login and /market', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mini-vault-theme', 'workshop-light'));
  await audit(page, '/login');
  await audit(page, '/market', true);
});

test('keyboard: the first-run tour traps focus and Escape skips it', async ({ page }) => {
  await page.goto('/garage?__visual=1&__tour=1');
  const dialog = page.getByRole('dialog', { name: 'This is your garage' });
  test.skip(!(await dialog.isVisible().catch(() => false)), 'tour fixture not rendered here');
  await expect(dialog.getByRole('button', { name: 'Skip' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Next' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Skip' })).toBeFocused(); // wrapped
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('keyboard: garage filter dropdown closes on Escape and returns focus', async ({ page }) => {
  await page.goto('/garage?__visual=1');
  const trigger = page.getByRole('button', { name: 'Filter your garage' });
  await trigger.click();
  await expect(page.locator('.filter-dropdown')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.filter-dropdown')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
