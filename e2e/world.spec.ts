import { test, expect } from '@playwright/test';

// W02 (F-20/F-27): the Collectors World screens stay dark — /world is guarded (anon → login) and
// 404s for a signed-in user while the `world` flag is off — but render with fixture data through
// the ?__visual harness (D-056, never in production), so the garage scene, editor and shop can be
// smoke-checked on every preview without a database or a flag flip.

test('world is guarded for anon and the API seam stays dark (D-028)', async ({ page, request }) => {
  await page.goto('/world');
  await expect(page).toHaveURL(/\/login\?next=%2Fworld/);
  expect((await request.get('/api/v1/world/me')).status()).toBe(401);
  expect((await request.get('/api/v1/world/open')).status()).toBe(404);
});

test('world home renders the garage card (F-20, fixture harness)', async ({ page }) => {
  const res = await page.goto('/world?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Collectors World' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Varun's Garage" })).toBeVisible();
  await expect(page.getByText('Level 2 · Garage')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Arrange garage' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shop' })).toBeVisible();
});

test('garage scene + editor: slots, featured, open house, rename (F-20, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/garage?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Your garage' })).toBeVisible();
  // 8 level slots + 1 bought = 9 cells, two of them filled from the fixture layout
  await expect(page.getByRole('list', { name: 'Display slots' }).getByRole('listitem')).toHaveCount(
    9
  );
  await expect(
    page.getByRole('list', { name: 'Display slots' }).getByText('Slot 3', { exact: true })
  ).toBeVisible();
  await expect(page.getByLabel('Featured')).toHaveValue(/./);
  await expect(page.getByLabel('Who can visit')).toBeVisible();
  await expect(page.getByLabel('Theme')).toBeVisible();
  // changing a slot is optimistic: the Save button wakes up before any request
  const save = page.getByRole('button', { name: 'Save garage' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Slot 3').selectOption({ index: 1 });
  await expect(save).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Rename' })).toBeDisabled();
});

test('shop lists the next level, items by kind and inventory (F-27, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/shop?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'World shop' })).toBeVisible();
  await expect(page.getByText('Next: Level 3 · Showroom')).toBeVisible();
  await expect(page.getByText('90 tokens')).toBeVisible();
  await expect(page.getByText('Themes', { exact: true }).first()).toBeVisible();
  // theme + decor + the season trophy the fixture owns (W05)
  await expect(page.getByRole('button', { name: 'Owned' })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Earned only' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Buy \(1\/3\)/ })).toBeVisible();
  await expect(page.getByText('Your inventory', { exact: true })).toBeVisible();
});

test('visitor garage view: scene, kudos, guestbook, for-sale bridge (F-21, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/g/varun?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: "Varun's Garage" })).toBeVisible();
  await expect(page.getByText(/48 visits · 17 kudos/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Give kudos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report garage' })).toBeVisible();
  await expect(page.getByText('Guestbook', { exact: true })).toBeVisible();
  await expect(page.getByText('That R34 is unreal. Treasure Hunt too?!')).toBeVisible();
  await expect(page.getByRole('link', { name: /For sale · make an offer/ })).toBeVisible();
  // the guestbook composer is live before any request
  await page.getByLabel('Leave a line').fill('Lovely garage');
  await expect(page.getByRole('button', { name: 'Post' })).toBeEnabled();
});

test('world home lists open garages near you / all and recent visitors (F-21, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('Recent visitors', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Rafiq @diecast_dxb/ })).toBeVisible();
  await expect(page.getByText('Open garages', { exact: true })).toBeVisible();
  // own country (IN) first: Meera's shed, not Rafiq's Dubai showroom
  await expect(page.getByRole('link', { name: /Meera’s Shed/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Rafiq’s Showroom/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'All' }).click();
  await expect(page.getByRole('link', { name: /Rafiq’s Showroom/ })).toBeVisible();
});

test('garage editor lists invites with copy + revoke (F-21, fixture harness)', async ({ page }) => {
  const res = await page.goto('/world/garage?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('Invites', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create share link' })).toBeVisible();
  await expect(page.getByText('@blr_castings')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy link' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Revoke' })).toHaveCount(2);
});

test('visitor garage 404s while dark and guidelines are public (D-028, F-28)', async ({ page }) => {
  const dark = await page.goto('/world/g/no_such_collector_xyz');
  expect(dark?.status()).toBe(404);
  const res = await page.goto('/legal/guidelines');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Community guidelines' })).toBeVisible();
});

