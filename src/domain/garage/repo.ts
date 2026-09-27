// The ONLY file in this module that talks to Supabase (D-007).
import type { Client, TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import type { CollectionItemRow } from './types';

type ItemRowRaw = Awaited<ReturnType<typeof selectOne>>;
async function selectOne(supabase: Client, itemId: string) {
  const { data, error } = await supabase.from('collection_items').select('*').eq('id', itemId).maybeSingle();
  if (error) throw error;
  return data;
}

function toRow(r: NonNullable<ItemRowRaw>): CollectionItemRow {
  return { ...r, photos: Array.isArray(r.photos) ? (r.photos as string[]) : [] };
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

export async function findMatches(
  supabase: Client,
  userId: string,
  brand: string,
  model: string | null,
  variant: string | null
): Promise<CollectionItemRow[]> {
  let q = supabase.from('collection_items').select('*').eq('owner_id', userId).is('deleted_at', null).ilike('brand', brand);
  if (model) q = q.ilike('model', model);
  if (variant) q = q.ilike('variant', variant);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toRow);
}

export async function insertMany(supabase: Client, rows: TablesInsert<'collection_items'>[]): Promise<CollectionItemRow[]> {
  const { data, error } = await supabase.from('collection_items').insert(rows).select();
  if (error) throw error;
  return (data ?? []).map(toRow);
}

export async function update(supabase: Client, itemId: string, patch: TablesUpdate<'collection_items'>) {
  const { error } = await supabase.from('collection_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

/** Hard delete for now; soft delete (deleted_at) arrives with garage v2 in S2. */
export async function remove(supabase: Client, itemId: string) {
  const { error } = await supabase.from('collection_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function uploadPhoto(supabase: Client, userId: string, file: File): Promise<string> {
  // Key MUST start with "<uid>/" — storage policy (0001) enforces the prefix.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('car-photos').upload(path, file);
  if (error) throw error;
  return supabase.storage.from('car-photos').getPublicUrl(path).data.publicUrl;
}
