import { z } from 'zod';
import { REPORT_REASONS } from './types';

export const createReportSchema = z.object({
  targetType: z.enum(['listing', 'user', 'message']),
  targetId: z.string().min(1),
  targetName: z.string().trim().max(120).nullish(),
  reason: z.enum(REPORT_REASONS),
  notes: z.string().trim().max(1000).nullish(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
