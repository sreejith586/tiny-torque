'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  incrementListingView,
  favoriteListing,
  unfavoriteListing,
  listingPriceLabel,
  LISTING_TYPE_LABEL,
} from '@/domain/marketplace';
import type { Listing } from '@/domain/marketplace';
import {
  createCashOffer,
  proposeTrade,
  buyNow,
  withdrawOffer,
  validateCashOffer,
  validateTradeOffer,
  OfferError,
  type OfferRow,
} from '@/domain/deals';
import { listPublicCollectionItems } from '@/domain/garage';
import type { GarageItem } from '@/domain/garage';
import type { PublicProfileRow } from '@/types/database';
import MediaImage from './MediaImage';
import styles from './Market.module.css';

const COUNTRY: Record<string, string> = { AE: 'UAE', IN: 'India' };

const HEART =
  'M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3C19.58,3,22,5.42,22,8.5c0,3.78-3.4,6.86-8.55,11.54L12,21.35z';

const FIELDS: Array<{ key: keyof Listing; label: string }> = [
  { key: 'model', label: 'Model' },
  { key: 'variant', label: 'Variant / colour' },
  { key: 'condition', label: 'Condition' },
  { key: 'rarity', label: 'Rarity' },
];

// Mirrors validateCashOffer/validateTradeOffer's codes (state.ts) and the create_offer/buy_now
// RPC's raised codes (supabase/migrations/20261003020000_offer_rpcs.sql) — the RPC is
// authoritative, these are just friendlier copy for whichever side catches it first.
const OFFER_ERROR_LABEL: Record<string, string> = {
  listing_not_available: 'This listing is no longer available.',
  listing_not_found: 'This listing is no longer available.',
  not_for_sale: 'This listing is trade-only.',
  not_open_to_offers: 'This seller is not accepting offers — buy at the asking price instead.',
  not_open_to_trade: 'This seller is not accepting trades.',
  amount_required: 'Enter an offer amount.',
  below_min_offer: 'Your offer is below the minimum this seller accepts.',
  above_sanity_cap: 'That offer is too far above the asking price.',
  trade_items_1_to_3: 'Pick 1 to 3 items to trade.',
  trade_item_invalid: "One of those items isn't eligible to trade — make sure it's public.",
  cannot_offer_on_own_listing: "You can't make an offer on your own listing.",
  cannot_buy_own_listing: "You can't buy your own listing.",
  offer_rate_limit_hour: "You're sending offers quickly — wait a bit and try again.",
  offer_rate_limit_day: "You've hit today's offer limit — try again tomorrow.",
  message_too_long: 'Message is too long.',
};

