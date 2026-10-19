'use server';

// MV-S7-04/05. A plain exported server action (not a <form action>) so the client component can
// call it directly and handle both outcomes itself — redirecting to Stripe on success, or showing
// a friendly inline error (e.g. "Stripe isn't configured yet") without throwing an error boundary.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession, TokenError } from '@/domain/tokens';

export type BuyPackResult = { ok: true; url: string } | { ok: false; error: string };

export async function buyPackAction(packId: string): Promise<BuyPackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/tokens');

  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;

  try {
    const { url } = await createCheckoutSession(
      supabase,
      user.id,
      { packId },
      {
        successUrl: `${origin}/tokens/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/tokens/cancel`,
      }
    );
    return { ok: true, url };
  } catch (err) {
    if (err instanceof TokenError && err.code === 'pack_not_found') {
      return { ok: false, error: 'That pack is no longer available.' };
    }
    // Most likely cause right now: STRIPE_SECRET_KEY is a placeholder (D-024/sandbox keys
    // pending) — surface that plainly rather than a generic failure.
    return {
      ok: false,
      error:
        err instanceof Error && err.message.includes('STRIPE_SECRET_KEY')
          ? 'Token purchases aren’t live yet — ask your admin to add real Stripe keys.'
          : 'Could not start checkout. Please try again.',
    };
  }
}
