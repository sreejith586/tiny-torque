// Client-bundle report (MV-S9-03, F-17). Next 16's build output no longer prints "First Load JS" per
// route, so this reads the build manifests and prints, per app route, the JS the browser must
// download on a cold load: shared chunks (every route) + the route's own chunks, raw and gzipped.
// Dependency-free (node:zlib) — no bundle-analyzer package needed; run after `pnpm build`:
//
//   pnpm build && node scripts/bundle-report.mjs            # table, sorted by first-load size
//   node scripts/bundle-report.mjs --json                   # machine-readable
//   node scripts/bundle-report.mjs --budget 220             # exit 1 if any route > 220 KB gz
//
// Budget note (05 S9 "mid-range Android over 4G"): ~200–250 KB of gzipped JS on first load is the
// line where interactivity starts slipping past ~3 s on a Moto G-class device.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const root = process.cwd();
const next = path.join(root, '.next');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const budgetIdx = args.indexOf('--budget');
const budgetKb = budgetIdx !== -1 ? Number(args[budgetIdx + 1]) : null;

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

// Turbopack (Next 16) writes one client-reference manifest per route under .next/server/app; the
// union of every client module's chunks is exactly the JS that route ships to the browser.
const appDir = path.join(next, 'server', 'app');
if (!existsSync(appDir)) {
  console.error('No .next/server/app — run `pnpm build` first.');
  process.exit(2);
}
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'page_client-reference-manifest.js') out.push(p);
  }
  return out;
}
function routeChunks(manifestFile) {
  const src = readFileSync(manifestFile, 'utf8');
  const m = src.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!m) return new Set();
  const j = JSON.parse(m[1]);
  const files = new Set();
  for (const mod of Object.values(j.clientModules ?? {})) {
    for (const c of mod.chunks ?? []) files.add(String(c).replace(/^\/_next\//, ''));
  }
  for (const list of Object.values(j.entryJSFiles ?? {})) for (const c of list) files.add(String(c).replace(/^\/_next\//, ''));
  return files;
}
const buildManifest = readJson(path.join(next, 'build-manifest.json'));

const sizeCache = new Map();
function sizes(file) {
  if (sizeCache.has(file)) return sizeCache.get(file);
  const abs = path.join(next, file);
  let raw = 0;
  let gz = 0;
  try {
    raw = statSync(abs).size;
    gz = gzipSync(readFileSync(abs), { level: 9 }).length;
  } catch {
    // a manifest entry that isn't on disk — skip
  }
  const s = { raw, gz };
  sizeCache.set(file, s);
  return s;
}

const isJs = (f) => f.endsWith('.js');
// Shared = the runtime every page boots (rootMainFiles) + whatever every route's manifest has in
// common (the root layout's client components: header, nav, theme, analytics, PWA).
const manifests = walk(appDir);
const perRoute = manifests.map((f) => ({
  route: '/' + path.relative(appDir, path.dirname(f)).split(path.sep).join('/').replace(/^\/?/, '').replace(/\/$/, ''),
  files: routeChunks(f),
}));
const shared = new Set((buildManifest.rootMainFiles ?? []).filter(isJs));
if (perRoute.length) {
  for (const f of perRoute[0].files) if (isJs(f) && perRoute.every((r) => r.files.has(f))) shared.add(f);
}

function total(files) {
  return [...files].reduce(
    (acc, f) => {
      const s = sizes(f);
      acc.raw += s.raw;
      acc.gz += s.gz;
      return acc;
    },
    { raw: 0, gz: 0 }
  );
}

const sharedTotal = total(shared);
const rows = [];
for (const { route: rawRoute, files } of perRoute) {
  const route = rawRoute === '/' || rawRoute === '' ? '/' : rawRoute;
  if (route.startsWith('/_')) continue; // _global-error, _not-found
  const own = new Set([...files].filter((f) => isJs(f) && !shared.has(f)));
  const ownTotal = total(own);
  rows.push({
    route,
    ownChunks: own.size,
    ownGz: ownTotal.gz,
    firstLoadGz: sharedTotal.gz + ownTotal.gz,
    firstLoadRaw: sharedTotal.raw + ownTotal.raw,
  });
}
rows.sort((a, b) => b.firstLoadGz - a.firstLoadGz);

const kb = (n) => (n / 1024).toFixed(1).padStart(7);
if (asJson) {
  console.log(JSON.stringify({ shared: sharedTotal, routes: rows }, null, 2));
} else {
  console.log(`Shared (every route): ${kb(sharedTotal.gz)} KB gz  (${kb(sharedTotal.raw)} KB raw, ${shared.size} chunks)\n`);
  console.log('route'.padEnd(36) + 'own KB gz   first-load KB gz   first-load KB raw');
  for (const r of rows) {
    console.log(`${r.route.padEnd(36)}${kb(r.ownGz)}  ${kb(r.firstLoadGz)}            ${kb(r.firstLoadRaw)}`);
  }
  // The biggest individual chunks tell you *what* to split.
  const chunkRows = [...sizeCache.entries()]
    .filter(([f]) => isJs(f))
    .map(([f, s]) => ({ f, ...s }))
    .sort((a, b) => b.gz - a.gz)
    .slice(0, 8);
  console.log('\nLargest chunks (gz):');
  for (const c of chunkRows) console.log(`  ${kb(c.gz)} KB  ${c.f}${shared.has(c.f) ? '  [shared]' : ''}`);
}

if (budgetKb !== null && Number.isFinite(budgetKb)) {
  const over = rows.filter((r) => r.firstLoadGz / 1024 > budgetKb);
  if (over.length) {
    console.error(`\n✖ ${over.length} route(s) over the ${budgetKb} KB gz first-load budget: ${over.map((r) => r.route).join(', ')}`);
    process.exit(1);
  }
  console.log(`\n✔ every route within the ${budgetKb} KB gz first-load budget`);
}
