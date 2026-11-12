import { test, expect, type Page } from '@playwright/test';

// MV-W06-06 (F-23): create → schedule → RSVP → room message across two browser contexts — the host
// via phone, an attendee via a second email identity — same shape as deal-chat.spec.ts. Opt-in: the
// target project needs `world` + `world_meetups` ON for both test identities, the host at garage
// level 2+ with ≥ 5 credits (the hosting fee), and the attendee following nobody in particular
// (the meetup is public). The RLS matrix (non-attendee cannot read the room, waitlist past capacity,
// cancel < 24 h keeps the fee) is covered at the SQL level by supabase/tests/0029_clubs_meetups.sql.

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

test('host schedules a meetup, an attendee RSVPs, both message in the live room (F-23)', async ({
  browser,
}) => {
  test.skip(
    process.env.E2E_ENABLE_PHONE_SIGNIN !== '1' ||
      process.env.E2E_ENABLE_MEETUPS !== '1' ||
      !process.env.E2E_TEST_PHONE ||
      !process.env.E2E_TEST_OTP ||
      !process.env.E2E_TEST_BUYER_EMAIL ||
      !process.env.E2E_TEST_BUYER_EMAIL_OTP,
    'opt-in: needs world=true AND world_meetups=true for both identities, the phone identity at ' +
      'garage level 2+ with credits for the fee, and the second (email) identity onboarded — set ' +
      'E2E_ENABLE_MEETUPS=1 alongside the deal-flow.spec.ts env vars'
  );

  const title = `E2E meetup ${Date.now()}`;
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    // 1. Host creates a draft starting in ~10 minutes (so "Open the room" is available at once).
    await signInByPhone(host, process.env.E2E_TEST_PHONE!, process.env.E2E_TEST_OTP!);
    test.skip(
      new URL(host.url()).pathname === '/onboarding',
      'the fixed host test user has not completed onboarding yet — run onboarding.spec.ts first'
    );
    await host.goto('/world/meetups/new');
    test.skip(
      (await host.getByText(/Hosting opens at level 2/).count()) > 0,
      'the host test user is below garage level 2 — buy a level in /world/shop first'
    );
    await host.getByLabel('Title').fill(title);
    const start = new Date(Date.now() + 10 * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    await host
      .getByLabel('Starts')
      .fill(
        `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`
      );
    await host.getByLabel('Seats').fill('3');
    await host.getByRole('button', { name: 'Save draft' }).click();
    await expect(host).toHaveURL(/\/world\/meetups\/[0-9a-f-]+$/);
    const meetupUrl = host.url();

    // 2. Host schedules it (hosting fee charged inside transition_meetup) and opens the room early.
    await host.getByRole('button', { name: 'Schedule' }).click();
    await expect(host.getByText(/Scheduled — \d+-credit hosting fee charged/)).toBeVisible();
    await host.getByRole('button', { name: 'Open the room' }).click();
    await expect(host).toHaveURL(/\/room$/);

    // 3. Attendee RSVPs from the detail page and enters the room.
    await signInByEmail(
      guest,
      process.env.E2E_TEST_BUYER_EMAIL!,
      process.env.E2E_TEST_BUYER_EMAIL_OTP!
    );
    await guest.goto(meetupUrl);
    await expect(guest.getByRole('heading', { name: title })).toBeVisible();
    await guest.getByRole('button', { name: 'I’m going' }).click();
    await expect(guest.getByText('You’re in.')).toBeVisible();
    await guest.getByRole('link', { name: 'Enter the live room' }).click();
    await expect(guest).toHaveURL(/\/room$/);

    // 4. Host posts; the attendee sees it live (Realtime, no reload). Then the other way round.
    const hostLine = `Welcome! ${Date.now()}`;
    await host.getByLabel('Message the room').fill(hostLine);
    await host.getByRole('button', { name: 'Send' }).click();
    await expect(guest.getByText(hostLine)).toBeVisible({ timeout: 10_000 });

    const guestLine = `Brought my R34 ${Date.now()}`;
    await guest.getByLabel('Message the room').fill(guestLine);
    await guest.getByRole('button', { name: 'Send' }).click();
    await expect(host.getByText(guestLine)).toBeVisible({ timeout: 10_000 });

    // 5. Host ends the meetup; the attendee's composer closes without a reload.
    await host.getByRole('button', { name: 'End meetup' }).click();
    await expect(host).toHaveURL(meetupUrl);
    await expect(guest.getByText('This meetup has ended.')).toBeVisible({ timeout: 10_000 });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
