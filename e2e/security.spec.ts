import { test, expect } from '@playwright/test';

// MV-S10-01 (F-19): the security headers are really on the responses, the CSP does not break the
// app's own screens, and the S10 public pages (legal / policy / known issues) render.

test('every response carries the security header set', async ({ request }) => {
  for (const path of ['/', '/login', '/legal/terms']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const h = res.headers();
    const csp = h['content-security-policy'] ?? '';
    expect(csp, `${path} CSP`).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  }
});

for (const path of ['/login', '/market?__visual=1', '/garage?__visual=1', '/settings?__visual=1']) {
  test(`the CSP blocks nothing the app itself needs on ${path}`, async ({ page }) => {
    const blocked: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        (window as unknown as { __csp: string[] }).__csp ??= [];
        (window as unknown as { __csp: string[] }).__csp.push(
          `${e.violatedDirective} ${e.blockedURI}`
        );
      });
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        blocked.push(msg.text());
      }
    });
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    // Not networkidle: fixture images point at a placeholder host and never settle. Hydration
    // plus the lazy analytics import is what could trip the policy — give those a moment.
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    const events = await page.evaluate(
      () => (window as unknown as { __csp?: string[] }).__csp ?? []
    );
    // Preview deployments inject Vercel's own toolbar / feedback scripts — not ours to police.
    const ours = [...blocked, ...events].filter((v) => !/vercel\.(live|com)|pusher/.test(v));
    expect(ours, ours.join('\n')).toEqual([]);
  });
}

const POLICY_PAGES: Array<{ path: string; heading: string; text: RegExp }> = [
  { path: '/legal/offline-deals', heading: 'Offline deals', text: /no escrow and no commission/i },
  { path: '/legal/abuse', heading: 'Abuse and reporting', text: /up to 10 reports a day/i },
  { path: '/legal/known-issues', heading: 'Known issues', text: /Send feedback/ },
];

for (const p of POLICY_PAGES) {
  test(`${p.path} is public and renders`, async ({ page }) => {
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible();
    await expect(page.getByText(p.text).first()).toBeVisible();
  });
}

test('Settings links the policies, known issues and the status pages (fixture harness)', async ({
  page,
}) => {
  const res = await page.goto('/settings?__visual=1');
  test.skip(res?.url().includes('/login') ?? false, 'fixture harness is off on this deployment');
  for (const href of ['/legal/offline-deals', '/legal/abuse', '/legal/known-issues']) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await expect(page.locator('a[href="https://status.supabase.com"]')).toHaveAttribute(
    'rel',
    /noopener/
  );
  await expect(page.locator('a[href="https://www.vercel-status.com"]')).toHaveCount(1);
});
