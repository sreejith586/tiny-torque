import { describe, expect, it } from 'vitest';
import { isFlagActive, isInAudience, stableBucket } from '../evaluate';
import type { FlagAudience } from '../types';

describe('flags.isInAudience', () => {
  it('matches everyone when the audience is empty', () => {
    expect(isInAudience({}, {})).toBe(true);
    expect(isInAudience({}, { userId: 'u1' })).toBe(true);
  });

  it('filters by plan', () => {
    expect(isInAudience({ plans: ['pro'] }, { plan: 'pro' })).toBe(true);
    expect(isInAudience({ plans: ['pro'] }, { plan: 'free' })).toBe(false);
    expect(isInAudience({ plans: ['pro'] }, {})).toBe(false);
  });

  it('filters by country', () => {
    expect(isInAudience({ countries: ['AE', 'IN'] }, { countryCode: 'AE' })).toBe(true);
    expect(isInAudience({ countries: ['AE', 'IN'] }, { countryCode: 'US' })).toBe(false);
  });

  it('requires every specified dimension to match (AND)', () => {
    const audience: FlagAudience = { plans: ['pro'], countries: ['AE'] };
    expect(isInAudience(audience, { plan: 'pro', countryCode: 'AE' })).toBe(true);
    expect(isInAudience(audience, { plan: 'pro', countryCode: 'IN' })).toBe(false);
  });

  it('user_ids is an allowlist override that beats other clauses', () => {
    const audience: FlagAudience = { plans: ['pro'], user_ids: ['u1'] };
    expect(isInAudience(audience, { userId: 'u1', plan: 'free' })).toBe(true);
    expect(isInAudience(audience, { userId: 'u2', plan: 'free' })).toBe(false);
  });

  it('percent rollout fails closed without a stable userId', () => {
    expect(isInAudience({ percent: 100 }, {})).toBe(false);
  });

  it('percent 100 always matches a real user; percent 0 never does', () => {
    expect(isInAudience({ percent: 100 }, { userId: 'any-user' })).toBe(true);
    expect(isInAudience({ percent: 0 }, { userId: 'any-user' })).toBe(false);
  });
});

describe('flags.stableBucket', () => {
  it('is deterministic for the same input', () => {
    expect(stableBucket('user-123')).toBe(stableBucket('user-123'));
  });
  it('stays within 0-99', () => {
    for (const id of ['a', 'user-1', 'zzzzzzzz', '00000000-0000-0000-0000-000000000000']) {
      const bucket = stableBucket(id);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
    }
  });
});

describe('flags.isFlagActive', () => {
  it('is always false when the flag is disabled, regardless of audience', () => {
    expect(isFlagActive({ enabled: false, audience: {} }, { userId: 'u1' })).toBe(false);
  });
  it('defers to audience once enabled', () => {
    expect(isFlagActive({ enabled: true, audience: { plans: ['pro'] } }, { plan: 'pro' })).toBe(
      true
    );
    expect(isFlagActive({ enabled: true, audience: { plans: ['pro'] } }, { plan: 'free' })).toBe(
      false
    );
  });
});
