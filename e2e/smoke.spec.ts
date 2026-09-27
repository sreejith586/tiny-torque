import { test, expect } from '@playwright/test';

// Sprint-0 smoke: public pages render, guarded routes redirect, all six themes apply.
// Sign-in via Supabase test phone number is enabled once E2E_TEST_PHONE/OTP secrets exist (MV-S0-06 / S1-09).

test('landing renders and links to login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mini Vault' })).toBeVisible();
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to Mini Vault' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.getByRole('button', { name: 'Use mobile number instead' }).click();
  await expect(page.getByLabel('Mobile number')).toBeVisible();
});

test('guarded routes redirect to login (proxy.ts)', async ({ page }) => {
  for (const path of ['/garage', '/profile', '/offers']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
  }
});

test('market is public', async ({ page }) => {
  const res = await page.goto('/market');
  expect(res?.status()).toBe(200);
});

const THEMES = ['workshop-light', 'racing-green', 'sunset-amber', 'graphite-steel', 'aurora-glass', 'leather-chrome'];
for (const theme of THEMES) {
  test(`theme ${theme} applies before hydration`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('mini-vault-theme', t), theme);
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });
}

test('sign-in with test phone number', async ({ page }) => {
  test.skip(!process.env.E2E_TEST_PHONE, 'needs E2E_TEST_PHONE / E2E_TEST_OTP (Supabase test number)');
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use mobile number instead' }).click();
  await page.getByLabel('Mobile number').fill(process.env.E2E_TEST_PHONE!.replace(/^\+?91/, ''));
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel(/Enter the code/).fill(process.env.E2E_TEST_OTP!);
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page).toHaveURL(/\/(garage|onboarding)$/);
});
