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

export const resolveReportSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(['dismiss', 'remove_listing', 'warn', 'suspend']),
  note: z.string().trim().max(500).nullish(),
});

export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
