// The ONLY file in this module that talks to Supabase (D-007).
import type { Client, Json } from '@/lib/supabase/types';
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

// ---------- car specs (F-25 racing input, MV-W08-prep) ----------
// Specs change ONLY through the two SECURITY DEFINER RPCs from 0022_catalog_specs (D-021
// pattern; a guard trigger refuses direct writes to the specs columns, even for admins).

export type CatalogSpecsColumns = Pick<
  CatalogModelRow,
  'id' | 'specs' | 'specs_source' | 'specs_proposed_by' | 'specs_verified_by' | 'specs_verified_at'
>;

export async function getSpecsRow(
  supabase: Client,
  modelId: string
): Promise<CatalogSpecsColumns | null> {
  const { data, error } = await supabase
    .from('catalog_models')
    .select('id, specs, specs_source, specs_proposed_by, specs_verified_by, specs_verified_at')
    .eq('id', modelId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Models whose specs are a pending proposal (something set, not yet verified) — admin queue. */
export async function listModelsWithProposedSpecs(supabase: Client): Promise<CatalogModelRow[]> {
  const { data, error } = await supabase
    .from('catalog_models')
    .select('*')
    .neq('specs', '{}')
    .is('specs_verified_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function proposeSpecs(
  supabase: Client,
  modelId: string,
  specs: Json,
  source?: string
): Promise<CatalogModelRow> {
  const { data, error } = await supabase.rpc('propose_catalog_specs', {
    p_model_id: modelId,
    p_specs: specs,
    p_source: source ?? undefined,
  });
  if (error) throw error;
  return data as unknown as CatalogModelRow;
}

export async function verifySpecs(
  supabase: Client,
  modelId: string,
  specs: Json,
  source?: string
): Promise<CatalogModelRow> {
  const { data, error } = await supabase.rpc('verify_catalog_specs', {
    p_model_id: modelId,
    p_specs: specs,
    p_source: source ?? undefined,
  });
  if (error) throw error;
  return data as unknown as CatalogModelRow;
}
