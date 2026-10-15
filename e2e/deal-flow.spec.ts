import { test, expect, type Page } from '@playwright/test';

// MV-S5-07 (F-08): offer -> accept -> mark sold across two browser contexts (a seller signed in
// by phone, a buyer signed in by email — two independent identities, same shape as the rest of
// this suite's opt-in phone-signin tests, D-037).
//
// Opt-in: needs the `offers` flag on for the target project (no admin UI exists yet to check or
// toggle it from here, S10), the seller's phone identity already onboarded (same fixed test user
// as market-publish.spec.ts/onboarding.spec.ts), and a second, separate test identity for the
// buyer via email OTP so the two parties are genuinely different accounts.
//
// The AC's "kill switch hides CTAs" half isn't exercised here: toggling a flag needs either the
// (not-yet-built) admin panel or direct DB access, neither available to this sandbox or CI. The
// branch itself (ListingDetailView's `!offersEnabled` -> disabled "coming soon" buttons) is a
// simple, already-typechecked boolean condition — not worth a live flag flip just to prove an
// if/else renders the other side.

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

test('offer -> accept -> mark sold across two parties (F-08)', async ({ browser }) => {
  test.skip(
    process.env.E2E_ENABLE_PHONE_SIGNIN !== '1' ||
      process.env.E2E_ENABLE_OFFERS !== '1' ||
      !process.env.E2E_TEST_PHONE ||
      !process.env.E2E_TEST_OTP ||
      !process.env.E2E_TEST_BUYER_EMAIL ||
      !process.env.E2E_TEST_BUYER_EMAIL_OTP,
    'opt-in: needs offers=true on the target project, the seller phone identity already ' +
      'onboarded, and a second (buyer) test identity via email OTP — set E2E_ENABLE_OFFERS=1, ' +
      'E2E_TEST_BUYER_EMAIL and E2E_TEST_BUYER_EMAIL_OTP'
  );

  const brand = `E2E Deal ${Date.now()}`;

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

    // 2. Buyer (a different account) signs in and makes a cash offer on it.
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

    // 3. Seller sees it in the Received tab and accepts.
    await seller.goto('/offers');
    await expect(seller.getByText(brand)).toBeVisible();
    seller.once('dialog', (d) => d.accept()); // must be registered before the click (sync confirm())
    await seller.getByRole('button', { name: 'Accept' }).click();
    await expect(seller.getByText('accepted')).toBeVisible();

    // 4. Buyer's Sent tab reflects the acceptance (also proves the listing-visibility RLS fix —
    //    the listing is now 'reserved', not 'active', and the buyer must still be able to see it).
    await buyer.goto('/offers');
    await buyer.getByRole('button', { name: /^Sent/ }).click();
    await expect(buyer.getByText('accepted')).toBeVisible();

    // 5. Seller marks it sold.
    seller.once('dialog', (d) => d.accept());
    await seller.getByRole('button', { name: 'Mark sold' }).click();
    await expect(seller.getByText('completed')).toBeVisible();
  } finally {
    await sellerContext.close();
    await buyerContext.close();
  }
});
