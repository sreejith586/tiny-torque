import { z } from 'zod';

export const createCheckoutSessionSchema = z.object({
  packId: z.string().uuid(),
});
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

export const adminAdjustTokensSchema = z.object({
  userId: z.string().uuid(),
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, 'delta cannot be zero'),
  note: z.string().trim().min(1).max(280).optional(),
});
export type AdminAdjustTokensInput = z.infer<typeof adminAdjustTokensSchema>;
