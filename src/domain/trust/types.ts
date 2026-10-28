import type { Tables } from '@/lib/supabase/types';

export type ReportRow = Tables<'reports'>;
export type BlockRow = Tables<'blocks'>;
/** One row of the blocked_users() RPC (settings › blocked users, F-14). */
export interface BlockedUser {
  blocked_id: string;
  display_name: string;
  handle: string;
  created_at: string;
}

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
