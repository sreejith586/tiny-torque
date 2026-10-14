// Deal chat service (MV-S6-02, F-09). Components/routes import from here, never from repo.
// Every mutation emits a domain_events row (rule 9) — for sendMessage this happens via a real DB
// trigger on deal_messages (20261013020000_notifications_v2.sql), not a second app-level RPC call,
// so it can't drift out of sync with the insert it's supposed to accompany. The DB RLS (party,
// live deal, not blocked) is the real backstop either way — this only decides what the UI shows
// ahead of a round trip.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { sendMessageSchema } from './schema';

export async function sendMessage(supabase: Client, senderId: string, input: unknown) {
  const { offerId, body } = sendMessageSchema.parse(input);
  return repo.sendMessage(supabase, offerId, senderId, body);
}

export const listMessages = repo.listMessages;
export const markThreadRead = repo.markThreadRead;
export const isBlockedPair = repo.isBlockedPair;
