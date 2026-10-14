'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  acceptOffer,
  declineOffer,
  withdrawOffer,
  completeOffer,
  cancelOffer,
  allowedActions,
  OfferError,
  type InboxGroup,
  type InboxOffer,
  type OfferAction,
} from '@/domain/deals';
import { submitReview, ReviewError } from '@/domain/reviews';
import MediaImage from './MediaImage';

type Tab = 'received' | 'sent';

const ACTION_LABEL: Record<OfferAction, string> = {
  accept: 'Accept',
  decline: 'Decline',
  withdraw: 'Withdraw offer',
  complete: 'Mark sold',
  cancel: 'Release',
};

const ACTION_CONFIRM: Record<OfferAction, string> = {
  accept: 'Accept this offer? The listing will be reserved and any other pending offers declined.',
  decline: 'Decline this offer?',
  withdraw: 'Withdraw your offer?',
  complete: 'Mark this listing as sold to this buyer? This cannot be undone.',
  cancel: 'Release this deal? The listing goes back to active and can receive new offers.',
};

// transition_offer's raise messages (20261003010000_deals.sql / 20261012000100_offer_decline_reason.sql)
const TRANSITION_ERROR_LABEL: Record<string, string> = {
  offer_not_found: 'This offer no longer exists.',
  not_authorized: "You can't do that on this offer.",
  invalid_transition: 'This offer already changed — reload to see its current status.',
  listing_not_available: 'This listing is no longer available.',
};

const REVIEW_ERROR_LABEL: Record<string, string> = {
  already_reviewed: "You've already reviewed this deal.",
  not_allowed: 'This deal is not eligible for a review.',
};

function offerSummary(offer: InboxOffer): string {
  if (offer.type === 'cash')
    return `Cash offer of ${offer.currency ?? ''} ${offer.amount ?? ''}`.trim();
  if (offer.type === 'buy_now')
    return `Bought now at ${offer.currency ?? ''} ${offer.amount ?? ''}`.trim();
  const n = offer.trade_item_ids.length;
  const topUp = offer.amount ? ` + ${offer.currency ?? ''} ${offer.amount} cash` : '';
  return `Trade offer: ${n} item${n === 1 ? '' : 's'}${topUp}`;
}

function statusLabel(offer: InboxOffer): string {
  if (offer.status === 'declined' && offer.decline_reason === 'auto_declined') {
    return 'declined (another offer was accepted)';
  }
  return offer.status;
}

