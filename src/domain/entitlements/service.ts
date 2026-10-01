// Entitlements — the ONLY place the app asks "what can this plan do" (D-003/D-021). DB
// triggers/RPCs are the backstop. Starts minimal (photo limit, F-02); fills out in S7.
import type { Plan } from '@/types/database';

export const PHOTO_LIMITS: Record<Plan, number> = {
  free: 1,
  pro: 8,
};

export function photoLimit(plan: Plan): number {
  return PHOTO_LIMITS[plan] ?? 1;
}
