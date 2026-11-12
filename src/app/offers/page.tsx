import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getReceivedInbox, getSentInbox } from '@/domain/deals';
import { isFlagEnabled } from '@/domain/flags';
import { listReviewedOfferIds } from '@/domain/reviews';
import OffersInboxView from '@/components/OffersInboxView';
import { FIXTURE_INBOX_RECEIVED, FIXTURE_INBOX_SENT } from '@/lib/visual-fixtures';
import { isHarnessRequest } from '@/lib/visual-harness.server';

// MV-S5-04, F-08: Received / Sent tabs grouped by listing. Route itself already requires a
// session (src/proxy.ts); the `offers` flag is the feature's own kill switch (D-018).
export const metadata: Metadata = {
  title: 'Deals',
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // D-056 fixture harness (non-production only, MV-S9-05): the inbox from fixtures, no session.
  if (await isHarnessRequest(await searchParams)) {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        <h1 className="page-heading">Deals</h1>
        <p className="page-sub">Offers you&apos;ve received and sent.</p>
        <OffersInboxView
          initialReceived={FIXTURE_INBOX_RECEIVED}
          initialSent={FIXTURE_INBOX_SENT}
          initialReviewedOfferIds={[]}
          dealChatEnabled
        />
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/offers');

  const [enabled, dealChatEnabled] = await Promise.all([
    isFlagEnabled(supabase, 'offers', { userId: user.id }),
    isFlagEnabled(supabase, 'deal_chat', { userId: user.id }),
  ]);
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
  const completedSentOfferIds = sent
    .flatMap((g) => g.offers)
    .filter((o) => o.status === 'completed')
    .map((o) => o.id);
  const reviewedOfferIds = Array.from(await listReviewedOfferIds(supabase, completedSentOfferIds));

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Deals</h1>
      <p className="page-sub">Offers you&apos;ve received and sent.</p>
      <OffersInboxView
        initialReceived={received}
        initialSent={sent}
        initialReviewedOfferIds={reviewedOfferIds}
        dealChatEnabled={dealChatEnabled}
      />
    </main>
  );
}
