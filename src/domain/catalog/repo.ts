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
