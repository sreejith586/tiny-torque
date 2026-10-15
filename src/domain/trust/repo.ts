// The ONLY file in this module that talks to Supabase (D-007). Reports go through the
// create_report RPC (rate limit, D-021-style atomic check); blocks are a plain table — its own
// RLS ("Users manage their own blocks", blocker_id = auth.uid()) is the backstop.
import type { Client } from '@/lib/supabase/types';
import type { AdminReportAction, ReportRow, ReportReason, ReportTargetType } from './types';

export async function createReport(
  supabase: Client,
  targetType: ReportTargetType,
  targetId: string,
  targetName: string | null,
  reason: ReportReason,
  notes: string | null
): Promise<ReportRow> {
  const { data, error } = await supabase.rpc('create_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_target_name: targetName ?? undefined,
    p_reason: reason,
    p_notes: notes ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ReportRow;
}

export async function blockUser(
  supabase: Client,
  blockerId: string,
  blockedId: string
): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

/** Admin-only (RLS: "Admins can read all reports"). */
export async function listOpenReports(supabase: Client): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function resolveReport(
  supabase: Client,
  reportId: string,
  action: AdminReportAction,
  note: string | null
): Promise<ReportRow> {
  const { data, error } = await supabase.rpc('resolve_report', {
    p_report_id: reportId,
    p_action: action,
    p_resolution_note: note ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ReportRow;
}
