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
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /visual\.spec\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: /visual\.spec\.ts/,
    },
    {
      name: 'visual',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
      testMatch: /visual\.spec\.ts/,
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