export default function ListingDetailView({
  listing,
  seller,
  harness = false,
  userId,
  initialFavorited = false,
  isOwner = false,
  offersEnabled = false,
  initialPendingOffer = null,
}: {
  listing: Listing;
  seller: PublicProfileRow | null;
  harness?: boolean;
  userId?: string;
  initialFavorited?: boolean;
  isOwner?: boolean;
  offersEnabled?: boolean;
  initialPendingOffer?: OfferRow | null;
}) {
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(initialFavorited);
  const counted = useRef(false);

  const [pendingOffer, setPendingOffer] = useState(initialPendingOffer);
  const [section, setSection] = useState<'cash' | 'trade' | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [tradeItems, setTradeItems] = useState<GarageItem[] | null>(null);
  const [selectedTradeItemIds, setSelectedTradeItemIds] = useState<string[]>([]);
  const [cashTopUp, setCashTopUp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  const terms = {
    price: listing.price,
    minOffer: listing.min_offer,
    openToOffers: listing.open_to_offers,
    listingType: listing.listing_type,
    status: listing.status,
  };

  async function handleToggleSection(next: 'cash' | 'trade') {
    setOfferError(null);
    setSection((prev) => (prev === next ? null : next));
    if (next === 'trade' && tradeItems === null && userId) {
      const supabase = createClient();
      try {
        setTradeItems(await listPublicCollectionItems(supabase, userId));
      } catch {
        setTradeItems([]);
      }
    }
  }

  async function handleSendCash() {
    const amount = Number(cashAmount);
    const check = validateCashOffer(amount, terms);
    if (!check.ok) {
      setOfferError(OFFER_ERROR_LABEL[check.error] ?? check.error);
      return;
    }
    setSubmitting(true);
    setOfferError(null);
    try {
      const supabase = createClient();
      const offer = await createCashOffer(supabase, { listingId: listing.id, amount });
      setPendingOffer(offer);
      setSection(null);
    } catch (err) {
      setOfferError(
        err instanceof OfferError
          ? (OFFER_ERROR_LABEL[err.code] ?? err.code)
          : 'Could not send this offer.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBuyNow() {
    if (!window.confirm(`Buy this now for ${listingPriceLabel(listing)}?`)) return;
    setSubmitting(true);
    setOfferError(null);
    try {
      const supabase = createClient();
      const offer = await buyNow(supabase, listing.id);
      setPendingOffer(offer);
    } catch (err) {
      setOfferError(
        err instanceof OfferError
          ? (OFFER_ERROR_LABEL[err.code] ?? err.code)
          : 'Could not complete this purchase.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleTradeItem(id: string) {
    setSelectedTradeItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  async function handleProposeTrade() {
    const check = validateTradeOffer(selectedTradeItemIds.length, terms);
    if (!check.ok) {
      setOfferError(OFFER_ERROR_LABEL[check.error] ?? check.error);
      return;
    }
    setSubmitting(true);
    setOfferError(null);
    try {
      const supabase = createClient();
      const offer = await proposeTrade(supabase, {
        listingId: listing.id,
        tradeItemIds: selectedTradeItemIds,
        cashTopUp: cashTopUp ? Number(cashTopUp) : null,
      });
      setPendingOffer(offer);
      setSection(null);
    } catch (err) {
      setOfferError(
        err instanceof OfferError
          ? (OFFER_ERROR_LABEL[err.code] ?? err.code)
          : 'Could not send this proposal.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (!pendingOffer) return;
    setSubmitting(true);
    setOfferError(null);
    try {
      const supabase = createClient();
      await withdrawOffer(supabase, pendingOffer.id);
      setPendingOffer(null);
    } catch {
      setOfferError('Could not withdraw this offer.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleToggleFavorite() {
    if (!userId) return;
    const next = !favorited;
    setFavorited(next);
    const supabase = createClient();
    const op = next
      ? favoriteListing(supabase, userId, listing.id)
      : unfavoriteListing(supabase, userId, listing.id);
    op.catch(() => setFavorited(!next));
  }

  useEffect(() => {
    if (counted.current || harness) return;
    counted.current = true;
    incrementListingView(createClient(), listing.id).catch(() => {});
  }, [listing.id, harness]);

  async function handleShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = `${listing.brand}${listing.model ? ' ' + listing.model : ''} on Tiny Torque`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied');
    } catch {
      setShareMsg('Could not share');
    }
  }

  const memberSince = seller?.created_at ? new Date(seller.created_at).getFullYear() : null;
  const sellerName = seller?.display_name ?? listing.seller_name ?? 'Seller';

  return (
    <div>
      <div className={styles.detailThumb}>
        {userId && (
          <button
            type="button"
            className={`${styles.favHeart} ${favorited ? styles.active : ''}`}
            aria-label={favorited ? 'Remove from favourites' : 'Add to favourites'}
            onClick={handleToggleFavorite}
          >
            <svg
              viewBox="0 0 24 24"
              fill={favorited ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={HEART} />
            </svg>
          </button>
        )}
        {listing.media.length > 1 ? (
          <div className={styles.carousel}>
            {listing.media.map((m) => (
              <div key={m.id} className={styles.carouselSlide}>
                <MediaImage src={m.url} mediaId={m.id} alt={listing.brand} />
              </div>
            ))}
          </div>
        ) : (
          <MediaImage
            src={listing.media[0]?.url}
            mediaId={listing.media[0]?.id}
            alt={listing.brand}
          />
        )}
      </div>

      <div className={styles.detailHead}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22 }}>
            {[listing.brand, listing.model].filter(Boolean).join(' ')}
          </h1>
          {listing.variant && <div className="muted">{listing.variant}</div>}
        </div>
        <button
          className="btn-secondary"
          style={{ width: 'auto', flexShrink: 0 }}
          onClick={handleShare}
        >
          Share
        </button>
      </div>
      {shareMsg && (
        <p className="muted" style={{ fontSize: 13 }}>
          {shareMsg}
        </p>
      )}

      <div className={styles.detailPrice} style={{ marginTop: 6 }}>
        {listingPriceLabel(listing)}
      </div>

      <div className={styles.chips} style={{ marginTop: 8 }}>
        {(listing.status === 'reserved' || listing.status === 'sold') && (
          <span className={`status-pill status-${listing.status}`}>{listing.status}</span>
        )}
        {(listing.listing_type === 'trade' || listing.listing_type === 'both') && (
          <span className={`${styles.tagBadge} ${styles.tagExchange}`}>Exchange</span>
        )}
        {listing.listing_type !== 'trade' && (
          <span className={`${styles.tagBadge} ${styles.tagSale}`}>For sale</span>
        )}
        {listing.seller_type === 'shop' && (
          <span className={`${styles.tagBadge} ${styles.tagShop}`}>Shop</span>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="toggle-row">
          <span className="muted">Type</span>
          <span>{LISTING_TYPE_LABEL[listing.listing_type]}</span>
        </div>
        {FIELDS.map((f) =>
          listing[f.key] ? (
            <div key={f.key} className="toggle-row">
              <span className="muted">{f.label}</span>
              <span>{String(listing[f.key])}</span>
            </div>
          ) : null
        )}
      </div>
      {listing.description && <p style={{ marginTop: 12 }}>{listing.description}</p>}

      {/* Seller card (public_profiles; no PII — rule 15). Avatar/rating are placeholders until those
          columns land (media + reviews-aggregate migrations). */}
      <div className={styles.sellerCard}>
        <span className={styles.sellerAvatar}>{sellerName.slice(0, 1).toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>
            {sellerName}
            {seller?.is_pro ? ' · Pro' : ''}
          </div>
          <div className={styles.seller}>
            {seller?.handle ? `@${seller.handle}` : ''}
            {seller?.country_code
              ? ` · ${COUNTRY[seller.country_code] ?? seller.country_code}`
              : ''}
            {memberSince ? ` · Since ${memberSince}` : ''}
          </div>
          <div className={styles.ratingLine}>No ratings yet</div>
        </div>
      </div>

      {!isOwner && !offersEnabled && (
        <>
          <div className={styles.ctaRow}>
            <button className="btn-primary" disabled title="Offers are coming soon">
              Make an offer
            </button>
            {listing.listing_type !== 'trade' && (
              <button className="btn-secondary" disabled title="Buy Now is coming soon">
                Buy now
              </button>
            )}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Offers &amp; trades open soon.
          </p>
        </>
      )}

      {!isOwner && offersEnabled && !userId && (
        <div className="panel" style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginBottom: 10 }}>
            Sign in to make an offer, propose a trade, or buy instantly.
          </p>
          <Link href={`/login?next=/market/${listing.id}`} className="btn-primary">
            Sign in
          </Link>
        </div>
      )}

      {!isOwner && offersEnabled && userId && (
        <div style={{ marginTop: 16 }}>
          {pendingOffer ? (
            <div className="panel">
              <p>
                You have a pending{' '}
                {pendingOffer.type === 'trade'
                  ? 'trade proposal'
                  : pendingOffer.type === 'buy_now'
                    ? 'purchase'
                    : `cash offer${pendingOffer.amount ? ` of ${listing.currency} ${pendingOffer.amount}` : ''}`}{' '}
                on this listing.
              </p>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Withdraw it first to send something different.
              </p>
              {offerError && <p className="field-error">{offerError}</p>}
              <button
                className="btn-secondary"
                style={{ marginTop: 10 }}
                onClick={handleWithdraw}
                disabled={submitting}
              >
                {submitting ? 'Withdrawing…' : 'Withdraw offer'}
              </button>
            </div>
          ) : listing.status !== 'active' ? (
            <div className="panel">
              <p className="muted">
                This listing is {listing.status} and no longer accepting offers.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.ctaRow}>
                {listing.listing_type !== 'trade' &&
                  (listing.open_to_offers ? (
                    <button className="btn-primary" onClick={() => handleToggleSection('cash')}>
                      Make an offer
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={handleBuyNow} disabled={submitting}>
                      {submitting ? 'Buying…' : 'Buy now'}
                    </button>
                  ))}
                {listing.listing_type !== 'sale' && (
                  <button className="btn-secondary" onClick={() => handleToggleSection('trade')}>
                    Propose trade
                  </button>
                )}
              </div>

              {section === 'cash' && (
                <div className="panel" style={{ marginTop: 10 }}>
                  <label htmlFor="cashAmount">Make a cash offer ({listing.currency})</label>
                  <input
                    id="cashAmount"
                    type="number"
                    min={listing.min_offer ?? listing.price}
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder={`At least ${listing.min_offer ?? listing.price}`}
                  />
                  {offerError && <p className="field-error">{offerError}</p>}
                  <button
                    className="btn-primary"
                    style={{ marginTop: 10 }}
                    onClick={handleSendCash}
                    disabled={submitting}
                  >
                    {submitting ? 'Sending…' : 'Send offer'}
                  </button>
                </div>
              )}

              {section === 'trade' && (
                <div className="panel" style={{ marginTop: 10 }}>
                  <label>Offer a trade from your public duplicates (pick 1–3)</label>
                  {tradeItems === null ? (
                    <p className="muted" style={{ fontSize: 13 }}>
                      Loading your garage…
                    </p>
                  ) : tradeItems.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>
                      You don&apos;t have any public items to trade. Mark one public in your garage
                      first.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {tradeItems.map((item) => (
                        <label key={item.id} className="toggle-row">
                          <span>
                            {[item.model || item.brand, item.variant].filter(Boolean).join(' · ')}
                          </span>
                          <input
                            type="checkbox"
                            style={{ width: 'auto' }}
                            checked={selectedTradeItemIds.includes(item.id)}
                            onChange={() => toggleTradeItem(item.id)}
                            disabled={
                              !selectedTradeItemIds.includes(item.id) &&
                              selectedTradeItemIds.length >= 3
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  <label htmlFor="cashTopUp" style={{ marginTop: 10 }}>
                    Cash top-up ({listing.currency}, optional)
                  </label>
                  <input
                    id="cashTopUp"
                    type="number"
                    min="0"
                    value={cashTopUp}
                    onChange={(e) => setCashTopUp(e.target.value)}
                  />

                  {offerError && <p className="field-error">{offerError}</p>}
                  <button
                    className="btn-primary"
                    style={{ marginTop: 10 }}
                    onClick={handleProposeTrade}
                    disabled={submitting || selectedTradeItemIds.length === 0}
                  >
                    {submitting ? 'Sending…' : 'Propose trade'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
