import { describe, expect, it } from 'vitest';
import { toInsertRow } from '../service';

describe('garage.toInsertRow', () => {
  it('applies defaults and maps camelCase → snake_case', () => {
    const row = toInsertRow('u1', { brand: ' Hot Wheels ', photos: ['https://x.test/a.jpg'] });
    expect(row.owner_id).toBe('u1');
    expect(row.brand).toBe('Hot Wheels');
    expect(row.qty).toBe(1);
    expect(row.price_paid).toBe(0);
    expect(row.photo).toBe('https://x.test/a.jpg');
    expect(row.is_public).toBe(false);
  });
  it('rejects an empty brand', () => {
    expect(() => toInsertRow('u1', { brand: '   ' })).toThrow();
  });
  it('rejects more than 8 photos (max plan limit)', () => {
    const photos = Array.from({ length: 9 }, (_, i) => `https://x.test/${i}.jpg`);
    expect(() => toInsertRow('u1', { brand: 'Tomica', photos })).toThrow();
  });
});
