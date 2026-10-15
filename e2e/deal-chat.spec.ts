import { test, expect, type Page } from '@playwright/test';

// MV-S6-08 (F-09): two parties exchange messages on an accepted offer's deal thread, across two
// browser contexts (seller via phone, buyer via a second email identity) — same shape as
// deal-flow.spec.ts, reused here up through "accept" since a thread only opens on an
// accepted/completed offer.
//
// "message on declined offer rejected" (F-09 AC) is NOT re-exercised here — it's already covered
// at the RLS level by supabase/tests/0012_messaging_trust.sql ("messaging on a DECLINED offer is
// rejected"), and DealThreadView's composer is hidden outright for any non-accepted/completed
// status (a simple, already-typechecked boolean condition), same reasoning deal-flow.spec.ts used
// for not re-exercising the `offers` kill-switch UI branch.

async function signInByPhone(page: Page, phone: string, otp: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use mobile number instead' }).click();
  await page.getByLabel('Mobile number').fill(phone.replace(/^\+?\d{1,3}/, ''));
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel(/Enter the code/).fill(otp);
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page).toHaveURL(/\/(garage|onboarding)$/);
}

async function signInByEmail(page: Page, email: string, otp: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel(/Enter the code/).fill(otp);
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page).toHaveURL(/\/(garage|onboarding)$/);
}

test('two parties exchange messages on an accepted offer (F-09)', async ({ browser }) => {
  test.skip(
    process.env.E2E_ENABLE_PHONE_SIGNIN !== '1' ||
      process.env.E2E_ENABLE_OFFERS !== '1' ||
      process.env.E2E_ENABLE_DEAL_CHAT !== '1' ||
      !process.env.E2E_TEST_PHONE ||
      !process.env.E2E_TEST_OTP ||
      !process.env.E2E_TEST_BUYER_EMAIL ||
      !process.env.E2E_TEST_BUYER_EMAIL_OTP,
    'opt-in: needs offers=true AND deal_chat=true on the target project, the seller phone ' +
      'identity already onboarded, and a second (buyer) test identity via email OTP — set ' +
      'E2E_ENABLE_DEAL_CHAT=1 alongside the deal-flow.spec.ts env vars'
  );

  const brand = `E2E Chat ${Date.now()}`;

  const sellerContext = await browser.newContext();
  const buyerContext = await browser.newContext();
  try {
    const seller = await sellerContext.newPage();
    const buyer = await buyerContext.newPage();

    // 1. Seller signs in, publishes a listing open to cash offers.
    await signInByPhone(seller, process.env.E2E_TEST_PHONE!, process.env.E2E_TEST_OTP!);
    test.skip(
      new URL(seller.url()).pathname === '/onboarding',
      'the fixed seller test user has not completed onboarding yet — run onboarding.spec.ts first'
    );
    await seller.goto('/garage/add');
    await seller.getByRole('button', { name: 'Add manually' }).click();
    await seller.getByLabel('Brand *').fill(brand);
    await seller.setInputFiles('input[type="file"]', 'public/car-placeholder.png');
    await seller.getByRole('button', { name: 'Add to garage' }).click();
    await expect(seller).toHaveURL(/\/garage\/[0-9a-f-]+$/);
    await seller.getByRole('checkbox', { name: 'List for sale' }).check();
    await seller.locator('#price').fill('45');
    await seller.getByRole('checkbox', { name: 'Open to cash offers' }).check();
    await seller.getByRole('button', { name: 'Publish to marketplace' }).click();
    await expect(seller.getByText('Listed in marketplace')).toBeVisible();
    const listingUrl = await seller.getByText('View listing').getAttribute('href');

    // 2. Buyer makes a cash offer; seller accepts it, opening the chat thread.
    await signInByEmail(
      buyer,
      process.env.E2E_TEST_BUYER_EMAIL!,
      process.env.E2E_TEST_BUYER_EMAIL_OTP!
    );
    await buyer.goto(listingUrl!);
    await buyer.getByRole('button', { name: 'Make an offer' }).click();
    await buyer.getByLabel(/Make a cash offer/).fill('45');
    await buyer.getByRole('button', { name: 'Send offer' }).click();
    await expect(buyer.getByText(/pending.*cash offer/i)).toBeVisible();

    await seller.goto('/offers');
    await expect(seller.getByText(brand)).toBeVisible();
    seller.once('dialog', (d) => d.accept());
    await seller.getByRole('button', { name: 'Accept' }).click();
    await expect(seller.getByText('accepted')).toBeVisible();

    // 3. Both parties reach the thread (buyer's Sent tab -> deep link, same offer id for seller).
    const offerHref = await seller.getByRole('link', { name: /open thread/i }).getAttribute('href');
    test.skip(!offerHref, 'no "Open thread" link on the inbox row yet — update this selector');

    await seller.goto(offerHref!);
    await buyer.goto(offerHref!);

    // 4. Seller sends a message; buyer sees it live (Realtime, no reload).
    const sellerMessage = `Hi, still interested? ${Date.now()}`;
    await seller.getByLabel('Message…').fill(sellerMessage);
    await seller.getByRole('button', { name: 'Send' }).click();
    await expect(buyer.getByText(sellerMessage)).toBeVisible({ timeout: 10_000 });

    // 5. Buyer replies; seller sees it live too.
    const buyerMessage = `Yes, can you ship to Dubai? ${Date.now()}`;
    await buyer.getByLabel('Message…').fill(buyerMessage);
    await buyer.getByRole('button', { name: 'Send' }).click();
    await expect(seller.getByText(buyerMessage)).toBeVisible({ timeout: 10_000 });
  } finally {
    await sellerContext.close();
    await buyerContext.close();
  }
});
