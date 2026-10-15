import { z } from 'zod';

export const submitReviewSchema = z.object({
  offerId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).nullish(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
