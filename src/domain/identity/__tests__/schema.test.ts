import { describe, expect, it } from 'vitest';
import { profileCreateSchema, profilePatchSchema } from '../schema';

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
