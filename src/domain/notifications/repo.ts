// The ONLY file in this module that talks to Supabase (D-007). RLS ("Users read/update their own
// notifications", 20261003010000_deals.sql) is the backstop — rows are written only by the
// notify_on_offer_event trigger (definer), never inserted by the client.
import type { Client } from '@/lib/supabase/types';
import type { NotificationRow } from './types';

export async function listNotifications(
  supabase: Client,
  userId: string,
  limit = 30
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function countUnread(supabase: Client, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllRead(supabase: Client, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}
