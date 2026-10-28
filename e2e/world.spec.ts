import { test, expect } from '@playwright/test';

// W02 (F-20/F-27): the Collectors World screens stay dark — /world is guarded (anon → login) and
// 404s for a signed-in user while the `world` flag is off — but render with fixture data through
// the ?__visual harness (D-056, never in production), so the garage scene, editor and shop can be
// smoke-checked on every preview without a database or a flag flip.

test('world is guarded for anon and the API seam stays dark (D-028)', async ({ page, request }) => {
  await page.goto('/world');
  await expect(page).toHaveURL(/\/login\?next=%2Fworld/);
  expect((await request.get('/api/v1/world/me')).status()).toBe(401);
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
  await expect(page.getByText('Slot 3', { exact: true })).toBeVisible();
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
  await expect(page.getByText('Themes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Owned' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Earned only' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Buy \(1\/3\)/ })).toBeVisible();
  await expect(page.getByText('Your inventory')).toBeVisible();
});
