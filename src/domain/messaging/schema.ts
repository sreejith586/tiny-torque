import { z } from 'zod';

export const sendMessageSchema = z.object({
  offerId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Meetup room (MV-W06-04): a chat line or a reaction key (the emoji is rendered client-side). */
export const roomMessageSchema = z.object({
  meetupId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});
export const roomReactionSchema = z.object({
  meetupId: z.string().uuid(),
  reaction: z.enum(['thumbs', 'fire', 'clap', 'heart', 'flag']),
});
