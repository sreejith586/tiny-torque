import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getReceivedInbox, getSentInbox } from '@/domain/deals';
import { isFlagEnabled } from '@/domain/flags';
import OffersInboxView from '@/components/OffersInboxView';

// MV-S5-04, F-08: Received / Sent tabs grouped by listing. Route itself already requires a
// session (src/proxy.ts); the `offers` flag is the feature's own kill switch (D-018).
export const metadata: Metadata = {
  title: 'Deals',
};

export default async function OffersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/offers');

  const enabled = await isFlagEnabled(supabase, 'offers', { userId: user.id });
  if (!enabled) {
    return (
      <main style={{ padding: '48px 20px', flex: 1, textAlign: 'center' }}>
        <h1 className="page-heading">Deals</h1>
        <p className="muted">Coming soon — track cash offers and trade proposals here.</p>
      </main>
    );
  }

  const [received, sent] = await Promise.all([
    getReceivedInbox(supabase, user.id),
    getSentInbox(supabase, user.id),
  ]);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Deals</h1>
      <p className="page-sub">Offers you&apos;ve received and sent.</p>
      <OffersInboxView initialReceived={received} initialSent={sent} />
    </main>
  );
}
