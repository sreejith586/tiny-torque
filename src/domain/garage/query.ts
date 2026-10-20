// Server-side garage list: query shape, sort config, and keyset-cursor encoding (MV-S2-04, F-02).
// Pure helpers here are unit-tested; the DB query that consumes them lives in repo.ts.

export const GARAGE_PAGE_SIZE = 24;

export type GarageSort = 'newest' | 'brand' | 'qty' | 'price';

export interface GarageQuery {
  q?: string;
  brand?: string;
  rarity?: string;
  condition?: string;
  isPublic?: boolean;
  isFavorite?: boolean;
  forSale?: boolean;
  sort?: GarageSort;
  cursor?: string;
  limit?: number;
}

/** The DB column + direction each sort maps to. `id` is always the tiebreaker (same direction). */
export const SORT_CONFIG: Record<GarageSort, { column: string; ascending: boolean }> = {
  newest: { column: 'created_at', ascending: false },
  brand: { column: 'brand', ascending: true },
  qty: { column: 'qty', ascending: false },
  price: { column: 'price_paid', ascending: false },
};

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
 * The PostgREST `.or()` filter for "rows after this cursor", given the sort direction. For a
 * descending sort we want rows strictly less than the cursor (then the id tiebreak); ascending is
 * the mirror. Keyset pagination — stable under inserts, unlike offset.
 */
export function keysetFilter(column: string, ascending: boolean, c: Cursor): string {
  const cmp = ascending ? 'gt' : 'lt';
  const v = typeof c.value === 'string' ? `"${c.value}"` : c.value;
  return `${column}.${cmp}.${v},and(${column}.eq.${v},id.${cmp}.${c.id})`;
}

// ---------- stats (F-02: totals, qty, value, duplicates, top brands) ----------

export interface StatRow {
  brand: string;
  model: string | null;
  variant: string | null;
  qty: number;
  price_paid: number;
  rarity?: string | null;
}

/** F-02's rarity enum is common/uncommon/rare/super-rare/treasure-hunt/chase, but the column is
 *  free text (Varun's prototype wrote labels like "Regular" / "Super Treasure Hunt"). "Common" here
 *  = empty or any of the mainline-ish spellings; everything else counts as rarer than common. */
const COMMON_RARITY = /^(common|regular|mainline|basic|standard|normal)$/i;
export function isRarerThanCommon(rarity: string | null | undefined): boolean {
  const r = (rarity ?? '').trim();
  return r.length > 0 && !COMMON_RARITY.test(r);
}

export interface GarageStats {
  totalItems: number;
  totalQty: number;
  /** Σ price paid across items (F-02; catalogue value comes later). */
  totalValue: number;
  /** Count of items that share brand+model+variant with at least one other item. */
  duplicates: number;
  /** Items whose rarity is anything other than common (F-13 treasure_hunter badge). */
  rareItems: number;
  topBrands: { brand: string; count: number }[];
}

export function computeStats(rows: StatRow[]): GarageStats {
  let totalQty = 0;
  let totalValue = 0;
  let rareItems = 0;
  const brandCounts = new Map<string, number>();
  const groupSizes = new Map<string, number>();

  for (const r of rows) {
    totalQty += r.qty;
    totalValue += r.price_paid;
    if (isRarerThanCommon(r.rarity)) rareItems += 1;
    brandCounts.set(r.brand, (brandCounts.get(r.brand) ?? 0) + 1);
    const key = `${r.brand}|${r.model ?? ''}|${r.variant ?? ''}`.toLowerCase();
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }

  let duplicates = 0;
  for (const size of groupSizes.values()) if (size > 1) duplicates += size;

  const topBrands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([brand, count]) => ({ brand, count }));

  return { totalItems: rows.length, totalQty, totalValue, duplicates, rareItems, topBrands };
}