test("world home shows today's quests with progress, streak and season (F-26, fixture harness)", async ({
  page,
}) => {
  const res = await page.goto('/world?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText("Today's quests", { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(6);
  await expect(
    page.getByRole('progressbar', { name: 'Visit 10 garages this week' })
  ).toHaveAttribute('aria-valuenow', '4');
  await expect(page.getByText('Done', { exact: true })).toHaveCount(2);
  await expect(page.getByText('3-day streak')).toBeVisible();
  await expect(page.getByText(/Founders' Season · ends .* · 120 season points/)).toBeVisible();
});

test('tokens page carries the earned-credit expiry note (F-26/D-070, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/tokens?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('12 earned')).toBeVisible();
  await expect(page.getByText(/Earned tokens expire 180 days/)).toBeVisible();
});

// ---- W05 (MV-W05-01/03): shop complete, decor slots, season page (D-092 / D-093 proposed) ----

test('shop sells every kind with season, Spotlight and earned-only labels (F-27, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/shop?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  // listed in the catalogue and again in the inventory
  await expect(page.getByText('Spotlight (24 h)', { exact: true })).toHaveCount(2);
  await expect(page.getByText(/24 h · labelled "Spotlight"/)).toBeVisible();
  // the Spotlight bought in the fixture is still running → the shop refuses a second one
  await expect(page.getByRole('button', { name: /^On until/ })).toBeVisible();
  await expect(page.getByText("Founders' Season", { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Tunes', { exact: true })).toBeVisible();
  await expect(page.getByText(/Racing arrives in a later update/)).toBeVisible();
  await expect(page.getByText('Trophies', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Earned only' })).toHaveCount(2);
  // the fixture garage is level 2, so only the level-3 item is XP-gated
  await expect(page.getByRole('button', { name: 'Level 3+' })).toBeVisible();
  // inventory: durable rows get Place / Apply, the active Spotlight is labelled with its expiry
  await expect(page.getByRole('link', { name: 'Place' })).toHaveCount(2);
  await expect(page.getByText(/Spotlight until/)).toBeVisible();
});

test('garage editor exposes decor slots and the scene lists placed decor (F-20/F-27, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/garage?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('Decor slots', { exact: true })).toBeVisible();
  // level 2 = 4 decor slots; slot 1 holds the fixture's neon sign
  await expect(page.getByLabel('Decor 4')).toBeVisible();
  await expect(page.getByLabel('Decor 1')).toHaveValue(/./);
  await expect(page.getByRole('list', { name: 'Decor' }).getByRole('listitem')).toHaveText([
    'Neon sign',
  ]);
  const save = page.getByRole('button', { name: 'Save garage' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Decor 2').selectOption({ label: 'Tool wall' });
  await expect(save).toBeEnabled();
  await expect(page.getByRole('list', { name: 'Decor' }).getByRole('listitem')).toHaveCount(2);
});

test('season page shows the free track with paid / reached / to-go milestones (F-26, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/season?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Season', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Founders' Season" })).toBeVisible();
  await expect(page.getByText('120 season points')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Season track' })).toHaveAttribute(
    'aria-valuenow',
    '70'
  );
  await expect(page.getByText('Paid', { exact: true })).toHaveCount(1);
  await expect(page.getByText('30 to go')).toBeVisible();
  await expect(page.getByText(/Season finisher/).first()).toBeVisible();
});

test('quests panel links to the season page; season 404s while dark (F-26, D-028)', async ({
  page,
}) => {
  const dark = await page.goto('/world/season');
  await expect(page).toHaveURL(/\/login\?next=%2Fworld%2Fseason/);
  expect(dark?.status()).not.toBe(500);
  const res = await page.goto('/world?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('link', { name: /Founders' Season · ends/ })).toHaveAttribute(
    'href',
    '/world/season'
  );
});

// ---- W06 (MV-W06-03/04/06): virtual meetups — list, detail (attendee + host), create form, live room.
// All dark behind `world_meetups` (404 for a signed-in user while OFF, login for anon); the fixture
// harness renders them with deterministic data so every preview can be reviewed in six themes.

test('meetups are guarded for anon (D-028)', async ({ page }) => {
  await page.goto('/world/meetups');
  await expect(page).toHaveURL(/\/login\?next=%2Fworld%2Fmeetups/);
  await page.goto('/world/meetups/00000000-0000-4000-8000-00000000a001/room');
  await expect(page).toHaveURL(/\/login\?next=%2Fworld%2Fmeetups/);
});

test('meetups list: upcoming / mine tabs, status pills, host CTA (F-23, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/meetups?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Meetups' })).toBeVisible();
  await expect(page.getByRole('link', { name: /JDM night/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Matchbox Monday/ })).toBeVisible();
  await expect(page.getByText('Scheduled', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/6\/10 going · you’re in/)).toBeVisible();
  await expect(page.getByText(/2\/2 going · waitlisted/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Host a meetup' })).toBeVisible();
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByRole('link', { name: /Treasure Hunt show-and-tell/ })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
});

test('meetup detail as an attendee: RSVP, attendees, showcase picker + grid (F-23, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/meetups/00000000-0000-4000-8000-00000000a001?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'JDM night' })).toBeVisible();
  await expect(page.getByText(/hosted by @diecast_dxb/)).toBeVisible();
  await expect(page.getByText('6/10 going · 1 waitlisted')).toBeVisible();
  await expect(page.getByText('You’re in.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Not going' })).toBeVisible();
  await expect(page.getByText('Attendees', { exact: true })).toBeVisible();
  await expect(page.getByText('Showcase', { exact: true })).toBeVisible();
  // the picker: two of the viewer's cars are already on the table, the limit is three
  const picker = page.getByRole('list', { name: 'Your cars' });
  await expect(picker.getByRole('button', { pressed: true })).toHaveCount(2);
  await expect(page.getByText('Yours', { exact: true })).toBeVisible();
  await expect(page.getByText('@blr_castings').first()).toBeVisible();
  // host controls are not there for an attendee
  await expect(page.getByText('Host controls')).toHaveCount(0);
});

