import { describe, expect, it } from 'vitest';
import { handleSchema, profileCreateSchema, profilePatchSchema } from '../schema';

describe('identity schemas', () => {
  it('requires a store name for shops', () => {
    const r = profileCreateSchema.safeParse({
      displayName: 'Vault Cars',
      accountType: 'shop',
      countryCode: 'AE',
    });
    expect(r.success).toBe(false);
  });
  it('accepts an individual without store name', () => {
    const r = profileCreateSchema.safeParse({
      displayName: 'Sree',
      accountType: 'individual',
      countryCode: 'AE',
      ageConfirmed: true,
      termsVersion: '1',
    });
    expect(r.success).toBe(true);
  });
  it('requires the 18+ confirmation and a terms version (MV-W01-08, 07 P8)', () => {
    const base = {
      displayName: 'Sree',
      accountType: 'individual',
      countryCode: 'AE',
      termsVersion: '1',
    };
    expect(profileCreateSchema.safeParse(base).success).toBe(false);
    expect(profileCreateSchema.safeParse({ ...base, ageConfirmed: false }).success).toBe(false);
    expect(
      profileCreateSchema.safeParse({ ...base, ageConfirmed: true, termsVersion: '' }).success
    ).toBe(false);
    expect(profileCreateSchema.safeParse({ ...base, ageConfirmed: true }).success).toBe(true);
  });
  it('requires a country code (F-01 onboarding v2, MV-S1-04)', () => {
    const r = profileCreateSchema.safeParse({ displayName: 'Sree', accountType: 'individual' });
    expect(r.success).toBe(false);
  });
  it('uppercases the country code and accepts an optional city', () => {
    const r = profileCreateSchema.safeParse({
      displayName: 'Sree',
      accountType: 'individual',
      countryCode: 'in',
      city: 'Bengaluru',
      ageConfirmed: true,
      termsVersion: '1',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.countryCode).toBe('IN');
  });
  it('patch schema leaves untouched keys undefined (PATCH semantics, MV-S0-09)', () => {
    const r = profilePatchSchema.parse({ displayName: 'New Name' });
    expect(r).toEqual({ displayName: 'New Name' });
    expect('mobile' in r).toBe(false);
  });
});

describe('handleSchema (F-01)', () => {
  it('accepts a valid handle and lowercases it', () => {
    const r = handleSchema.safeParse('Sree_Cars99');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('sree_cars99');
  });
  it('rejects handles shorter than 3 characters', () => {
    expect(handleSchema.safeParse('ab').success).toBe(false);
  });
  it('rejects handles longer than 24 characters', () => {
    expect(handleSchema.safeParse('a'.repeat(25)).success).toBe(false);
  });
  it('rejects characters outside [a-z0-9_]', () => {
    expect(handleSchema.safeParse('sree.cars').success).toBe(false);
    expect(handleSchema.safeParse('sree cars').success).toBe(false);
  });
  it('rejects reserved handles', () => {
    expect(handleSchema.safeParse('admin').success).toBe(false);
    expect(handleSchema.safeParse('settings').success).toBe(false);
  });
});