function ReviewPrompt({
  offer,
  sellerName,
  onSubmitted,
}: {
  offer: InboxOffer;
  sellerName: string;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="btn-secondary"
        style={{ width: 'auto', padding: '8px 10px', fontSize: 12, marginTop: 10 }}
        onClick={() => setOpen(true)}
      >
        Leave a review
      </button>
    );
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      await submitReview(supabase, offer.seller_id, offer.buyer_id, {
        offerId: offer.id,
        rating,
        comment: comment.trim() || undefined,
      });
      onSubmitted();
    } catch (err) {
      setError(
        err instanceof ReviewError
          ? (REVIEW_ERROR_LABEL[err.code] ?? 'Could not submit that review.')
          : 'Could not submit that review.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 10, background: 'var(--panel-alt)' }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Review {sellerName}</p>
      <label htmlFor={`rating-${offer.id}`}>Rating</label>
      <select
        id={`rating-${offer.id}`}
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        disabled={busy}
      >
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} star{n === 1 ? '' : 's'}
          </option>
        ))}
      </select>
      <label htmlFor={`comment-${offer.id}`}>Comment (optional)</label>
      <textarea
        id={`comment-${offer.id}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        disabled={busy}
        style={{ minHeight: 60, resize: 'none' }}
      />
      {error && <p className="field-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
          onClick={handleSubmit}
          disabled={busy}
        >
          {busy ? '…' : 'Submit review'}
        </button>
      </div>
    </div>
  );
}

function OfferRowCard({
  offer,
  viewer,
  counterpartyLabel,
  sellerName,
  reviewed,
  onReviewSubmitted,
}: {
  offer: InboxOffer;
  viewer: 'buyer' | 'seller';
  counterpartyLabel: string;
  sellerName?: string;
  reviewed?: boolean;
  onReviewSubmitted?: (offerId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions = allowedActions(offer.status, viewer);

  async function run(action: OfferAction) {
    if (!window.confirm(ACTION_CONFIRM[action])) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const fn = {
        accept: acceptOffer,
        decline: declineOffer,
        withdraw: withdrawOffer,
        complete: completeOffer,
        cancel: cancelOffer,
      }[action];
      await fn(supabase, offer.id);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof OfferError
          ? (TRANSITION_ERROR_LABEL[err.code] ?? 'Could not update this offer.')
          : 'Could not update this offer.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13 }}>{counterpartyLabel}</span>
        <span className={`status-pill status-${offer.status}`}>{statusLabel(offer)}</span>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
        {offerSummary(offer)}
      </p>
      {offer.message && (
        <p
          className="muted"
          style={{ fontSize: 12, marginTop: 4, marginBottom: 0, fontStyle: 'italic' }}
        >
          &ldquo;{offer.message}&rdquo;
        </p>
      )}
      {error && (
        <p className="field-error" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
          {error}
        </p>
      )}
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className={
                action === 'accept' || action === 'complete' ? 'btn-primary' : 'btn-secondary'
              }
              style={{ width: 'auto', flex: 1, padding: '8px 10px', fontSize: 12 }}
              disabled={busy}
              onClick={() => run(action)}
            >
              {busy ? '…' : ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      )}
      {viewer === 'buyer' && offer.status === 'completed' && !reviewed && onReviewSubmitted && (
        <ReviewPrompt
          offer={offer}
          sellerName={sellerName ?? 'the seller'}
          onSubmitted={() => onReviewSubmitted(offer.id)}
        />
      )}
      {viewer === 'buyer' && offer.status === 'completed' && reviewed && (
        <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          You reviewed this deal.
        </p>
      )}
    </div>
  );
}

function ListingGroup({
  group,
  viewer,
  reviewedOfferIds,
  onReviewSubmitted,
}: {
  group: InboxGroup;
  viewer: 'buyer' | 'seller';
  reviewedOfferIds?: Set<string>;
  onReviewSubmitted?: (offerId: string) => void;
}) {
  const { listing, offers } = group;
  return (
    <div style={{ marginBottom: 18 }}>
      {listing ? (
        <Link
          href={`/market/${listing.id}`}
          style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--panel-alt)',
              flexShrink: 0,
            }}
          >
            {listing.media[0] && (
              <MediaImage
                mediaId={listing.media[0].id}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {[listing.model || listing.brand, listing.variant].filter(Boolean).join(' · ')}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {viewer === 'buyer'
                ? listing.seller_name || 'Seller'
                : `${offers.length} offer${offers.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </Link>
      ) : (
        <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          Listing no longer available
        </p>
      )}
      {offers.map((offer) => (
        <OfferRowCard
          key={offer.id}
          offer={offer}
          viewer={viewer}
          counterpartyLabel={
            viewer === 'seller'
              ? `From ${offer.counterpartyName ?? 'a collector'}`
              : `To ${listing?.seller_name ?? 'the seller'}`
          }
          sellerName={listing?.seller_name ?? 'the seller'}
          reviewed={reviewedOfferIds?.has(offer.id)}
          onReviewSubmitted={onReviewSubmitted}
        />
      ))}
    </div>
  );
}

export default function OffersInboxView({
  initialReceived,
  initialSent,
  initialReviewedOfferIds,
}: {
  initialReceived: InboxGroup[];
  initialSent: InboxGroup[];
  initialReviewedOfferIds?: string[];
}) {
  const [tab, setTab] = useState<Tab>('received');
  const [reviewedOfferIds, setReviewedOfferIds] = useState(
    () => new Set(initialReviewedOfferIds ?? [])
  );
  const receivedCount = initialReceived.reduce((n, g) => n + g.offers.length, 0);
  const sentCount = initialSent.reduce((n, g) => n + g.offers.length, 0);

  function markReviewed(offerId: string) {
    setReviewedOfferIds((prev) => new Set(prev).add(offerId));
  }

  return (
    <div>
      <div className="tab-row">
        <button
          type="button"
          className={`tab-chip ${tab === 'received' ? 'active' : ''}`}
          onClick={() => setTab('received')}
        >
          Received ({receivedCount})
        </button>
        <button
          type="button"
          className={`tab-chip ${tab === 'sent' ? 'active' : ''}`}
          onClick={() => setTab('sent')}
        >
          Sent ({sentCount})
        </button>
      </div>

      {tab === 'received' &&
        (initialReceived.length === 0 ? (
          <div className="empty-state">
            <p>No offers yet.</p>
            <p className="muted" style={{ fontSize: 13 }}>
              List a car for sale to start receiving offers.
            </p>
          </div>
        ) : (
          initialReceived.map((group) => (
            <ListingGroup
              key={group.listing?.id ?? group.offers[0]!.listing_id}
              group={group}
              viewer="seller"
            />
          ))
        ))}

      {tab === 'sent' &&
        (initialSent.length === 0 ? (
          <div className="empty-state">
            <p>You haven&apos;t made any offers.</p>
            <p className="muted" style={{ fontSize: 13 }}>
              Browse the marketplace to make a cash offer or propose a trade.
            </p>
          </div>
        ) : (
          initialSent.map((group) => (
            <ListingGroup
              key={group.listing?.id ?? group.offers[0]!.listing_id}
              group={group}
              viewer="buyer"
              reviewedOfferIds={reviewedOfferIds}
              onReviewSubmitted={markReviewed}
            />
          ))
        ))}
    </div>
  );
}
