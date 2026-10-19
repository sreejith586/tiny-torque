// The ONLY file in this module that talks to Supabase (D-007). Credits (purchase/refund/
// admin_adjust) never happen from here — the webhook (service role) and admin_adjust_tokens
// handle those. This file only reads packs/ledger/purchases and calls spend_tokens (D-021).
import type { Client } from '@/lib/supabase/types';
import type {
  TokenPackRow,
  TokenLedgerRow,
  TokenPurchaseRow,
  EntitlementGrantRow,
  TokenLedgerReason,
  EntitlementGrantKind,
} from './types';

export async function listActivePacks(supabase: Client): Promise<TokenPackRow[]> {
  const { data, error } = await supabase
    .from('token_packs')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function getPack(supabase: Client, packId: string): Promise<TokenPackRow | null> {
  const { data, error } = await supabase
    .from('token_packs')
    .select('*')
    .eq('id', packId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export interface CreatePendingPurchaseArgs {
  userId: string;
  packId: string;
  providerSessionId: string;
  amount: number;
  currency: string;
}

/** Inserted by the server action right after creating the Stripe Checkout session, before
 *  redirecting — lets the webhook find (and the success page poll) this purchase by session id. */
export async function createPendingPurchase(
  supabase: Client,
  args: CreatePendingPurchaseArgs
): Promise<TokenPurchaseRow> {
  const { data, error } = await supabase
    .from('token_purchases')
    .insert({
      user_id: args.userId,
      pack_id: args.packId,
      provider_session_id: args.providerSessionId,
      amount: args.amount,
      currency: args.currency,
      status: 'created',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getPurchaseBySessionId(
  supabase: Client,
  sessionId: string
): Promise<TokenPurchaseRow | null> {
  const { data, error } = await supabase
    .from('token_purchases')
    .select('*')
    .eq('provider_session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function listPurchasesForUser(
  supabase: Client,
  userId: string
): Promise<TokenPurchaseRow[]> {
  const { data, error } = await supabase
    .from('token_purchases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listLedgerForUser(
  supabase: Client,
  userId: string,
  limit = 50
): Promise<TokenLedgerRow[]> {
  const { data, error } = await supabase
    .from('token_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface SpendTokensArgs {
  reason: TokenLedgerReason;
  cost: number;
  grantKind: EntitlementGrantKind;
  quantity?: number;
  expiresAt?: string | null;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey?: string | null;
}

/** The only way tokens leave a balance (D-021/rule 8) — spend_tokens is SECURITY DEFINER,
 *  authenticated as the caller (auth.uid()), balance-checked atomically in the DB. */
export async function spendTokens(
  supabase: Client,
  args: SpendTokensArgs
): Promise<EntitlementGrantRow> {
  const { data, error } = await supabase.rpc('spend_tokens', {
    p_reason: args.reason,
    p_cost: args.cost,
    p_grant_kind: args.grantKind,
    p_quantity: args.quantity ?? 1,
    p_expires_at: args.expiresAt ?? undefined,
    p_ref_type: args.refType ?? undefined,
    p_ref_id: args.refId ?? undefined,
    p_key: args.idempotencyKey ?? undefined,
  });
  if (error) throw error;
  return data as unknown as EntitlementGrantRow;
}

/** Admin goodwill credit/debit (F-11) — admin_adjust_tokens checks is_admin() itself. */
export async function adminAdjustTokens(
  supabase: Client,
  userId: string,
  delta: number,
  note?: string
): Promise<TokenLedgerRow> {
  const { data, error } = await supabase.rpc('admin_adjust_tokens', {
    p_user: userId,
    p_delta: delta,
    p_note: note ?? undefined,
  });
  if (error) throw error;
  return data as unknown as TokenLedgerRow;
}
