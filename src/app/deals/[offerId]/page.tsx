import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOffer } from '@/domain/deals';
import { getListing } from '@/domain/marketplace';
import { getPublicProfileById } from '@/domain/identity';
import { isFlagEnabled } from '@/domain/flags';
import { listMessages, markThreadRead, isBlockedPair } from '@/domain/messaging';
import DealThreadView from '@/components/DealThreadView';

export const metadata: Metadata = {
  title: 'Deal chat',
};

export default async function DealThreadPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const offer = await getOffer(supabase, offerId);
  if (!offer || (offer.buyer_id !== user.id && offer.seller_id !== user.id)) notFound();

  const chatEnabled = await isFlagEnabled(supabase, 'deal_chat', { userId: user.id });
  if (!chatEnabled) {
    return (
      <main style={{ padding: '48px 20px', flex: 1, textAlign: 'center' }}>
        <h1 className="page-heading">Deal chat</h1>
        <p className="muted">Coming soon — message the other side of a deal here.</p>
      </main>
    );
  }

  const counterpartId = offer.buyer_id === user.id ? offer.seller_id : offer.buyer_id;
  const [listing, counterpart, blocked, messages] = await Promise.all([
    getListing(supabase, offer.listing_id),
    getPublicProfileById(supabase, counterpartId),
    isBlockedPair(supabase, offer.buyer_id, offer.seller_id),
    listMessages(supabase, offerId),
  ]);
  await markThreadRead(supabase, offerId, user.id);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">
        {listing ? `${listing.brand} ${listing.model ?? ''}`.trim() : 'Deal chat'}
      </h1>
      <p className="page-sub">
        {counterpart?.store_name || counterpart?.display_name || 'Deal chat'}
      </p>
      <DealThreadView
        offerId={offerId}
        offerStatus={offer.status}
        viewerId={user.id}
        blocked={blocked}
        initialMessages={messages}
      />
    </main>
  );
}