test('meetup detail as the host: schedule with the fee, invites, co-hosts, moderation (F-23, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto(
    '/world/meetups/00000000-0000-4000-8000-00000000a002?__visual=1&as=host'
  );
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Treasure Hunt show-and-tell' })).toBeVisible();
  await expect(page.getByText(/hosted by you/)).toBeVisible();
  await expect(page.getByText('Host controls')).toBeVisible();
  await expect(page.getByText(/Scheduling charges the 5-credit hosting fee/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schedule' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel meetup' })).toBeVisible();
  await expect(page.getByLabel('Add a co-host by handle')).toBeVisible();
  await expect(page.getByText(/· co-host/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeVisible();
  // a draft is not open for invites yet (scheduled / live only)
  await expect(page.getByLabel('Invite a collector by handle')).toHaveCount(0);
});

test('create form is a single page with fee + capacity copy (F-23, D-027, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/meetups/new?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Host a meetup' })).toBeVisible();
  await expect(page.getByLabel('Title')).toBeVisible();
  await expect(page.getByLabel('Starts')).toBeVisible();
  await expect(page.getByLabel('Seats')).toHaveValue('10');
  await expect(page.getByLabel('Who can join')).toBeVisible();
  await expect(page.getByText(/hosts up to 10 seats/)).toBeVisible();
  await expect(page.getByText(/Scheduling costs a 5-credit hosting fee/)).toBeVisible();
  await expect(page.getByText(/In-person meetups arrive in a later update/)).toBeVisible();
  const save = page.getByRole('button', { name: 'Save draft' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Title').fill('Friday Skylines');
  await expect(save).toBeEnabled();
  // no step indicators — the prototype's forms are single-page (D-027)
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('live room: thread, reactions, showcase, host controls at 360px (F-23, fixture harness)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const res = await page.goto(
    '/world/meetups/00000000-0000-4000-8000-00000000a001/room?__visual=1'
  );
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText(/Live room · 6 in/)).toBeVisible();
  await expect(page.getByText('Welcome in! Show us what you brought.')).toBeVisible();
  await expect(page.getByText('R34 first — the one from the Dubai swap meet.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Reactions' }).getByRole('button')).toHaveCount(5);
  await expect(page.getByText(/On the table \(3\)/)).toBeVisible();
  await expect(page.getByLabel('Message the room')).toBeVisible();
  await expect(page.getByText('Host controls')).toHaveCount(0);
  // the host's seat shows mute / remove / end
  await page.goto('/world/meetups/00000000-0000-4000-8000-00000000a001/room?__visual=1&as=host');
  await expect(page.getByText('Host controls')).toBeVisible();
  await expect(page.getByRole('button', { name: 'End meetup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
});

test('world home lists the next meetups (F-23, fixture harness)', async ({ page }) => {
  const res = await page.goto('/world?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('Meetups', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /JDM night/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'More meetups' })).toHaveAttribute(
    'href',
    '/world/meetups?__visual=1'
  );
});

// ---- W07 (MV-W07-01/03/04/06): best-in-show + photo wall on meetups, clubs (list, clubhouse in three
// seats, create form), club-hosted meetups. Dark behind `world_meetups` / `world_clubs` (404 for a
// signed-in user while OFF, login for anon); the fixture harness renders them with deterministic data.
// The role rules themselves (who may remove / ban / promote, banned cannot rejoin, members-only feed)
// are pgTAP's: supabase/tests/0030_world_best_in_show_clubs.sql.

test('clubs are guarded for anon (D-028)', async ({ page }) => {
  await page.goto('/world/clubs');
  await expect(page).toHaveURL(/\/login\?next=%2Fworld%2Fclubs/);
  await page.goto('/world/clubs/jdm_club');
  await expect(page).toHaveURL(/\/login\?next=%2Fworld%2Fclubs%2Fjdm_club/);
});

test('ended meetup: best-in-show result card, vote counts, photo wall (F-23, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto(
    '/world/meetups/00000000-0000-4000-8000-00000000a001?__visual=1&state=ended'
  );
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('Ended', { exact: true })).toBeVisible();
  await expect(page.getByText('Best in show', { exact: true })).toBeVisible();
  await expect(page.getByText('@blr_castings · 3 votes', { exact: true })).toBeVisible();
  await expect(page.getByText(/frozen when the meetup ended/)).toBeVisible();
  // the tally under the cars, and the viewer's own ballot marked
  await expect(page.getByText(/@blr_castings · 3 votes · your vote/)).toBeVisible();
  await expect(page.getByText('1 vote', { exact: true })).toBeVisible();
  // attended + hosted by the club
  await expect(page.getByText(/You attended/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'JDM Collectors' })).toHaveAttribute(
    'href',
    '/world/clubs/jdm_club?__visual=1'
  );
  // the wall is open for a day after the end; RSVP is closed
  await expect(page.getByText('Photo wall', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a photo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Not going' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Report meetup' })).toBeVisible();
});

