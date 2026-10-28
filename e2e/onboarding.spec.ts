import { test, expect } from '@playwright/test';

// MV-S1-09 (F-01): the full new-user path — sign in with the test phone, complete onboarding,
// then confirm the public profile renders at /u/{handle} and, crucially, that the mobile number
// never appears on that public page (rule 15 / D-015 — others read via `public_profiles`, which
// omits `mobile`).
//
// Opt-in, same gate as the smoke sign-in test: phone OTP is the primary auth (D-012) but its
// test-OTP path is only exercised once a branch has [auth.sms.test_otp] actually applied and
// E2E_ENABLE_PHONE_SIGNIN=1 is set (D-037). A deterministic handle keeps the test repeatable
// against the fixed test user: the first run creates it via onboarding, later runs reuse it.

const HANDLE = 'e2e_collector';

test('sign-in → onboarding → profile, and mobile is absent from the public page (F-01, rule 15)', async ({
  page,
}) => {
  test.skip(
    process.env.E2E_ENABLE_PHONE_SIGNIN !== '1' ||
      !process.env.E2E_TEST_PHONE ||
      !process.env.E2E_TEST_OTP,
    'phone sign-in is opt-in (E2E_ENABLE_PHONE_SIGNIN=1) until a branch test OTP is verified (D-037)'
  );

  const phone = process.env.E2E_TEST_PHONE!; // e.g. +919999900001
  const phoneLocal = phone.replace(/^\+?\d{1,3}/, ''); // strip country code for the local-number field
  const phoneDigits = phone.replace(/\D/g, '');

  // 1. Sign in with the test phone number.
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use mobile number instead' }).click();
  await page.getByLabel('Mobile number').fill(phoneLocal);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel(/Enter the code/).fill(process.env.E2E_TEST_OTP!);
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page).toHaveURL(/\/(garage|onboarding)$/);

  // 2. Complete onboarding if this is a fresh user (the fixed test user may already have a profile).
  if (new URL(page.url()).pathname === '/onboarding') {
    // Invite step only appears when the invite_only flag is on (D-018); handle it if present.
    const inviteField = page.getByLabel('Invite code');
    if (await inviteField.isVisible().catch(() => false)) {
      await inviteField.fill(process.env.E2E_INVITE_CODE ?? '');
      await page.getByRole('button', { name: 'Next' }).click();
    }
    // Account type — keep the default (Collector).
    await page.getByRole('button', { name: 'Next' }).click();
    // Name + handle.
    await page.getByLabel('Display name').fill('E2E Collector');
    await page.getByLabel('Handle').fill(HANDLE);
    await page.getByLabel('Display name').click(); // blur handle → availability check runs
    await expect(page.getByText(`mini-vault.app/u/${HANDLE}`)).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    // Location — defaults are fine.
    await page.getByRole('button', { name: 'Continue' }).click();
    // Photo (optional) + the required 18+/terms confirmation (MV-W01-08); submit.
    await page.getByRole('checkbox', { name: /18 or older/ }).check();
    await page.getByRole('button', { name: 'Enter my garage' }).click();
    await expect(page).toHaveURL(/\/garage$/);
  }

  // 3. The public profile page renders for the handle.
  const res = await page.goto(`/u/${HANDLE}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByText(`@${HANDLE}`)).toBeVisible();

  // 4. The mobile number must NOT appear anywhere on the public page (public_profiles omits it).
  expect(await page.content()).not.toContain(phoneDigits);
  await expect(page.getByText(phone, { exact: false })).toHaveCount(0);
});
