// Trust & safety service (MV-S6-05, F-15). Components/routes import from here, never from repo.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { createReportSchema } from './schema';

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

export const blockUser = repo.blockUser;
