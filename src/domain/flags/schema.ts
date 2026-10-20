import { z } from 'zod';
import { FLAG_KEYS } from './types';

/** F-16 "Flags (toggle + audience JSON with validation)": the audience shape the evaluator
 *  understands, nothing else — a typo'd key is rejected rather than silently ignored. */
export const flagAudienceSchema = z
  .object({
    plans: z
      .array(z.enum(['free', 'pro']))
      .max(2)
      .optional(),
    countries: z.array(z.string().trim().toUpperCase().length(2)).max(50).optional(),
    user_ids: z.array(z.string().uuid()).max(500).optional(),
    percent: z.number().int().min(0).max(100).optional(),
  })
  .strict();

export const updateFlagSchema = z.object({
  key: z.enum(FLAG_KEYS),
  enabled: z.boolean(),
  audience: flagAudienceSchema,
});
export type UpdateFlagInput = z.infer<typeof updateFlagSchema>;
