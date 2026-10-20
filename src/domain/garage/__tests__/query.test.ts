import { describe, expect, it } from 'vitest';
import { encodeCursor, decodeCursor, keysetFilter, computeStats, type StatRow } from '../query';

describe('garage cursor (MV-S2-04 keyset pagination)', () => {
  it('round-trips a cursor', () => {
    const c = { value: '2026-09-01T00:00:00.000Z', id: 'abc' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it('round-trips a numeric sort value', () => {
    const c = { value: 42, id: 'xyz' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it('returns null for garbage', () => {
    expect(decodeCursor('not-base64-%%%')).toBeNull();
    expect(decodeCursor(Buffer.from('{"nope":1}').toString('base64url'))).toBeNull();
  });
});

describe('garage keysetFilter', () => {
  it('descending uses lt + id tiebreak, quoting string values', () => {
    expect(keysetFilter('created_at', false, { value: '2026-01-01', id: 'i1' })).toBe(
      'created_at.lt."2026-01-01",and(created_at.eq."2026-01-01",id.lt.i1)'
    );
  });
  it('ascending uses gt, numeric values unquoted', () => {
    expect(keysetFilter('qty', true, { value: 5, id: 'i2' })).toBe(
      'qty.gt.5,and(qty.eq.5,id.gt.i2)'
    );
  });
});

describe('garage computeStats (F-02 stats)', () => {
  const rows: StatRow[] = [
    { brand: 'Hot Wheels', model: 'Skyline', variant: 'Silver', qty: 2, price_paid: 45 },
    { brand: 'Hot Wheels', model: 'Skyline', variant: 'Silver', qty: 1, price_paid: 40 }, // dup of #1
    { brand: 'Hot Wheels', model: 'Civic', variant: null, qty: 1, price_paid: 10 },
    { brand: 'Matchbox', model: 'Defender', variant: null, qty: 3, price_paid: 12 },
  ];
  const s = computeStats(rows);

  it('counts totals, qty and Σ price paid', () => {
    expect(s.totalItems).toBe(4);
    expect(s.totalQty).toBe(7);
    expect(s.totalValue).toBe(45 + 40 + 10 + 12);
  });
  it('counts items in duplicate groups (brand+model+variant)', () => {
    expect(s.duplicates).toBe(2); // the two matching Skylines
  });
  it('ranks top brands by count', () => {
    expect(s.topBrands[0]).toEqual({ brand: 'Hot Wheels', count: 3 });
    expect(s.topBrands[1]).toEqual({ brand: 'Matchbox', count: 1 });
  });
  it('is empty-safe', () => {
    expect(computeStats([])).toEqual({
      totalItems: 0,
      totalQty: 0,
      rareItems: 0,
      totalValue: 0,
      duplicates: 0,
      topBrands: [],
    });
  });
});
