import type { Tables, Enums } from '@/types/supabase';

export type TokenPackRow = Tables<'token_packs'>;
export type TokenLedgerRow = Tables<'token_ledger'>;
export type TokenPurchaseRow = Tables<'token_purchases'>;
export type EntitlementGrantRow = Tables<'entitlement_grants'>;

export type TokenLedgerReason = Enums<'token_ledger_reason'>;
export type TokenPurchaseStatus = Enums<'token_purchase_status'>;
export type EntitlementGrantKind = Enums<'entitlement_grant_kind'>;

/** The three things tokens buy today (F-11) — each maps to a spend reason + grant kind. */
export type SpendOption = 'listing_slot' | 'scan_pack' | 'pro_30d';

export const SPEND_OPTION_CONFIG: Record<
  SpendOption,
  {
    reason: TokenLedgerReason;
    grantKind: EntitlementGrantKind;
    cost: number;
    durationDays: number | null;
  }
> = {
  // Costs are the same PLACEHOLDER figures as the migration's pack prices (D-024 still open).
  listing_slot: {
    reason: 'spend_listing_slot',
    grantKind: 'listing_slot',
    cost: 20,
    durationDays: null,
  },
  scan_pack: { reason: 'spend_scan_pack', grantKind: 'scan_pack', cost: 15, durationDays: 30 },
  pro_30d: { reason: 'spend_pro_30d', grantKind: 'pro_30d', cost: 60, durationDays: 30 },
};
