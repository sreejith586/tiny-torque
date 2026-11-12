// Deal chat service (MV-S6-02, F-09). Components/routes import from here, never from repo.
// Every mutation emits a domain_events row (rule 9) — for sendMessage this happens via a real DB
// trigger on deal_messages (20261013020000_notifications_v2.sql), not a second app-level RPC call,
// so it can't drift out of sync with the insert it's supposed to accompany. The DB RLS (party,
// live deal, not blocked) is the real backstop either way — this only decides what the UI shows
// ahead of a round trip.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { roomMessageSchema, roomReactionSchema, sendMessageSchema } from './schema';

export async function sendMessage(supabase: Client, senderId: string, input: unknown) {
  const { offerId, body } = sendMessageSchema.parse(input);
  return repo.sendMessage(supabase, offerId, senderId, body);
}

export const listMessages = repo.listMessages;
export const markThreadRead = repo.markThreadRead;
export const isBlockedPair = repo.isBlockedPair;

// ---------- meetup rooms (MV-W06-04, F-23): same table, same Realtime channel pattern ----------
// message.sent (entity meetup) comes from the same deal_messages trigger; no notification fan-out for
// room lines (0015). RLS is the gate: members only, live only, not muted.

export const listRoomMessages = repo.listRoomMessages;

export async function sendRoomMessage(supabase: Client, senderId: string, input: unknown) {
  const { meetupId, body } = roomMessageSchema.parse(input);
  return repo.sendRoomMessage(supabase, meetupId, senderId, body, null);
}

export async function sendRoomReaction(supabase: Client, senderId: string, input: unknown) {
  const { meetupId, reaction } = roomReactionSchema.parse(input);
  return repo.sendRoomMessage(supabase, meetupId, senderId, reaction, reaction);
}
