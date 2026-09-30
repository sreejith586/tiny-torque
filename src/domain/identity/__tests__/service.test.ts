import { describe, expect, it } from 'vitest';
import {
  HANDLE_COOLDOWN_DAYS,
  isHandleCooldownActive,
  slugifyHandle,
  defaultCountryCode,
} from '../service';

const COUNTRIES = [
  { code: 'AE', dial_code: '+971' },
  { code: 'IN', dial_code: '+91' },
];

describe('identity.slugifyHandle', () => {
  it('lowercases and replaces non-alphanumerics with underscores', () => {
    expect(slugifyHandle('Sree Cars!!')).toBe('sree_cars');
  });
  it('trims leading/trailing underscores', () => {
    expect(slugifyHandle('  @Sree  ')).toBe('sree');
  });
  it('falls back to "collector" when nothing usable is left', () => {
    expect(slugifyHandle('99')).toBe('collector');
    expect(slugifyHandle('!!!')).toBe('collector');
  });
  it('truncates to 19 characters so a numeric suffix still fits under the 24-char limit', () => {
    const long = 'a'.repeat(40);
    expect(slugifyHandle(long).length).toBe(19);
  });
});

describe('identity.isHandleCooldownActive (F-01, 30-day handle change cooldown)', () => {
  it('is inactive when the handle was never changed', () => {
    expect(isHandleCooldownActive(null)).toBe(false);
  });
  it('is active the day after a change', () => {
    const now = new Date('2026-09-29T00:00:00.000Z');
    const changedAt = new Date('2026-09-28T00:00:00.000Z').toISOString();
    expect(isHandleCooldownActive(changedAt, now)).toBe(true);
  });
  it(`is inactive ${HANDLE_COOLDOWN_DAYS} days after a change`, () => {
    const changedAt = new Date('2026-09-01T00:00:00.000Z');
    const now = new Date(changedAt.getTime() + HANDLE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000 + 1000);
    expect(isHandleCooldownActive(changedAt.toISOString(), now)).toBe(false);
  });
});

describe('identity.defaultCountryCode (F-01 onboarding country prefill)', () => {
  it('matches the phone number dial code', () => {
    expect(defaultCountryCode({ phone: '+919999900001' }, COUNTRIES)).toBe('IN');
    expect(defaultCountryCode({ phone: '+971501234567' }, COUNTRIES)).toBe('AE');
  });
  it('defaults to AE for email sign-ins (no phone)', () => {
    expect(defaultCountryCode({ email: 'someone@example.com' }, COUNTRIES)).toBe('AE');
  });
  it('defaults to AE when the phone matches no enabled country', () => {
    expect(defaultCountryCode({ phone: '+15551234567' }, COUNTRIES)).toBe('AE');
  });
});
