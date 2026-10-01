// The ONLY file in this module that talks to Supabase (D-007).
import type { Client, TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import type { CollectionItemRow } from './types';
import {
  SORT_CONFIG,
  GARAGE_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  keysetFilter,
  type GarageQuery,
  type StatRow,
} from './query';

type ItemRowRaw = Awaited<ReturnType<typeof selectOne>>;
async function selectOne(supabase: Client, itemId: string) {
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Images live in `media` now (D-010); the legacy photo/photos columns remain on the row until
// their drop (2nd release, D-006) but the app no longer reads or writes them.
function toRow(r: NonNullable<ItemRowRaw>): CollectionItemRow {
  return r as CollectionItemRow;
}

export async function listByOwner(supabase: Client, userId: string): Promise<CollectionItemRow[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRow);
}

export async function getById(supabase: Client, itemId: string): Promise<CollectionItemRow | null> {
  const r = await selectOne(supabase, itemId);
  return r ? toRow(r) : null;
}

// F-14: /u/{handle}'s public collection grid — RLS already scopes collection_items SELECT to
// `is_public = true or owner_id = auth.uid()`, so filtering is_public here is belt-and-braces,
// not the security boundary.
export async function listPublicByOwner(
  supabase: Client,
  ownerId: string
): Promise<CollectionItemRow[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_public', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRow);
}

export async function findMatches(
  supabase: Client,
  userId: string,
  brand: string,
  model: string | null,
  variant: string | null
): Promise<CollectionItemRow[]> {
  let q = supabase
    .from('collection_items')
    .select('*')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .ilike('brand', brand);
  if (model) q = q.ilike('model', model);
  if (variant) q = q.ilike('variant', variant);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toRow);
}

export async function insertMany(
  supabase: Client,
  rows: TablesInsert<'collection_items'>[]
): Promise<CollectionItemRow[]> {
  const { data, error } = await supabase.from('collection_items').insert(rows).select();
  if (error) throw error;
  return (data ?? []).map(toRow);
}

export async function update(
  supabase: Client,
  itemId: string,
  patch: TablesUpdate<'collection_items'>
) {
  const { error } = await supabase.from('collection_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

/** Hard delete for now; soft delete (deleted_at) arrives with garage v2 in S2. */
export async function remove(supabase: Client, itemId: string) {
  const { error } = await supabase.from('collection_items').delete().eq('id', itemId);
  if (error) throw error;
}

// ---------- server-side list (filters / sort / keyset cursor), stats, trash (MV-S2-04) ----------

export async function listPage(
  supabase: Client,
  userId: string,
  query: GarageQuery
): Promise<{ items: CollectionItemRow[]; nextCursor: string | null }> {
  const sort = SORT_CONFIG[query.sort ?? 'newest'];
  const limit = query.limit ?? GARAGE_PAGE_SIZE;

  let qb = supabase
    .from('collection_items')
    .select('*')
    .eq('owner_id', userId)
    .is('deleted_at', null);

  if (query.q) qb = qb.textSearch('search', query.q, { type: 'websearch', config: 'simple' });
  if (query.brand) qb = qb.eq('brand', query.brand);
  if (query.rarity) qb = qb.eq('rarity', query.rarity);
  if (query.condition) qb = qb.eq('condition', query.condition);
  if (query.isPublic !== undefined) qb = qb.eq('is_public', query.isPublic);
  if (query.isFavorite !== undefined) qb = qb.eq('is_favorite', query.isFavorite);
  if (query.forSale !== undefined) qb = qb.eq('for_sale', query.forSale);

  if (query.cursor) {
    const c = decodeCursor(query.cursor);
    if (c) qb = qb.or(keysetFilter(sort.column, sort.ascending, c));
  }

  qb = qb
    .order(sort.column, { ascending: sort.ascending })
    .order('id', { ascending: sort.ascending })
    .limit(limit + 1);

  const { data, error } = await qb;
  if (error) throw error;

  const rows = (data ?? []).map(toRow);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          value: (last as unknown as Record<string, string | number>)[sort.column]!,
          id: last.id,
        })
      : null;
  return { items, nextCursor };
}

export async function statRows(supabase: Client, userId: string): Promise<StatRow[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('brand, model, variant, qty, price_paid')
    .eq('owner_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []) as StatRow[];
}

export async function softDelete(supabase: Client, itemId: string) {
  const { error } = await supabase
    .from('collection_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw error;
}

export async function restore(supabase: Client, itemId: string) {
  const { error } = await supabase
    .from('collection_items')
    .update({ deleted_at: null })
    .eq('id', itemId);
  if (error) throw error;
}

export async function listTrash(supabase: Client, userId: string): Promise<CollectionItemRow[]> {
  const { data, error } = await supabase
    .from('collection_items')
    .select('*')
    .eq('owner_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRow);
}
