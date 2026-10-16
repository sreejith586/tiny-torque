// Deno unit tests for the stripe-webhook pure helpers (MV-S7-03). Offline — no network, no Stripe,
// no Supabase. Run: deno test supabase/functions/stripe-webhook/lib.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { deriveAction, paymentIntentMetadata } from './lib.ts';

Deno.test('deriveAction: a paid checkout.session.completed credits the user', () => {
  const action = deriveAction({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        payment_status: 'paid',
        metadata: { userId: 'u1', packId: 'p1' },
      },
    },
  });
  assertEquals(action, {
    kind: 'credit',
    eventId: 'evt_1',
    sessionId: 'cs_1',
    userId: 'u1',
    packId: 'p1',
  });
});

Deno.test('deriveAction: falls back to client_reference_id when metadata.userId is missing', () => {
  const action = deriveAction({
    id: 'evt_2',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_2',
        payment_status: 'paid',
        client_reference_id: 'u2',
        metadata: { packId: 'p2' },
      },
    },
  });
  assertEquals(action, {
    kind: 'credit',
    eventId: 'evt_2',
    sessionId: 'cs_2',
    userId: 'u2',
    packId: 'p2',
  });
});

Deno.test('deriveAction: an unpaid session is ignored, not credited', () => {
  const action = deriveAction({
    id: 'evt_3',
    type: 'checkout.session.completed',
    data: {
      object: { id: 'cs_3', payment_status: 'unpaid', metadata: { userId: 'u1', packId: 'p1' } },
    },
  });
  assertEquals(action.kind, 'ignored');
});

Deno.test('deriveAction: a session missing metadata is ignored, not crashed', () => {
  const action = deriveAction({
    id: 'evt_4',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_4', payment_status: 'paid' } },
  });
  assertEquals(action.kind, 'ignored');
});

Deno.test('deriveAction: charge.refunded surfaces the payment_intent for lookup', () => {
  const action = deriveAction({
    id: 'evt_5',
    type: 'charge.refunded',
    data: { object: { payment_intent: 'pi_1' } },
  });
  assertEquals(action, { kind: 'refund', eventId: 'evt_5', paymentIntentId: 'pi_1' });
});

Deno.test('deriveAction: a refund with no payment_intent is ignored', () => {
  const action = deriveAction({
    id: 'evt_6',
    type: 'charge.refunded',
    data: { object: {} },
  });
  assertEquals(action.kind, 'ignored');
});

Deno.test('deriveAction: an unhandled event type is ignored', () => {
  const action = deriveAction({ id: 'evt_7', type: 'customer.created', data: { object: {} } });
  assertEquals(action.kind, 'ignored');
});

Deno.test('paymentIntentMetadata: extracts userId/packId', () => {
  assertEquals(paymentIntentMetadata({ metadata: { userId: 'u1', packId: 'p1' } }), {
    userId: 'u1',
    packId: 'p1',
  });
});

Deno.test('paymentIntentMetadata: null when metadata is missing/incomplete', () => {
  assertEquals(paymentIntentMetadata(null), null);
  assertEquals(paymentIntentMetadata({ metadata: { userId: 'u1' } }), null);
  assertEquals(paymentIntentMetadata({}), null);
});
