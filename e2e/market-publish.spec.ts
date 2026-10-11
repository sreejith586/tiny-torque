import { test, expect } from '@playwright/test';

// MV-S4-08 (F-06): publish a listing in an authed context, then confirm an anonymous viewer can
// browse to it with a country filter, and that the API payload never carries seller_mobile or the
// seller's phone number (rule 15 / D-015 — others only ever read through public_profiles).
//
// Opt-in, same shape as the phone-signin specs: this sandbox has no way to check the live
// marketplace_publish flag value (no admin UI for flags, no Supabase CLI session here), so rather
// than guess, the test skips until a human confirms the flag is actually on for the target
// project and sets E2E_ENABLE_MARKETPLACE_PUBLISH=1 — mirroring how E2E_ENABLE_PHONE_SIGNIN
// relates to the Supabase test-OTP config (D-037).

test('publish → visible to anon browse (country-filtered), mobile absent (F-06, rule 15)', async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.E2E_ENABLE_PHONE_SIGNIN !== '1' ||
      process.env.E2E_ENABLE_MARKETPLACE_PUBLISH !== '1' ||
      !process.env.E2E_TEST_PHONE ||
      !process.env.E2E_TEST_OTP,
    'opt-in: needs marketplace_publish=true on the target project + phone sign-in configured ' +
      '(set E2E_ENABLE_MARKETPLACE_PUBLISH=1 and E2E_ENABLE_PHONE_SIGNIN=1)'
  );

  const phone = process.env.E2E_TEST_PHONE!; // e.g. +919999900001
  const phoneLocal = phone.replace(/^\+?\d{1,3}/, '');
  const phoneDigits = phone.replace(/\D/g, '');
  const country = process.env.E2E_TEST_COUNTRY ?? 'IN'; // matches the fixed test user's profile
  const brand = `E2E Market ${Date.now()}`;

  // 1. Sign in with the test phone number (same path as smoke.spec.ts / onboarding.spec.ts).
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use mobile number instead' }).click();
  await page.getByLabel('Mobile number').fill(phoneLocal);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel(/Enter the code/).fill(process.env.E2E_TEST_OTP!);
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page).toHaveURL(/\/(garage|onboarding)$/);
  test.skip(
    new URL(page.url()).pathname === '/onboarding',
    'the fixed test user has not completed onboarding yet — run onboarding.spec.ts first'
  );

  // 2. Add a car with a photo — publishing requires >=1 photo (F-06).
  await page.goto('/garage/add');
  await page.getByLabel('Brand *').fill(brand);
  await page.setInputFiles('input[type="file"]', 'public/car-placeholder.png');
  await page.getByRole('button', { name: 'Add to garage' }).click();
  await expect(page).toHaveURL(/\/garage\/[0-9a-f-]+$/);

  // 3. Publish it (MV-S4-03's inline "List for sale" section).
  await page.getByRole('checkbox', { name: 'List for sale' }).check();
  await page.locator('#price').fill('45');
  await page.getByRole('button', { name: 'Publish to marketplace' }).click();
  await expect(page.getByText('Listed in marketplace')).toBeVisible();

  // 4. A fresh, anonymous browser context (no cookies from the signed-in session above) browses
  //    the marketplace filtered to the seller's country and finds the listing — and the raw API
  //    response never contains the seller's mobile number in any form.
  const anonContext = await browser.newContext();
  try {
    const response = await anonContext.request.get(`/api/market?country=${country}`);
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain(brand);
    expect(body).not.toContain('seller_mobile');
    expect(body).not.toContain(phoneDigits);

    const anonPage = await anonContext.newPage();
    await anonPage.goto('/market');
    await expect(anonPage.getByText(brand).first()).toBeVisible();
  } finally {
    await anonContext.close();
  }
});
