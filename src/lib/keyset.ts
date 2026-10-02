// Generic keyset-cursor helpers for stable pagination (shared across domain list queries).
// Keyset (not offset) pagination is stable under concurrent inserts. The garage module has an
// equivalent inline copy predating this file; both can collapse onto this later.

export interface Cursor {
  /** The sort column's value on the last row of the previous page. */
  value: string | number;
  /** That row's id (tiebreaker). */
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.value, c.id])).toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const [value, id] = JSON.parse(Buffer.from(raw, 'base64url').toString());
    if ((typeof value !== 'string' && typeof value !== 'number') || typeof id !== 'string') {
      return null;
    }
    return { value, id };
  } catch {
    return null;
  }
}

/**
 * PostgREST `.or()` filter for "rows after this cursor" given the sort direction: descending wants
 * rows strictly less than the cursor value (then the id tiebreak); ascending is the mirror.
 */
export function keysetFilter(column: string, ascending: boolean, c: Cursor): string {
  const cmp = ascending ? 'gt' : 'lt';
  const v = typeof c.value === 'string' ? `"${c.value}"` : c.value;
  return `${column}.${cmp}.${v},and(${column}.eq.${v},id.${cmp}.${c.id})`;
}
