// The ONLY file in this module that talks to Supabase (D-007). Purchases and garage creation go
// through the SECURITY DEFINER RPCs from 0013_world_rpcs (D-021 / 07 P4) — this file never
// inserts into world_garages or world_inventory, and never touches token_ledger.
import type { Client, Json, TablesUpdate } from '@/lib/supabase/types';
import type { WorldGarageRow, WorldInventoryRow, WorldItemRow, WorldLevelRow } from './types';

export async function getGarage(supabase: Client, userId: string): Promise<WorldGarageRow | null> {
  const { data, error } = await supabase
    .from('world_garages')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function listLevels(supabase: Client): Promise<WorldLevelRow[]> {
  const { data, error } = await supabase.from('world_levels').select('*').order('level');
  if (error) throw error;
  return data ?? [];
}

export async function listActiveItems(supabase: Client): Promise<WorldItemRow[]> {
  const { data, error } = await supabase
    .from('world_items')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listInventory(
  supabase: Client,
  userId: string
): Promise<WorldInventoryRow[]> {
  const { data, error } = await supabase
    .from('world_inventory')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Owner-editable columns only (name / open_mode / featured car / layout). `level` and `score`
 *  are rejected by the world_garages_guard trigger even if a caller slipped them in here. */
export async function updateGarage(
  supabase: Client,
  userId: string,
  patch: Pick<
    TablesUpdate<'world_garages'>,
    'name' | 'open_mode' | 'featured_item_id' | 'theme_item_id'
  > & {
    layout?: Json;
  }
): Promise<WorldGarageRow> {
  const { data, error } = await supabase
    .from('world_garages')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function ensureGarage(supabase: Client): Promise<WorldGarageRow> {
  const { data, error } = await supabase.rpc('ensure_world_garage');
  if (error) throw error;
  return data as unknown as WorldGarageRow;
}

export async function buyLevel(supabase: Client): Promise<WorldGarageRow> {
  const { data, error } = await supabase.rpc('buy_world_level');
  if (error) throw error;
  return data as unknown as WorldGarageRow;
}

export async function buyItem(
  supabase: Client,
  itemId: string,
  idempotencyKey?: string
): Promise<WorldInventoryRow> {
  const { data, error } = await supabase.rpc('buy_world_item', {
    p_item_id: itemId,
    p_key: idempotencyKey ?? undefined,
  });
  if (error) throw error;
  return data as unknown as WorldInventoryRow;
}
