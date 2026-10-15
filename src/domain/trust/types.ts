import type { Tables } from '@/lib/supabase/types';

export type ReportRow = Tables<'reports'>;
export type BlockRow = Tables<'blocks'>;

export type ReportTargetType = 'listing' | 'user' | 'message';

export type AdminReportAction = 'dismiss' | 'remove_listing' | 'warn' | 'suspend';

export const REPORT_REASONS = [
  'scam_or_fraud',
  'inappropriate_content',
  'harassment',
  'spam',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  scam_or_fraud: 'Scam or fraud',
  inappropriate_content: 'Inappropriate content',
  harassment: 'Harassment or abuse',
  spam: 'Spam',
  other: 'Other',
};
