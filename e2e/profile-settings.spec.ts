import { test, expect } from '@playwright/test';

// S8 (F-13/F-14/F-01): the public-profile v2 + settings + first-run-tour critical flow.
//
// Anonymous checks always run: /settings is guarded, /legal/* is public, and the ?__visual
// fixture harness renders the new profile stats dashboard, public profile v2 (tabs) and settings
// screens without a database (D-056 — fixture harness, never in production).
//
// The signed-in path (tour → dismiss → profile stats → settings) is opt-in behind the same test
// phone gate as onboarding.spec.ts, and the public-profile-for-a-real-handle check is opt-in via
// E2E_PUBLIC_HANDLE (a handle that exists on the target database).

test('settings is guarded, legal pages are public (F-14)', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);

  const terms = await page.goto('/legal/terms');
  expect(terms?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible();
  const privacy = await page.goto('/legal/privacy');
  expect(privacy?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
});

test('profile stats dashboard renders level, badges and top brands (F-13, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/profile?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('Level 3')).toBeVisible();
  await expect(page.getByText('Serious Collector').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  // five badges, two of them unlocked in the fixture
  await expect(page.locator('.badge-card')).toHaveCount(5);
  await expect(page.locator('.badge-card.locked')).toHaveCount(3);
  await expect(page.getByText('Top brands in your garage')).toBeVisible();
  await expect(page.getByRole('link', { name: /Settings/ })).toBeVisible();
});

test('public profile v2 has tabs, level pill and share (F-14, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/u/varun?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Varun' })).toBeVisible();
  await expect(page.getByText(/Level 3 · Serious Collector/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share this profile' })).toBeVisible();
  // tabs switch content
  await page.getByRole('tab', { name: /Listings/ }).click();
  await expect(page.getByRole('tab', { name: /Listings/ })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.getByRole('tab', { name: /Reviews/ }).click();
  await expect(page.getByText('No reviews yet.')).toBeVisible();
  // rule 15: the fixture's mobile number never appears on the public page
  await expect(page.getByText('+91 99999 00001')).toHaveCount(0);
});

test('settings screen lists every F-14 section (fixture harness)', async ({ page }) => {
  const res = await page.goto('/settings?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  for (const heading of [
    'Account type',
    'Appearance',
    'Blocked users',
    'Tokens',
    'Your data',
    'Feedback & bug reports',
    'Legal',
    'Delete account',
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Token history' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export my data' })).toBeVisible();
});

test('a real public profile serves its OG image (F-14 share sheet)', async ({ page }) => {
  test.skip(!process.env.E2E_PUBLIC_HANDLE, 'set E2E_PUBLIC_HANDLE to a handle on the target DB');
  const handle = process.env.E2E_PUBLIC_HANDLE!;
  const res = await page.goto(`/u/${handle}`);
  expect(res?.status()).toBe(200);
  const og = await page.request.get(`/u/${handle}/opengraph-image`);
  expect(og.status()).toBe(200);
  expect(og.headers()['content-type']).toContain('image/png');
});

test('first-run tour → dismiss → profile stats → settings (signed in, opt-in)', async ({
  page,
}) => {
  test.skip(
    process.env.E2E_ENABLE_PHONE_SIGNIN !== '1' ||
      !process.env.E2E_TEST_PHONE ||
      !process.env.E2E_TEST_OTP,
    'phone sign-in is opt-in (E2E_ENABLE_PHONE_SIGNIN=1) until a branch test OTP is verified (D-037)'
  );
  const phone = process.env.E2E_TEST_PHONE!;
  const phoneLocal = phone.replace(/^\+?\d{1,3}/, '');

  await page.goto('/login');
  await page.getByRole('button', { name: 'Use mobile number instead' }).click();
  await page.getByLabel('Mobile number').fill(phoneLocal);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel(/Enter the code/).fill(process.env.E2E_TEST_OTP!);
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page).toHaveURL(/\/(garage|onboarding)$/);
  test.skip(
    new URL(page.url()).pathname === '/onboarding',
    'the fixed test user has no profile yet — onboarding.spec.ts creates it'
  );

  // The tour shows until dismissed; dismissing stamps tutorial_dismissed_at.
  const tour = page.getByRole('dialog', { name: 'This is your garage' });
  if (await tour.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Skip the tour' }).click();
    await expect(tour).toBeHidden();
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }

  await page.goto('/profile');
  await expect(page.getByText(/Level \d/).first()).toBeVisible();
  await expect(page.locator('.badge-card')).toHaveCount(5);

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Blocked users' })).toBeVisible();
});
