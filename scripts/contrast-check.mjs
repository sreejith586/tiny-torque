// WCAG contrast check over the six theme token sets (MV-S9-04, F-17 "contrast check script over
// all 6 themes"). Reads THEMES straight out of src/lib/theme.ts (D-027: the token values are the
// single source of truth) and checks every foreground/background pairing the UI actually uses:
//
//   text      --cream  on --bg / --panel / --panel-alt          AA normal text   ≥ 4.5
//   secondary --muted  on --bg / --panel / --panel-alt          AA normal text   ≥ 4.5
//   accents   --orange / --teal / --gold / --danger / --violet  AA large text + UI components ≥ 3.0
//             on --bg / --panel  (status pills, links, stat values, icon buttons — ≥ 13 px bold)
//   buttons   --btn-text on --orange (btn-primary)              AA normal text   ≥ 4.5
//   borders   --border on --panel                               non-text contrast ≥ 1.5 (advisory)
//
// Exit 1 on any failing pair, so it can sit in CI next to lint. `--json` for machine output.
//   node scripts/contrast-check.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/lib/theme.ts', import.meta.url), 'utf8');

/** Parse `'theme-key': { label: '…', vars: { '--x': '#hex', … } }` blocks without executing TS. */
export function parseThemes(source) {
  const themes = {};
  const blockRe = /'([a-z-]+)':\s*\{\s*label:\s*'([^']*)'[\s\S]*?vars:\s*\{([\s\S]*?)\}\s*,?\s*\}/g;
  let m;
  while ((m = blockRe.exec(source))) {
    const vars = {};
    for (const v of m[3].matchAll(/'(--[a-z-]+)':\s*'(#[0-9a-fA-F]{6})'/g)) vars[v[1]] = v[2];
    themes[m[1]] = { label: m[2], vars };
  }
  return themes;
}

export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const PAIRS = [
  { fg: '--cream', bg: '--bg', min: 4.5, use: 'body text' },
  { fg: '--cream', bg: '--panel', min: 4.5, use: 'text in panels/cards' },
  { fg: '--cream', bg: '--panel-alt', min: 4.5, use: 'text in alt panels' },
  { fg: '--muted', bg: '--bg', min: 4.5, use: 'secondary text' },
  { fg: '--muted', bg: '--panel', min: 4.5, use: 'secondary text in panels' },
  { fg: '--muted', bg: '--panel-alt', min: 4.5, use: 'secondary text in alt panels' },
  { fg: '--orange', bg: '--bg', min: 3, use: 'accent / links / pending pill' },
  { fg: '--orange', bg: '--panel', min: 3, use: 'accent in panels' },
  { fg: '--teal', bg: '--bg', min: 3, use: 'teal accent / accepted pill' },
  { fg: '--teal', bg: '--panel', min: 3, use: 'teal accent in panels' },
  { fg: '--gold', bg: '--bg', min: 3, use: 'gold accent / warning banner' },
  { fg: '--gold', bg: '--panel', min: 3, use: 'gold accent in panels' },
  { fg: '--gold', bg: '--panel-alt', min: 3, use: 'warning banner text (panel-alt bg)' },
  { fg: '--danger', bg: '--bg', min: 3, use: 'danger / field-error' },
  { fg: '--danger', bg: '--panel', min: 3, use: 'danger in panels' },
  { fg: '--violet', bg: '--bg', min: 3, use: 'violet accent' },
  { fg: '--violet', bg: '--panel', min: 3, use: 'violet accent in panels' },
  { fg: '--btn-text', bg: '--orange', min: 4.5, use: 'btn-primary label' },
  { fg: '--border', bg: '--panel', min: 1.5, use: 'panel border (non-text, advisory)', advisory: true },
];

export function check(themes) {
  const rows = [];
  for (const [key, theme] of Object.entries(themes)) {
    for (const p of PAIRS) {
      const fg = theme.vars[p.fg];
      const bg = theme.vars[p.bg];
      if (!fg || !bg) continue;
      const ratio = contrast(fg, bg);
      rows.push({ theme: key, ...p, fgHex: fg, bgHex: bg, ratio, pass: ratio >= p.min });
    }
  }
  return rows;
}

if (process.argv[1]?.endsWith('contrast-check.mjs')) {
  const themes = parseThemes(src);
  const rows = check(themes);
  const asJson = process.argv.includes('--json');
  const failures = rows.filter((r) => !r.pass && !r.advisory);
  const advisories = rows.filter((r) => !r.pass && r.advisory);
  if (asJson) {
    console.log(JSON.stringify({ themes: Object.keys(themes), rows, failures: failures.length }, null, 2));
  } else {
    console.log(`Themes: ${Object.keys(themes).length} · pairs per theme: ${PAIRS.length}\n`);
    let lastTheme = '';
    for (const r of rows) {
      if (r.theme !== lastTheme) {
        console.log(`\n[${r.theme}] ${themes[r.theme].label}`);
        lastTheme = r.theme;
      }
      const mark = r.pass ? '  ok ' : r.advisory ? ' adv ' : 'FAIL ';
      console.log(`${mark} ${r.ratio.toFixed(2).padStart(5)} ≥ ${String(r.min).padEnd(4)} ${r.fg} ${r.fgHex} on ${r.bg} ${r.bgHex}  — ${r.use}`);
    }
    console.log('');
    if (advisories.length) console.log(`ℹ ${advisories.length} advisory (non-text) pair(s) below target.`);
    if (failures.length) {
      console.log(`✖ ${failures.length} failing pair(s):`);
      for (const f of failures) console.log(`   ${f.theme}: ${f.fg} on ${f.bg} = ${f.ratio.toFixed(2)} (needs ${f.min}) — ${f.use}`);
      process.exit(1);
    }
    console.log('✔ every text/UI pair meets WCAG AA in all six themes');
  }
}
