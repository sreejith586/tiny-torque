import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
// Optional: point at a preinstalled Chromium (e.g. sandboxes that ship /opt/pw-browsers/chromium).
const launchOptions = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : undefined;
// Vercel Deployment Protection: previews require a Vercel login unless the automation bypass
// secret is sent (Settings → Deployment Protection → Protection Bypass for Automation).
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = bypass
  ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
  : undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
    extraHTTPHeaders,
  },
  // D-027 visual guard: baselines live in e2e/__screenshots__ (Linux only, deviceScaleFactor 1).
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /visual(-local)?\.spec\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: /visual(-local)?\.spec\.ts/,
    },
    {
      // ALL pixel baselines run here, against a local server built from the pushed code — never the
      // Vercel preview, whose edge lags behind pushes and renders the fixture harness
      // inconsistently. Deterministic, so regens never race a deploy. Set LOCAL_VISUAL=1 to start
      // the webServer.
      name: 'visual-local',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1, baseURL: 'http://localhost:3000' },
      testMatch: /visual-local\.spec\.ts/,
    },
  ],
  // `next start`'s HTTP listener can report ready slightly before the server has finished warming
  // up, so the very first requests (many, in parallel, once workers start) can race a cold path
  // and return a stale/incomplete response. globalSetup runs once, after Playwright's own
  // webServer readiness check passes and before any test navigates — a plain warm-up request here
  // absorbs that race without adding a new dependency.
  globalSetup: process.env.BASE_URL && !process.env.LOCAL_VISUAL ? undefined : './e2e/warmup.ts',
  webServer:
    process.env.BASE_URL && !process.env.LOCAL_VISUAL
      ? undefined
      : {
          command: 'pnpm build && pnpm start',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
});
