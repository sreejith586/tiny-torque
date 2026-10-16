import Stripe from 'stripe';
import type { CreateCheckoutSessionInput, CheckoutSession, PaymentProvider } from './types';

// Lazy + per-call rather than a module-level singleton: STRIPE_SECRET_KEY is a placeholder today
// (D-024/sandbox keys pending, Sreejith's "look at sandbox and production API keys later") and
// may not be a real Stripe key yet. Throwing here — not at import time — keeps every other route
// that imports this module working, and surfaces a clear, specific error only when someone
// actually tries to buy tokens before real keys are configured.
function getClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set — token purchases need a real (test-mode is fine) Stripe secret key.'
    );
  }
  return new Stripe(key);
}

export const stripeProvider: PaymentProvider = {
  async createCheckoutSession({
    userId,
    pack,
    successUrl,
    cancelUrl,
  }: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    const stripe = getClient();
    // metadata on both the session and the PaymentIntent: checkout.session.completed carries the
    // session's own metadata, but charge.refunded only gives us the PaymentIntent, so the refund
    // path needs its own copy to find the purchase back (no payment_intent column in our schema,
    // per 03-data-model.md §2.15 — looking it up via Stripe's API avoids adding one).
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: pack.stripe_price_id
        ? [{ price: pack.stripe_price_id, quantity: 1 }]
        : [
            {
              price_data: {
                currency: pack.price_currency.toLowerCase(),
                product_data: { name: `${pack.tokens} Tiny Torque tokens` },
                unit_amount: Math.round(pack.price_amount * 100),
              },
              quantity: 1,
            },
          ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: { userId, packId: pack.id },
      payment_intent_data: { metadata: { userId, packId: pack.id } },
    });
    if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
    return { sessionId: session.id, url: session.url };
  },
};
