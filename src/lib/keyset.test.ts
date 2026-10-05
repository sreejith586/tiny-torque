import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, keysetFilter } from './keyset';

describe('keyset cursor', () => {
  it('round-trips string and numeric values', () => {
    expect(decodeCursor(encodeCursor({ value: '2026-01-01', id: 'a' }))).toEqual({
      value: '2026-01-01',
      id: 'a',
    });
    expect(decodeCursor(encodeCursor({ value: 42, id: 'b' }))).toEqual({ value: 42, id: 'b' });
  });

  it('rejects malformed cursors', () => {
    expect(decodeCursor('not-base64!!')).toBeNull();
    expect(decodeCursor(Buffer.from('{}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('[true,"a"]').toString('base64url'))).toBeNull();
  });

  it('builds the right comparison for descending vs ascending', () => {
    const c = { value: 100, id: 'x' };
    expect(keysetFilter('price', false, c)).toBe('price.lt.100,and(price.eq.100,id.lt.x)');
    expect(keysetFilter('price', true, c)).toBe('price.gt.100,and(price.eq.100,id.gt.x)');
  });

  it('quotes string cursor values', () => {
    expect(keysetFilter('created_at', false, { value: '2026-01-01', id: 'x' })).toBe(
      'created_at.lt."2026-01-01",and(created_at.eq."2026-01-01",id.lt.x)'
    );
  });
});