test('live room: one vote each, never for your own car; attendance line (F-23, fixture harness)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const res = await page.goto(
    '/world/meetups/00000000-0000-4000-8000-00000000a001/room?__visual=1'
  );
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  // three cars on the table: two are the viewer's own (no vote button), one is votable and holds
  // the viewer's ballot
  await expect(page.getByText(/On the table \(3\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Your vote' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Vote best in show' })).toHaveCount(0);
  await expect(page.getByText(/One vote each/)).toBeVisible();
  await expect(page.getByText(/Stay 10 minutes for your attendance to count/)).toBeVisible();
});

test('clubs list: all / mine tabs, role + request pills, start-a-club CTA (F-22, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/clubs?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Clubs' })).toBeVisible();
  await expect(page.getByRole('link', { name: /JDM Collectors/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Treasure Hunters/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Vault Circle/ })).toBeVisible();
  await expect(page.getByText('Requested', { exact: true })).toBeVisible();
  await expect(page.getByText(/@vault_circle · Invite only/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start a club' })).toHaveAttribute(
    'href',
    '/world/clubs/new?__visual=1'
  );
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByRole('link', { name: /Vault Circle/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /JDM Collectors/ })).toBeVisible();
});

test('clubhouse as a member: featured cars, meetups, club night, feed, roster — no staff tools (F-22, fixture harness)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const res = await page.goto('/world/clubs/jdm_club?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'JDM Collectors' })).toBeVisible();
  await expect(page.getByText(/@jdm_club · Open club · 12 members · AE/)).toBeVisible();
  await expect(page.getByText('You are a member.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();
  await expect(page.getByText('Clubhouse', { exact: true })).toBeVisible();
  await expect(page.getByText('Club meetups', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /JDM night/ })).toBeVisible();
  await expect(page.getByText(/JDM Saturday/)).toBeVisible();
  await expect(page.getByText('Meetup scheduled: JDM night')).toBeVisible();
  await expect(page.getByText('@blr_castings joined')).toBeVisible();
  await expect(page.getByText('Members (12)')).toBeVisible();
  // a member sees no owner / admin tools
  for (const name of ['Remove', 'Ban', 'Make admin', 'Hand over', 'Approve', 'Invite']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('form', { name: 'Club settings' })).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Club night' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Host a club meetup' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Report club' })).toBeVisible();
  // no horizontal scroll at 360px
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('clubhouse as the owner: requests, roles, bans, club night form, settings (F-22, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/clubs/jdm_club?__visual=1&as=owner');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('You are the club’s owner.')).toBeVisible();
  // the owner cannot leave (they hand the club over first)
  await expect(page.getByRole('button', { name: 'Leave' })).toHaveCount(0);
  // roles: the admin can be demoted, the member promoted; both can be removed, banned, handed the club
  await expect(page.getByRole('button', { name: 'Remove admin' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Make admin' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Hand over' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Ban', exact: true })).toHaveCount(2);
  // requests + invite
  await expect(page.getByText('Requests (1)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Decline' })).toBeVisible();
  await expect(page.getByLabel('Invite a collector by handle')).toBeVisible();
  // club night: a single-panel form, the fee is the host's own spend
  const night = page.getByRole('form', { name: 'Club night' });
  await expect(night.getByLabel('Repeats')).toHaveValue('weekly');
  await expect(night.getByLabel('Seats')).toHaveValue('10');
  await expect(page.getByText(/charged then, never automatically/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace club night' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Host a club meetup' })).toHaveAttribute(
    'href',
    /\/world\/meetups\/new\?__visual=1&club=/
  );
  await expect(
    page.getByRole('form', { name: 'Club settings' }).getByLabel('Club name')
  ).toHaveValue('JDM Collectors');
  // an owner does not report their own club
  await expect(page.getByRole('button', { name: 'Report club' })).toHaveCount(0);
});

