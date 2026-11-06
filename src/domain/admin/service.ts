// Admin console service (MV-S6-07, F-16). Components/routes import from here, never from repo.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import type { EconomyWeeklyRow, EconomyWeekRatios } from './types';

export async function searchUsers(supabase: Client, query: string, limit = 20) {
  return repo.searchUsers(supabase, query.trim(), limit);
}

export const setSuspension = repo.setSuspension;

// ---------- Collectors World economy dashboard + earn freeze (MV-W05-05/06, F-28) ----------
export const listEarnFreezes = repo.listEarnFreezes;
export const getEconomyWeekly = repo.getEconomyWeekly;
export const getEconomySummary = repo.getEconomySummary;

/** Freeze / unfreeze one user's earning (admin RPC; the audit event is written in the DB). */
export async function setEarnFreeze(
  supabase: Client,
  userId: string,
  frozen: boolean,
  note?: string | null
): Promise<boolean> {
  const trimmed = note?.trim() || null;
  if (trimmed && trimmed.length > 280) throw new Error('note_too_long');
  return repo.setEarnFreeze(supabase, userId, frozen, trimmed);
}

/** 07 §3.4 ratios from one weekly row. Pure; null where the denominator is 0 so a table can show
 *  "—" instead of a fake 0 or ∞. */
export function economyWeekRatios(row: EconomyWeeklyRow): EconomyWeekRatios {
  return {
    sinksOverSources: row.earned > 0 ? round2(row.spent / row.earned) : null,
    earnedShareOfSpend: row.spent > 0 ? round2(row.spent_from_earned / row.spent) : null,
    worldShareOfSpend: row.spent > 0 ? round2(row.world_spent / row.spent) : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type {
  EarnFreezeRow,
  EconomyWeeklyRow,
  EconomySummaryRow,
  EconomyWeekRatios,
} from './types';
