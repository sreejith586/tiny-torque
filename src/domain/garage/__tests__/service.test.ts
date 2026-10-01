import { describe, expect, it } from 'vitest';
import { toInsertRow } from '../service';

describe('garage.toInsertRow', () => {
  it('applies defaults and maps camelCase → snake_case', () => {
    const row = toInsertRow('u1', { brand: ' Hot Wheels ', cardType: 'Long card' });
    expect(row.owner_id).toBe('u1');
    expect(row.brand).toBe('Hot Wheels');
    expect(row.card_type).toBe('Long card');
    expect(row.qty).toBe(1);
    expect(row.price_paid).toBe(0);
    expect(row.is_public).toBe(false);
  });
  it('does not write the legacy photo/photos columns (images are media rows now, D-010)', () => {
    const row = toInsertRow('u1', { brand: 'Hot Wheels' });
    expect('photo' in row).toBe(false);
    expect('photos' in row).toBe(false);
  });
  it('rejects an empty brand', () => {
    expect(() => toInsertRow('u1', { brand: '   ' })).toThrow();
  });
});