test('clubhouse as a visitor: join button, open roster and feed, no club night (F-22, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/clubs/jdm_club?__visual=1&as=visitor');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('button', { name: 'Join the club' })).toBeVisible();
  await expect(page.getByText('@diecast_dxb started the club')).toBeVisible();
  await expect(page.getByText('Club night', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Leave' })).toHaveCount(0);
});

test('start-a-club form is a single page; the address follows the name (F-22, D-027, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/clubs/new?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByRole('heading', { name: 'Start a club' })).toBeVisible();
  const submit = page.getByRole('button', { name: 'Start the club' });
  await expect(submit).toBeDisabled();
  await page.getByLabel('Club name').fill('Matchbox Mondays UAE');
  await expect(page.getByLabel('Club address')).toHaveValue('matchbox_mondays_uae');
  await expect(page.getByLabel('Who can join')).toHaveValue('open');
  await expect(submit).toBeEnabled();
  await page.getByLabel('Club address').fill('no');
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('host a meetup as a club: "Host as" unlocks club-only visibility (F-22 / F-23, fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/world/meetups/new?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  const hostAs = page.getByLabel('Host as');
  const who = page.getByLabel('Who can join');
  await expect(hostAs).toHaveValue('');
  await expect(who.locator('option')).toHaveCount(3);
  await hostAs.selectOption({ label: 'JDM Collectors (club)' });
  await expect(who.locator('option')).toHaveCount(4);
  await who.selectOption('club');
  // back to the garage: club-only falls back to public
  await hostAs.selectOption('');
  await expect(who).toHaveValue('public');
  // the clubhouse's link preselects the club
  await page.goto('/world/meetups/new?__visual=1&club=00000000-0000-4000-8000-00000000c001');
  await expect(page.getByLabel('Host as')).toHaveValue('00000000-0000-4000-8000-00000000c001');
});

test('world home lists my clubs (F-22, fixture harness)', async ({ page }) => {
  const res = await page.goto('/world?__visual=1');
  test.skip(res?.status() !== 200, 'fixture harness is disabled on production deployments');
  await expect(page.getByText('Clubs', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /JDM Collectors/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'More clubs' })).toHaveAttribute(
    'href',
    '/world/clubs?__visual=1'
  );
});
