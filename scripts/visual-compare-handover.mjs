// One-off D-041 proof: pixel-compare the current build against Varun's handover build (fd3b02d).
// Usage: node scripts/visual-compare-handover.mjs http://localhost:3000 http://localhost:3001 out/
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [current, handover, out = 'visual-compare'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const THEMES = [
  'workshop-light',
  'racing-green',
  'sunset-amber',
  'graphite-steel',
  'aurora-glass',
  'leather-chrome',
];
// [name, currentPath, handoverPath, prepare]
const SCREENS = [
  ['landing', '/', '/'],
  ['login-phone', '/login', '/login', 'phone'],
  ['market', '/market', '/market'],
  ['add-car', '/garage/add?__visual=1', '/garage/add'],
  ['add-car-more', '/garage/add?__visual=1', '/garage/add', 'more'],
  ['scan', '/garage/scan?__visual=1', '/garage/scan'],
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
const results = [];
for (const theme of THEMES) {
  for (const [name, curPath, hoPath, prepare] of SCREENS) {
    const shots = [];
    for (const [base, path] of [
      [current, curPath],
      [handover, hoPath],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      });
      await ctx.addInitScript((t) => localStorage.setItem('mini-vault-theme', t), theme);
      const page = await ctx.newPage();
      await page.goto(base + path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      if (prepare === 'phone') {
        const btn = page.getByRole('button', { name: 'Use mobile number instead' });
        if (await btn.count()) await btn.click();
      }
      if (prepare === 'more') await page.getByRole('button', { name: 'More details' }).click();
      await page.waitForTimeout(150);
      shots.push(
        PNG.sync.read(
          await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
        )
      );
      await ctx.close();
    }
    const [a, b] = shots;
    const w = Math.max(a.width, b.width);
    const h = Math.max(a.height, b.height);
    const pad = (img) => {
      if (img.width === w && img.height === h) return img;
      const p = new PNG({ width: w, height: h });
      PNG.bitblt(img, p, 0, 0, img.width, img.height, 0, 0);
      return p;
    };
    const A = pad(a);
    const B = pad(b);
    const diff = new PNG({ width: w, height: h });
    const bad = pixelmatch(A.data, B.data, diff.data, w, h, { threshold: 0.1 });
    const ratio = bad / (w * h);
    results.push({
      theme,
      name,
      sizeCurrent: `${a.width}x${a.height}`,
      sizeHandover: `${b.width}x${b.height}`,
      diffPixels: bad,
      diffRatio: +ratio.toFixed(5),
    });
    if (bad > 0) writeFileSync(`${out}/${name}-${theme}-diff.png`, PNG.sync.write(diff));
  }
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
for (const r of results)
  console.log(
    `${r.diffRatio === 0 ? 'SAME' : 'DIFF'}  ${r.name.padEnd(14)} ${r.theme.padEnd(16)} ${r.sizeCurrent} vs ${r.sizeHandover}  ${r.diffPixels}px (${(r.diffRatio * 100).toFixed(2)}%)`
  );
