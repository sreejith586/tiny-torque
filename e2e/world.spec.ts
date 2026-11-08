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
