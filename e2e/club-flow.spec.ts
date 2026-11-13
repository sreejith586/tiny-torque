import { test, expect, type Page } from '@playwright/test';

// MV-W07-06 (F-22): create club → join → club meetup, across two browser contexts — the owner via
// phone, a member via a second email identity — same shape as meetup-flow.spec.ts. Opt-in: the target
// project needs `world` + `world_clubs` + `world_meetups` ON for both test identities, the owner at
// F-13 level 2+ with a level-2 garage and ≥ 5 credits (the hosting fee), with no upheld report in the
// last 90 days and fewer than 3 clubs. The role matrix (admin removes a member, a banned member
// cannot rejoin, only members read a closed club's feed, best-in-show frozen at `ended`) is covered
// at the SQL level by supabase/tests/0030_world_best_in_show_clubs.sql.

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

test('owner starts a club, a collector joins, the club schedules a meetup (F-22)', async ({
  browser,
}) => {
  test.skip(
    process.env.E2E_ENABLE_PHONE_SIGNIN !== '1' ||
      process.env.E2E_ENABLE_CLUBS !== '1' ||
      !process.env.E2E_TEST_PHONE ||
      !process.env.E2E_TEST_OTP ||
      !process.env.E2E_TEST_BUYER_EMAIL ||
      !process.env.E2E_TEST_BUYER_EMAIL_OTP,
    'opt-in: needs world + world_clubs + world_meetups ON for both identities, the phone identity ' +
      'at collector level 2+ with a level-2 garage and credits for the fee, and the second (email) ' +
      'identity onboarded — set E2E_ENABLE_CLUBS=1 alongside the deal-flow.spec.ts env vars'
  );

  const stamp = Date.now().toString(36);
  const name = `E2E Club ${stamp}`;
  const slug = `e2e_${stamp}`.slice(0, 24);
  const title = `E2E club night ${stamp}`;
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
    const owner = await ownerContext.newPage();
    const member = await memberContext.newPage();

    // 1. The owner starts an open club.
    await signInByPhone(owner, process.env.E2E_TEST_PHONE!, process.env.E2E_TEST_OTP!);
    test.skip(
      new URL(owner.url()).pathname === '/onboarding',
      'the fixed owner test user has not completed onboarding yet — run onboarding.spec.ts first'
    );
    await owner.goto('/world/clubs/new');
    test.skip(
      (await owner.getByRole('form', { name: 'Start a club' }).count()) === 0,
      'the owner test user may not start a club (collector level < 2, an upheld report, or suspended)'
    );
    await owner.getByLabel('Club name').fill(name);
    await owner.getByLabel('Club address').fill(slug);
    await owner.getByRole('button', { name: 'Start the club' }).click();
    await expect(owner).toHaveURL(new RegExp(`/world/clubs/${slug}$`));
    await expect(owner.getByText('You are the club’s owner.')).toBeVisible();

    // 2. A second collector joins and shows up on the roster and the feed.
    await signInByEmail(
      member,
      process.env.E2E_TEST_BUYER_EMAIL!,
      process.env.E2E_TEST_BUYER_EMAIL_OTP!
    );
    await member.goto(`/world/clubs/${slug}`);
    await member.getByRole('button', { name: 'Join the club' }).click();
    await expect(member.getByText('You are a member.')).toBeVisible();
    await expect(member.getByText('Members (2)')).toBeVisible();
    // a member has no staff tools
    await expect(member.getByRole('form', { name: 'Club settings' })).toHaveCount(0);

    // 3. The owner hosts a club-only meetup and schedules it (hosting fee).
    await owner.goto(`/world/clubs/${slug}`);
    await owner.getByRole('link', { name: 'Host a club meetup' }).click();
    await expect(owner.getByLabel('Host as')).not.toHaveValue('');
    await owner.getByLabel('Title').fill(title);
    await owner.getByLabel('Seats').fill('3');
    await owner.getByLabel('Who can join').selectOption('club');
    await owner.getByRole('button', { name: 'Save draft' }).click();
    await expect(owner).toHaveURL(/\/world\/meetups\/[0-9a-f-]{36}$/);
    const meetupUrl = owner.url();
    await owner.getByRole('button', { name: 'Schedule' }).click();
    await expect(owner.getByText(/hosting fee charged/)).toBeVisible();

    // 4. The member sees it on the clubhouse and on the feed, and can RSVP.
    await member.goto(`/world/clubs/${slug}`);
    await expect(member.getByText(`Meetup scheduled: ${title}`)).toBeVisible();
    await member.getByRole('link', { name: new RegExp(title) }).click();
    await expect(member).toHaveURL(meetupUrl);
    await expect(member.getByText('Club members only')).toBeVisible();
    await member.getByRole('button', { name: 'I’m going' }).click();
    await expect(member.getByText('You’re in.')).toBeVisible();

    // 5. Clean-up: the member leaves the club; the owner cancels the meetup (≥ 24 h ahead → refund).
    await member.goto(`/world/clubs/${slug}`);
    await member.getByRole('button', { name: 'Leave' }).click();
    await expect(member.getByRole('button', { name: 'Join the club' })).toBeVisible();
    await owner.goto(meetupUrl);
    await owner.getByRole('button', { name: 'Cancel meetup' }).click();
    await expect(owner.getByText('Cancelled', { exact: true })).toBeVisible();
  } finally {
    await ownerContext.close();
    await memberContext.close();
  }
});
