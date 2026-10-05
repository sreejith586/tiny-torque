// The ONLY file in this module that talks to Supabase (D-007).
import type { Client } from '@/lib/supabase/types';
import type { CatalogBrandRow, CatalogModelRow } from './types';

export async function listVerifiedBrands(supabase: Client): Promise<CatalogBrandRow[]> {
  const { data, error } = await supabase
    .from('catalog_brands')
    .select('*')
    .eq('status', 'verified')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function searchModels(
  supabase: Client,
  q: string,
  brandId?: string,
  limit = 20
): Promise<CatalogModelRow[]> {
  let qb = supabase.from('catalog_models').select('*').eq('status', 'verified');
  if (q.trim()) qb = qb.textSearch('search', q, { type: 'websearch', config: 'simple' });
  if (brandId) qb = qb.eq('brand_id', brandId);
  const { data, error } = await qb.limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getModelById(supabase: Client, id: string): Promise<CatalogModelRow | null> {
  const { data, error } = await supabase
    .from('catalog_models')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAllBrands(supabase: Client): Promise<CatalogBrandRow[]> {
  const { data, error } = await supabase
    .from('catalog_brands')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listProposedModels(supabase: Client): Promise<CatalogModelRow[]> {
  const { data, error } = await supabase
    .from('catalog_models')
    .select('*')
    .eq('status', 'proposed')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function verifyModel(supabase: Client, id: string, verifierId: string) {
  const { error } = await supabase
    .from('catalog_models')
    .update({ status: 'verified', verified_by: verifierId })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectModel(supabase: Client, id: string) {
  const { error } = await supabase.from('catalog_models').delete().eq('id', id);
  if (error) throw error;
}
