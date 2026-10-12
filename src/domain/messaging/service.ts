// Deal chat service (MV-S6-02, F-09). Components/routes import from here, never from repo.
// Every mutation emits a domain_events row (rule 9); the DB RLS (party, live deal, not blocked)
// is the real backstop — this only decides what the UI shows ahead of a round trip.
import type { Client } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import * as repo from './repo';
import { sendMessageSchema } from './schema';

export async function sendMessage(supabase: Client, senderId: string, input: unknown) {
  const { offerId, body } = sendMessageSchema.parse(input);
  const message = await repo.sendMessage(supabase, offerId, senderId, body);
  await emitEvent(supabase, {
    actorId: senderId,
    type: 'message.sent',
    entity: 'offer',
    entityId: offerId,
  });
  return message;
}

export const listMessages = repo.listMessages;
export const markThreadRead = repo.markThreadRead;
export const isBlockedPair = repo.isBlockedPair;
