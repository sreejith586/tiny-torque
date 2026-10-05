// Client image pipeline (MV-S2-02, F-02). Downscale to ≤1600px on the long edge, encode JPEG at
// q0.82, and step quality down until ≤400KB so free-plan photos stay small on low-end Android.
// `fitWithin` is the pure sizing rule (unit-tested); `compressImage` is the browser-only wrapper
// that does the actual canvas encode.

export const IMAGE_MAX_DIM = 1600;
export const IMAGE_QUALITY = 0.82;
export const IMAGE_MAX_BYTES = 400 * 1024;

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Scale (w, h) to fit inside a `max`×`max` box, preserving aspect ratio and NEVER upscaling.
 * Returns integer dimensions. A non-positive input collapses to 0 (caller treats as invalid).
 */
export function fitWithin(width: number, height: number, max: number = IMAGE_MAX_DIM): Dimensions {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.round(width), height: Math.round(height) };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The quality ladder tried, in order, until the encoded blob is ≤ IMAGE_MAX_BYTES. */
export function qualitySteps(start: number = IMAGE_QUALITY): number[] {
  const steps: number[] = [];
  for (let q = start; q >= 0.4; q -= 0.1) steps.push(Math.round(q * 100) / 100);
  return steps;
}

/**
 * Browser-only: decode `file`, downscale per `fitWithin`, and encode JPEG stepping quality down
 * until ≤400KB (or the floor). Returns the compressed Blob. Throws if the browser can't decode it.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context for image compression.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let best: Blob | null = null;
  for (const q of qualitySteps()) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', q)
    );
    if (!blob) continue;
    best = blob;
    if (blob.size <= IMAGE_MAX_BYTES) break;
  }
  if (!best) throw new Error('Image encoding failed.');
  return best;
}
