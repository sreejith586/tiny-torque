// Mini Vault — stripe-webhook Edge Function (F-11, MV-S7-03).
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
//   (--no-verify-jwt: Stripe calls this directly, with no Supabase auth header at all — the
//   Stripe signature below is the real auth check, not Supabase's.)
// Secrets (set once):
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// Stripe dashboard: point the webhook endpoint at this function's URL, subscribed to
// checkout.session.completed and charge.refunded.
//
// Flow: verify the Stripe signature (constructEventAsync — Deno has no Node crypto, Stripe's
// async verifier uses SubtleCrypto instead) -> derive what to do (lib.ts, pure) -> for a credit,
// look up the pending purchase by provider_session_id, credit_tokens (idempotent on event.id),
// mark the purchase paid; for a refund, retrieve the PaymentIntent to recover which purchase it
// was (our schema has no payment_intent column, §2.15), credit a negative delta, mark refunded.
// Every write is service-role (bypasses RLS, D-021: webhook is one of the two sanctioned paths a
// balance ever changes) — never exposed to the browser, never imported into the Next.js app (D-014).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno';
import { deriveAction, paymentIntentMetadata } from './lib.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!SUPABASE_URL || !SERVICE_KEY)
    return json({ error: 'Server is misconfigured (missing Supabase env).' }, 500);
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET)
    return json({ error: 'Server is missing Stripe secrets.' }, 500);

  const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ---------- 1. verify the signature (the real auth for this endpoint) ----------
  const signature = req.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing stripe-signature header.' }, 400);
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return json(
      {
        error: 'Signature verification failed.',
        detail: err instanceof Error ? err.message : String(err),
      },
      400
    );
  }

  // ---------- 2. decide what to do (pure) ----------
  const action = deriveAction(event);

  if (action.kind === 'ignored') {
    // Not an error — plenty of subscribed/unsubscribed event types are expected to no-op here.
    return json({ received: true, ignored: action.reason });
  }

  if (action.kind === 'credit') {
    const { data: purchase, error: purchaseErr } = await admin
      .from('token_purchases')
      .select('id, pack_id, status, token_packs(tokens)')
      .eq('provider_session_id', action.sessionId)
      .maybeSingle();
    if (purchaseErr) return json({ error: 'Could not look up the purchase.' }, 500);
    if (!purchase) {
      // The purchase row is created by the server action right before redirecting to Stripe — if
      // Stripe's webhook somehow beats that insert, a retry shortly after will find it.
      return json({ error: 'Purchase not found yet for this session.' }, 404);
    }
    if (purchase.status === 'paid') return json({ received: true, already_paid: true });

    const tokens = (purchase as unknown as { token_packs: { tokens: number } }).token_packs.tokens;
    const { data: ledger, error: creditErr } = await admin.rpc('credit_tokens', {
      p_user: action.userId,
      p_delta: tokens,
      p_reason: 'purchase',
      p_ref_type: 'token_purchase',
      p_ref_id: purchase.id,
      p_key: action.eventId,
    });
    if (creditErr)
      return json({ error: 'Could not credit tokens.', detail: creditErr.message }, 500);

    await admin
      .from('token_purchases')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        provider_event_id: action.eventId,
        ledger_id: (ledger as { id: string }).id,
      })
      .eq('id', purchase.id);

    return json({ received: true, credited: tokens });
  }

  // action.kind === 'refund'
  const paymentIntent = await stripe.paymentIntents.retrieve(action.paymentIntentId);
  const metadata = paymentIntentMetadata(paymentIntent);
  if (!metadata)
    return json({ error: 'Refunded PaymentIntent has no userId/packId metadata.' }, 422);

  const { data: purchase, error: purchaseErr } = await admin
    .from('token_purchases')
    .select('id, status, token_packs(tokens)')
    .eq('user_id', metadata.userId)
    .eq('pack_id', metadata.packId)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (purchaseErr) return json({ error: 'Could not look up the purchase to refund.' }, 500);
  if (!purchase) return json({ error: 'No paid purchase found to refund.' }, 404);

  const tokens = (purchase as unknown as { token_packs: { tokens: number } }).token_packs.tokens;
  const { error: refundErr } = await admin.rpc('credit_tokens', {
    p_user: metadata.userId,
    p_delta: -tokens,
    p_reason: 'refund',
    p_ref_type: 'token_purchase',
    p_ref_id: purchase.id,
    p_key: action.eventId,
  });
  // Entitlements already spent from this balance are NOT clawed back (policy stated in T&Cs) —
  // a refund can legitimately take the cached balance negative if it's all been spent since;
  // credit_tokens' balance check only blocks a negative result for spend_tokens, not refunds.
  if (refundErr)
    return json({ error: 'Could not record the refund.', detail: refundErr.message }, 500);

  await admin.from('token_purchases').update({ status: 'refunded' }).eq('id', purchase.id);

  return json({ received: true, refunded: tokens });
});
