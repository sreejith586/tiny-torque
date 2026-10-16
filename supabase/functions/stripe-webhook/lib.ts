// Mini Vault — stripe-webhook pure helpers (F-11, MV-S7-03).
//
// Everything in this file is network-free and side-effect-free so it can be unit-tested with Deno
// offline (see lib.test.ts), same split as ai-scan/lib.ts. Signature verification, the actual
// Supabase writes, and the Stripe PaymentIntent lookup (needed for refunds — see below) live in
// index.ts.

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface CreditAction {
  kind: 'credit';
  eventId: string;
  sessionId: string;
  userId: string;
  packId: string;
}

export interface RefundAction {
  kind: 'refund';
  eventId: string;
  /** charge.refunded only gives us the PaymentIntent, not our own session/purchase id — index.ts
   *  retrieves the PaymentIntent to read back the userId/packId metadata set at Checkout-session
   *  creation time (payment_intent_data.metadata in src/lib/payments/stripe.ts), since our schema
   *  has no payment_intent column (03-data-model.md §2.15 lists only provider_session_id). */
  paymentIntentId: string;
}

export interface IgnoredAction {
  kind: 'ignored';
  reason: string;
}

export type WebhookAction = CreditAction | RefundAction | IgnoredAction;

/** Decides what a verified Stripe event should do, without touching the network or the DB. */
export function deriveAction(event: StripeEventLike): WebhookAction {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id?: string;
      client_reference_id?: string;
      metadata?: Record<string, string>;
      payment_status?: string;
    };
    if (session.payment_status !== 'paid') {
      return { kind: 'ignored', reason: `session payment_status is ${session.payment_status}` };
    }
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const packId = session.metadata?.packId;
    if (!userId || !packId || !session.id) {
      return { kind: 'ignored', reason: 'session missing userId/packId metadata' };
    }
    return { kind: 'credit', eventId: event.id, sessionId: session.id, userId, packId };
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as { payment_intent?: string | null };
    if (!charge.payment_intent) {
      return { kind: 'ignored', reason: 'refunded charge has no payment_intent' };
    }
    return { kind: 'refund', eventId: event.id, paymentIntentId: charge.payment_intent };
  }

  return { kind: 'ignored', reason: `unhandled event type ${event.type}` };
}

/** Pulls userId/packId back out of a PaymentIntent's metadata (set at session-creation time). */
export function paymentIntentMetadata(
  paymentIntent: { metadata?: Record<string, string> } | null | undefined
): { userId: string; packId: string } | null {
  const userId = paymentIntent?.metadata?.userId;
  const packId = paymentIntent?.metadata?.packId;
  if (!userId || !packId) return null;
  return { userId, packId };
}
