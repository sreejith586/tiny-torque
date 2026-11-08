// Generates the iOS home-screen startup images (apple-touch-startup-image) into public/splash/
// (MV-S9-02, F-17). iOS ignores the web manifest for splash screens and only uses an image whose
// pixel size matches the device exactly, so one PNG per supported iPhone size, portrait only.
// Art = the in-app brand splash (src/components/Splash.module.css): the prototype's fixed #EBE7DE
// background with the circular Tiny Torque badge centred at 52.5 % of the width, capped at 360 px (the
// badge art is detailed, so size drives the file weight). Pure pngjs compositing (dev dependency already
// present) + macOS `sips` to rasterise the webp badge — no new packages.
//
// Run:  node scripts/gen-ios-splash.mjs        (idempotent; commit the PNGs)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { PNG } from 'pngjs';

export const BG = { r: 0xeb, g: 0xe7, b: 0xde }; // Splash.module.css .splash background
export const LOGO_FRACTION = 0.525; // .logo width 52.5%
export const LOGO_MAX_PX = 360; // well under the badge's native 480 px — never upscaled, keeps each PNG ≈150 KB

/** [CSS width, CSS height, device pixel ratio] for the iPhones Safari still ships to. */
export const DEVICES = [
  [375, 667, 2], // SE (2nd/3rd gen), 6/7/8
  [375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 2], // XR, 11
  [414, 896, 3], // XS Max, 11 Pro Max
  [390, 844, 3], // 12, 12 Pro, 13, 13 Pro, 14
  [428, 926, 3], // 12 Pro Max, 13 Pro Max, 14 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro
  [440, 956, 3], // 16 Pro Max
];

export function fileName([w, h, dpr]) {
  return `splash-${w * dpr}x${h * dpr}.png`;
}

export function mediaQuery([w, h, dpr]) {
  return `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`;
}

/** Badge size in device pixels for a given CSS width + dpr: 52.5 % of the width, ≤ 480 px. */
export function logoSize(cssWidth, dpr) {
  return Math.min(LOGO_MAX_PX, Math.round(cssWidth * LOGO_FRACTION * dpr));
}

function rasteriseLogo(size, tmp) {
  // sips resizes + converts in one go; the badge is square so a single dimension is enough.
  execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), 'public/tiny-torque-logo.webp', '--out', tmp], {
    stdio: 'ignore',
  });
  return PNG.sync.read(readFileSync(tmp));
}

function compose(width, height, logo) {
  const out = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    out.data[i * 4] = BG.r;
    out.data[i * 4 + 1] = BG.g;
    out.data[i * 4 + 2] = BG.b;
    out.data[i * 4 + 3] = 255;
  }
  const ox = Math.round((width - logo.width) / 2);
  const oy = Math.round((height - logo.height) / 2);
  for (let y = 0; y < logo.height; y++) {
    for (let x = 0; x < logo.width; x++) {
      const si = (y * logo.width + x) * 4;
      const a = logo.data[si + 3] / 255;
      if (a === 0) continue;
      const di = ((oy + y) * width + (ox + x)) * 4;
      // source-over onto the opaque background
      out.data[di] = Math.round(logo.data[si] * a + out.data[di] * (1 - a));
      out.data[di + 1] = Math.round(logo.data[si + 1] * a + out.data[di + 1] * (1 - a));
      out.data[di + 2] = Math.round(logo.data[si + 2] * a + out.data[di + 2] * (1 - a));
    }
  }
  return PNG.sync.write(out, { colorType: 2 }); // RGB, no alpha — smaller, iOS needs none
}

if (process.argv[1]?.endsWith('gen-ios-splash.mjs')) {
  mkdirSync('public/splash', { recursive: true });
  const tmp = 'public/splash/.logo-tmp.png';
  const cache = new Map();
  for (const d of DEVICES) {
    const [w, h, dpr] = d;
    const size = logoSize(w, dpr);
    if (!cache.has(size)) cache.set(size, rasteriseLogo(size, tmp));
    const png = compose(w * dpr, h * dpr, cache.get(size));
    writeFileSync(`public/splash/${fileName(d)}`, png);
    console.log(`✔ public/splash/${fileName(d)} (${(png.length / 1024).toFixed(0)} KB, badge ${size}px)`);
  }
  rmSync(tmp, { force: true });
}
