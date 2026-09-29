import { describe, expect, it } from 'vitest';
import { handleSchema, profileCreateSchema, profilePatchSchema } from '../schema';

describe('identity schemas', () => {
  it('requires a store name for shops', () => {
    const r = profileCreateSchema.safeParse({ displayName: 'Vault Cars', accountType: 'shop' });
    expect(r.success).toBe(false);
  });
  it('accepts an individual without store name', () => {
    const r = profileCreateSchema.safeParse({ displayName: 'Sree', accountType: 'individual' });
    expect(r.success).toBe(true);
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
