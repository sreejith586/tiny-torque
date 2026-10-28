// Trust & safety service (MV-S6-05/07, F-15/F-16). Components/routes import from here, never
// from repo.
import type { Client } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import * as repo from './repo';
import { createReportSchema, resolveReportSchema } from './schema';

export class ReportError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'ReportError';
  }
}

function toReportError(e: unknown): never {
  const msg = (e as { message?: string } | null)?.message;
  throw new ReportError(msg && msg.length ? msg : 'report_failed');
}

export async function submitReport(supabase: Client, input: unknown) {
  const { targetType, targetId, targetName, reason, notes } = createReportSchema.parse(input);
  try {
    return await repo.createReport(
      supabase,
      targetType,
      targetId,
      targetName ?? null,
      reason,
      notes ?? null
    );
  } catch (e) {
    toReportError(e);
  }
}

/** Block + emit `user.blocked` (F-15 Events; the row insert itself never emitted one). */
export async function blockUser(supabase: Client, blockerId: string, blockedId: string) {
  await repo.blockUser(supabase, blockerId, blockedId);
  await emitEvent(supabase, {
    actorId: blockerId,
    type: 'user.blocked',
    entity: 'profile',
    entityId: blockedId,
  });
}

/** Settings › blocked users › Unblock (F-14, MV-S8-05). */
export async function unblockUser(supabase: Client, blockerId: string, blockedId: string) {
  await repo.unblockUser(supabase, blockerId, blockedId);
  await emitEvent(supabase, {
    actorId: blockerId,
    type: 'user.unblocked',
    entity: 'profile',
    entityId: blockedId,
  });
}

export const listBlockedUsers = repo.listBlockedUsers;
export const listOpenReports = repo.listOpenReports;

export async function resolveReport(supabase: Client, input: unknown) {
  const { reportId, action, note } = resolveReportSchema.parse(input);
  try {
    return await repo.resolveReport(supabase, reportId, action, note ?? null);
  } catch (e) {
    toReportError(e);
  }
}
