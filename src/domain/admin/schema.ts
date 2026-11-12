import { z } from 'zod';

/** /admin/invites "create codes" form (MV-S10-04, F-16). One cohort label per batch. */
export const createInvitesSchema = z.object({
  cohort: z
    .string()
    .trim()
    .min(2, 'Give the cohort a name.')
    .max(40, 'Keep the cohort name under 40 characters.')
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lower-case letters, digits and dashes (e.g. uae-shops).'),
  /** How many codes to mint in this batch. */
  count: z.coerce.number().int().min(1).max(100),
  /** Seats per code: 1 = personal code, n = a shared code for a group. */
  maxUses: z.coerce.number().int().min(1).max(500),
  /** Days until the codes stop working; empty / 0 = no expiry. */
  expiresInDays: z.coerce.number().int().min(0).max(365).optional(),
});
export type CreateInvitesInput = z.infer<typeof createInvitesSchema>;
