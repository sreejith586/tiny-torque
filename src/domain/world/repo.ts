// The ONLY file in this module that talks to Supabase (D-007). Purchases and garage creation go
// through the SECURITY DEFINER RPCs from 0013_world_rpcs (D-021 / 07 P4) — this file never
// inserts into world_garages or world_inventory, and never touches token_ledger.
import type { Client, Json, TablesUpdate } from '@/lib/supabase/types';
import type {
  WorldGarageRow,
  WorldGuestbookRow,
  WorldInventoryRow,
  WorldInviteRow,
  WorldItemRow,
  WorldKudosRow,
  WorldLevelRow,
  WorldOpenGarageRow,
  WorldVisitRow,
} from './types';

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
    layout?: NonNullable<Json>;
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

/** First rename is free, later ones cost the `garage_rename` item's price (world_slots). */
export async function renameGarage(supabase: Client, name: string): Promise<WorldGarageRow> {
  const { data, error } = await supabase.rpc('rename_world_garage', { p_name: name });
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

// ---------- W03 social (MV-W03-01/02): every write is an RPC, reads go through RLS ----------

/** null when the caller is the owner (not a visit). */
export async function recordVisit(
  supabase: Client,
  garageUserId: string
): Promise<WorldVisitRow | null> {
  const { data, error } = await supabase.rpc('record_world_visit', { p_garage: garageUserId });
  if (error) throw error;
  return (data as unknown as WorldVisitRow | null) ?? null;
}

export async function giveKudos(supabase: Client, garageUserId: string): Promise<WorldKudosRow> {
  const { data, error } = await supabase.rpc('give_world_kudos', { p_garage: garageUserId });
  if (error) throw error;
  return data as unknown as WorldKudosRow;
}

export async function postGuestbook(
  supabase: Client,
  garageUserId: string,
  body: string
): Promise<WorldGuestbookRow> {
  const { data, error } = await supabase.rpc('post_world_guestbook', {
    p_garage: garageUserId,
    p_body: body,
  });
  if (error) throw error;
  return data as unknown as WorldGuestbookRow;
}

export async function hideGuestbook(
  supabase: Client,
  entryId: string,
  hidden: boolean
): Promise<WorldGuestbookRow> {
  const { data, error } = await supabase.rpc('hide_world_guestbook', {
    p_id: entryId,
    p_hidden: hidden,
  });
  if (error) throw error;
  return data as unknown as WorldGuestbookRow;
}

export async function listGuestbook(
  supabase: Client,
  garageUserId: string,
  limit = 20
): Promise<WorldGuestbookRow[]> {
  const { data, error } = await supabase
    .from('world_guestbook')
    .select('*')
    .eq('garage_user_id', garageUserId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listRecentVisits(
  supabase: Client,
  garageUserId: string,
  limit = 10
): Promise<WorldVisitRow[]> {
  const { data, error } = await supabase
    .from('world_visits')
    .select('*')
    .eq('garage_user_id', garageUserId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createInvite(
  supabase: Client,
  args: { inviteeHandle?: string; hours: number; maxUses: number }
): Promise<WorldInviteRow> {
  const { data, error } = await supabase.rpc('create_world_invite', {
    p_invitee_handle: args.inviteeHandle ?? undefined,
    p_hours: args.hours,
    p_max_uses: args.maxUses,
  });
  if (error) throw error;
  return data as unknown as WorldInviteRow;
}

export async function acceptInvite(supabase: Client, token: string): Promise<WorldInviteRow> {
  const { data, error } = await supabase.rpc('accept_world_invite', { p_token: token });
  if (error) throw error;
  return data as unknown as WorldInviteRow;
}

export async function revokeInvite(supabase: Client, inviteId: string): Promise<WorldInviteRow> {
  const { data, error } = await supabase.rpc('revoke_world_invite', { p_id: inviteId });
  if (error) throw error;
  return data as unknown as WorldInviteRow;
}

/** The host's live invites (RLS: host or invitee). */
export async function listInvites(
  supabase: Client,
  garageUserId: string
): Promise<WorldInviteRow[]> {
  const { data, error } = await supabase
    .from('world_invites')
    .select('*')
    .eq('garage_user_id', garageUserId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listOpenGarages(
  supabase: Client,
  args: { country?: string; limit: number }
): Promise<WorldOpenGarageRow[]> {
  let qb = supabase
    .from('world_open_garages')
    .select('*')
    // Spotlight (a paid 24 h consumable, 07 §2.6) floats to the top, labelled in the view
    .order('spotlight_until', { ascending: false, nullsFirst: false })
    .order('kudos_count', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(args.limit);
  if (args.country) qb = qb.eq('country_code', args.country);
  const { data, error } = await qb;
  if (error) throw error;
  return data ?? [];
}

/** Admin preview for the reports queue: guestbook rows by id (RLS: admin sees hidden lines too). */
export async function listGuestbookByIds(
  supabase: Client,
  ids: string[]
): Promise<WorldGuestbookRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('world_guestbook').select('*').in('id', ids);
  if (error) throw error;
  return data ?? [];
}
