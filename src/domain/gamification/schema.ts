import { z } from 'zod';

export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const;

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(3, 'Tell us a little more').max(2000, 'Keep it under 2000 characters'),
  page: z.string().trim().max(200).nullish(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

/** Shape apply_gamification expects for p_badges. */
export const badgeStateSchema = z.object({
  key: z.string().min(1),
  progress: z.number().int().min(0),
  unlocked: z.boolean(),
});

export const applyStateSchema = z.object({
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  badges: z.array(badgeStateSchema),
});
