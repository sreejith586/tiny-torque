import type { Client } from '@/lib/supabase/types';
import type { PaymentProvider } from '@/lib/payments/types';
import { paymentProvider } from '@/lib/payments';
import * as repo from './repo';
import { createCheckoutSessionSchema, adminAdjustTokensSchema } from './schema';
import { SPEND_OPTION_CONFIG, type SpendOption } from './types';
import type {
  TokenPackRow,
  TokenLedgerRow,
  TokenPurchaseRow,
  EntitlementGrantRow,
  TokenLedgerReason,
} from './types';

export class TokenError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'TokenError';
  }
}

export const listActivePacks = repo.listActivePacks;
export const listLedgerForUser = repo.listLedgerForUser;
export const listPurchasesForUser = repo.listPurchasesForUser;
export const getPurchaseBySessionId = repo.getPurchaseBySessionId;

export interface CreateCheckoutSessionResult {
  url: string;
  purchase: TokenPurchaseRow;
}

/** Validates the pack, creates the Stripe (or configured provider) Checkout session, and records
 *  a `created` purchase row the webhook will later resolve to `paid`/`failed`/`refunded`. */
export async function createCheckoutSession(
  supabase: Client,
  userId: string,
  input: unknown,
  urls: { successUrl: string; cancelUrl: string },
  provider: PaymentProvider = paymentProvider
): Promise<CreateCheckoutSessionResult> {
  const { packId } = createCheckoutSessionSchema.parse(input);
  const pack: TokenPackRow | null = await repo.getPack(supabase, packId);
  if (!pack || !pack.active) throw new TokenError('pack_not_found');

  const session = await provider.createCheckoutSession({
    userId,
    pack,
    successUrl: urls.successUrl,
    cancelUrl: urls.cancelUrl,
  });

  const purchase = await repo.createPendingPurchase(supabase, {
    userId,
    packId: pack.id,
    providerSessionId: session.sessionId,
    amount: pack.price_amount,
    currency: pack.price_currency,
  });

  return { url: session.url, purchase };
}

/** Spend tokens on one of the three things they buy today (F-11) — maps the option to the right
 *  ledger reason + grant kind + PLACEHOLDER cost/duration (D-024) and calls spend_tokens (D-021). */
export async function spendOn(
  supabase: Client,
  option: SpendOption,
  opts: { refType?: string; refId?: string; idempotencyKey?: string } = {}
): Promise<EntitlementGrantRow> {
  const config = SPEND_OPTION_CONFIG[option];
  const expiresAt = config.durationDays
    ? new Date(Date.now() + config.durationDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  try {
    return await repo.spendTokens(supabase, {
      reason: config.reason,
      cost: config.cost,
      grantKind: config.grantKind,
      expiresAt,
      refType: opts.refType,
      refId: opts.refId,
      idempotencyKey: opts.idempotencyKey,
    });
  } catch (e) {
    const pgMessage = (e as { message?: string } | null)?.message ?? '';
    if (pgMessage.includes('insufficient_balance')) throw new TokenError('insufficient_balance');
    throw e;
  }
}

export async function adminAdjustTokens(supabase: Client, input: unknown): Promise<TokenLedgerRow> {
  const { userId, delta, note } = adminAdjustTokensSchema.parse(input);
  return repo.adminAdjustTokens(supabase, userId, delta, note);
}

export type {
  TokenPackRow,
  TokenLedgerRow,
  TokenPurchaseRow,
  EntitlementGrantRow,
  TokenLedgerReason,
  SpendOption,
};
export { SPEND_OPTION_CONFIG } from './types';
