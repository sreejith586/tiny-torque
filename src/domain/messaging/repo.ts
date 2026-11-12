// The ONLY file in this module that talks to Supabase (D-007). RLS on deal_messages is the real
// enforcement (party read; insert only on an accepted/completed offer by a party, not blocked;
// supabase/migrations/20261004000000_messaging_trust.sql) — this file just shapes the calls.
import type { Client } from '@/lib/supabase/types';
import type { DealMessageRow } from './types';

export async function listMessages(supabase: Client, offerId: string): Promise<DealMessageRow[]> {
  const { data, error } = await supabase
    .from('deal_messages')
    .select('*')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(
  supabase: Client,
  offerId: string,
  senderId: string,
  body: string
): Promise<DealMessageRow> {
  const { data, error } = await supabase
    .from('deal_messages')
    .insert({ offer_id: offerId, sender_id: senderId, body })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Read receipts (F-09): marks the other party's unread messages as read by the viewer. */
export async function markThreadRead(
  supabase: Client,
  offerId: string,
  viewerId: string
): Promise<void> {
  const { error } = await supabase
    .from('deal_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('offer_id', offerId)
    .neq('sender_id', viewerId)
    .is('read_at', null);
  if (error) throw error;
}

export async function isBlockedPair(supabase: Client, a: string, b: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_blocked', { p_a: a, p_b: b });
  if (error) throw error;
  return data ?? false;
}

// ---------- meetup rooms (MV-W06-04): the same thread table, kind = 'meetup' (0015) ----------
// RLS: members read; members post while the meetup is live, unless muted / blocked with the host.

export async function listRoomMessages(
  supabase: Client,
  meetupId: string,
  limit = 200
): Promise<DealMessageRow[]> {
  const { data, error } = await supabase
    .from('deal_messages')
    .select('*')
    .eq('meetup_id', meetupId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function sendRoomMessage(
  supabase: Client,
  meetupId: string,
  senderId: string,
  body: string,
  reaction: string | null = null
): Promise<DealMessageRow> {
  const { data, error } = await supabase
    .from('deal_messages')
    .insert({ kind: 'meetup', meetup_id: meetupId, sender_id: senderId, body, reaction })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
