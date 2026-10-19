'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getPurchaseBySessionId, type TokenPurchaseRow } from '@/domain/tokens';

const POLL_MS = 2000;
const MAX_POLLS = 8;

// MV-S7-05: Stripe redirects here before the webhook necessarily lands, so this polls the
// purchase row briefly rather than assuming it's already `paid`.
export default function TokensSuccessView({
  sessionId,
  initialPurchase,
}: {
  sessionId: string;
  initialPurchase: TokenPurchaseRow | null;
}) {
  const [purchase, setPurchase] = useState(initialPurchase);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (purchase?.status === 'paid' || purchase?.status === 'failed' || polls >= MAX_POLLS) return;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const next = await getPurchaseBySessionId(supabase, sessionId).catch(() => null);
      if (next) setPurchase(next);
      setPolls((p) => p + 1);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [purchase, polls, sessionId]);

  if (!purchase) {
    return (
      <div className="panel" style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 16 }}>Purchase not found</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          We couldn’t find that checkout session.
        </p>
        <Link href="/tokens" className="btn-secondary" style={{ marginTop: 14, display: 'block' }}>
          Back to tokens
        </Link>
      </div>
    );
  }

  if (purchase.status === 'paid') {
    return (
      <div className="panel" style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 16 }}>Payment successful</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Your tokens have been credited.
        </p>
        <Link href="/tokens" className="btn-primary" style={{ marginTop: 14, display: 'block' }}>
          View balance
        </Link>
      </div>
    );
  }

  if (purchase.status === 'failed') {
    return (
      <div className="panel" style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 16 }}>Payment failed</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          No tokens were credited. You haven’t been charged.
        </p>
        <Link href="/tokens" className="btn-secondary" style={{ marginTop: 14, display: 'block' }}>
          Try again
        </Link>
      </div>
    );
  }

  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <h3 style={{ fontSize: 16 }}>Confirming your payment…</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {polls >= MAX_POLLS
          ? 'This is taking longer than usual — your tokens will appear once payment is confirmed.'
          : 'This usually takes a few seconds.'}
      </p>
      <Link href="/tokens" className="btn-secondary" style={{ marginTop: 14, display: 'block' }}>
        Back to tokens
      </Link>
    </div>
  );
}
