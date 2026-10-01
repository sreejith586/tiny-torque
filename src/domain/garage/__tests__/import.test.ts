import { describe, expect, it } from 'vitest';
import { autoMapHeaders, validateImportRow, chunk, type HeaderMapping } from '../import';

describe('import.autoMapHeaders (MV-S2-08)', () => {
  it('matches exact labels/keys case- and space-insensitively', () => {
    const m = autoMapHeaders(['Brand', 'MODEL', 'price paid', 'Qty']);
    expect(m.brand).toBe('Brand');
    expect(m.model).toBe('MODEL');
    expect(m.pricePaid).toBe('price paid');
    expect(m.qty).toBe('Qty');
  });
  it('leaves unmapped fields absent', () => {
    const m = autoMapHeaders(['brand', 'random column']);
    expect(m.brand).toBe('brand');
    expect(m.rarity).toBeUndefined();
  });
});

describe('import.validateImportRow', () => {
  const mapping: HeaderMapping = {
    brand: 'Brand',
    model: 'Model',
    qty: 'Qty',
    pricePaid: 'Price',
  };

  it('maps + coerces a good row', () => {
    const r = validateImportRow(
      { Brand: ' Hot Wheels ', Model: 'Civic', Qty: '3', Price: '12.50' },
      mapping
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.brand).toBe('Hot Wheels');
      expect(r.input.qty).toBe(3);
      expect(r.input.pricePaid).toBe(12.5);
    }
  });
  it('rejects a row with no brand', () => {
    const r = validateImportRow({ Brand: '', Model: 'Civic' }, mapping);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/brand/i);
  });
  it('rejects a non-numeric quantity', () => {
    const r = validateImportRow({ Brand: 'Tomica', Qty: 'abc' }, mapping);
    expect(r.ok).toBe(false);
  });
  it('treats blank optional numbers as unset (defaults apply)', () => {
    const r = validateImportRow({ Brand: 'Tomica', Qty: '', Price: '' }, mapping);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.qty).toBeUndefined();
      expect(r.input.pricePaid).toBeUndefined();
    }
  });
});

describe('import.chunk (batched insert)', () => {
  it('splits into fixed-size batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
  });
});
