import type { TokenPackRow } from '@/domain/tokens/types';

export interface CreateCheckoutSessionInput {
  userId: string;
  pack: TokenPackRow;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** The provider's own session id — stored on token_purchases.provider_session_id so the
   *  webhook (and the success-page poll) can find this purchase again. */
  sessionId: string;
  /** Where to redirect the browser to pay. */
  url: string;
}

// D-011: Stripe Checkout behind this interface; Razorpay/UPI only if India conversion is poor.
export interface PaymentProvider {
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;
}
