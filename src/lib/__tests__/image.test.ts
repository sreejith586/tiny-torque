import { describe, expect, it } from 'vitest';
import { fitWithin, qualitySteps, IMAGE_MAX_DIM, IMAGE_QUALITY } from '../image';

describe('image.fitWithin (MV-S2-02 downscale rule)', () => {
  it('never upscales an image already within the box', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(IMAGE_MAX_DIM, 900)).toEqual({ width: IMAGE_MAX_DIM, height: 900 });
  });
  it('scales a landscape image to the max long edge, preserving aspect', () => {
    expect(fitWithin(3200, 2400)).toEqual({ width: 1600, height: 1200 });
  });
  it('scales a portrait image by its height (the long edge)', () => {
    expect(fitWithin(2400, 3200)).toEqual({ width: 1200, height: 1600 });
  });
  it('rounds to integers and never collapses a tiny edge below 1px', () => {
    const d = fitWithin(4000, 10);
    expect(d.width).toBe(1600);
    expect(d.height).toBe(4); // 10 * (1600/4000) = 4
    expect(fitWithin(4000, 2).height).toBe(1); // 2 * 0.4 = 0.8 → rounds to 1 via the max(1, …) floor
  });
  it('treats non-positive dimensions as invalid (0×0)', () => {
    expect(fitWithin(0, 500)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(-5, 500)).toEqual({ width: 0, height: 0 });
  });
  it('respects a custom max', () => {
    expect(fitWithin(1000, 500, 200)).toEqual({ width: 200, height: 100 });
  });
});

describe('image.qualitySteps', () => {
  it('starts at the default quality and steps down to a floor', () => {
    const steps = qualitySteps();
    expect(steps[0]).toBe(IMAGE_QUALITY);
    expect(steps[steps.length - 1]).toBeGreaterThanOrEqual(0.4);
    expect(steps.every((q, i) => i === 0 || q < (steps[i - 1] ?? Infinity))).toBe(true);
  });
});
