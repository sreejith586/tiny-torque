// iOS startup images (MV-S9-02, F-17). Mirrors scripts/gen-ios-splash.mjs's DEVICES table — the
// media query must name the exact CSS size + pixel ratio or Safari ignores the image. Kept as data
// (not imported from the .mjs) so the server bundle stays free of node:child_process.
const DEVICES: ReadonlyArray<readonly [number, number, number]> = [
  [375, 667, 2],
  [375, 812, 3],
  [414, 896, 2],
  [414, 896, 3],
  [390, 844, 3],
  [428, 926, 3],
  [393, 852, 3],
  [430, 932, 3],
  [402, 874, 3],
  [440, 956, 3],
];

export const IOS_STARTUP_IMAGES = DEVICES.map(([w, h, dpr]) => ({
  url: `/splash/splash-${w * dpr}x${h * dpr}.png`,
  media: `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));
