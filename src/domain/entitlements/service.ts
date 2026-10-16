// Entitlements — the ONLY place the app asks "what can this plan do" (D-003/D-021). DB
// triggers/RPCs are the backstop. Fills out in S7 (token economy): Pro is no longer a flat
// `plan` value, it's derived from `pro_until` (03-data-model.md §2 "pro is derived:
// pro_until > now()"), same as the already-shipped `public_profiles.is_pro` and the DB's
// own `is_pro()` function this sprint updates to match.
import type { Plan } from '@/types/database';

export function isProActive(profile: { plan: Plan; pro_until: string | null }): boolean {
  return (
    profile.plan === 'pro' || (!!profile.pro_until && new Date(profile.pro_until) > new Date())
  );
}

export function photoLimit(isPro: boolean): number {
  return isPro ? 8 : 1;
}

export { scanQuotaRemaining as scanQuota, listingSlots, isPro } from './repo';
