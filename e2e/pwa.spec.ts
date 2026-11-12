import { test, expect } from '@playwright/test';

// MV-S9-02 (F-17): PWA surface — manifest, service worker, offline page, iOS meta, install prompt.
// Functional checks only (D-056): the worker's caching is exercised in the browser by toggling the
// context offline after a first online visit.

test('manifest is served with the install essentials', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.name).toContain('Tiny Torque');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/garage');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512'])
  );
});

test('service worker script is served fresh and the offline page is public', async ({
  request,
}) => {
  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  expect(sw.headers()['cache-control']).toContain('no-cache');
  expect(await sw.text()).toContain("addEventListener('fetch'");
  const offline = await request.get('/offline');
  expect(offline.status()).toBe(200);
  expect(await offline.text()).toContain('offline');
});

test('iOS home-screen meta: capable + startup images for every supported size', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes'
  );
  const startup = page.locator('link[rel="apple-touch-startup-image"]');
  expect(await startup.count()).toBeGreaterThanOrEqual(8);
  const first = startup.first();
  await expect(first).toHaveAttribute('media', /device-width.*device-pixel-ratio.*portrait/);
  const href = await first.getAttribute('href');
  const img = await page.request.get(href!);
  expect(img.status()).toBe(200);
  expect(img.headers()['content-type']).toContain('image/png');
});

test('install prompt waits for the 2nd visit, then offers to install (dismiss hides it)', async ({
  page,
}) => {
  // The visit counter is written by PwaInit's effect — waiting for it = waiting for hydration, so
  // the synthetic browser event below always finds the listener attached.
  const hydrated = (minVisits: number) =>
    page.waitForFunction(
      (n) => JSON.parse(localStorage.getItem('mv-pwa-visits') ?? '{"count":0}').count >= n,
      minVisits
    );
  const fireInstallEvent = () =>
    page.evaluate(() =>
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    );
  // 1st visit: no prompt even when the browser offers one.
  await page.goto('/market');
  await hydrated(1);
  await fireInstallEvent();
  await expect(page.locator('[data-install-prompt]')).toHaveCount(0);

  // 2nd visit (the visit counter treats a quick reload as the same visit, so backdate the first).
  await page.evaluate(() => {
    const raw = localStorage.getItem('mv-pwa-visits');
    const v = raw ? JSON.parse(raw) : { count: 1, last: Date.now() };
    localStorage.setItem(
      'mv-pwa-visits',
      JSON.stringify({ count: v.count, last: Date.now() - 2 * 3600_000 })
    );
  });
  await page.goto('/market');
  await hydrated(2);
  await fireInstallEvent();
  const prompt = page.locator('[data-install-prompt]');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('Add Tiny Torque to your home screen');
  await prompt.getByRole('button', { name: 'Not now' }).click();
  await expect(prompt).toHaveCount(0);
  // Dismissed → not offered again on the next visit.
  await page.goto('/market');
  await hydrated(2);
  await fireInstallEvent();
  await expect(page.locator('[data-install-prompt]')).toHaveCount(0);
});

test('offline: the worker serves the offline page for an uncached route', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'service workers are exercised in Chromium only');
  await page.goto('/market');
  const registered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg;
  });
  test.skip(!registered, 'the worker only registers on a production build');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Let the install step finish precaching /offline.
  await page.waitForFunction(async () =>
    (await caches.keys()).some((k) => k.startsWith('tt-shell-'))
  );
  await context.setOffline(true);
  await page.goto('/legal/terms');
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  await expect(page.locator('[data-offline-banner]')).toBeVisible();
  await context.setOffline(false);
});
