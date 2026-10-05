'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { incrementListingView, listingPriceLabel, LISTING_TYPE_LABEL } from '@/domain/marketplace';
import type { Listing } from '@/domain/marketplace';
import type { PublicProfileRow } from '@/types/database';
import MediaImage from './MediaImage';
import styles from './Market.module.css';

const COUNTRY: Record<string, string> = { AE: 'UAE', IN: 'India' };

const FIELDS: Array<{ key: keyof Listing; label: string }> = [
  { key: 'model', label: 'Model' },
  { key: 'variant', label: 'Variant / colour' },
  { key: 'condition', label: 'Condition' },
  { key: 'rarity', label: 'Rarity' },
];

export default function ListingDetailView({
  listing,
  seller,
  harness = false,
}: {
  listing: Listing;
  seller: PublicProfileRow | null;
  harness?: boolean;
}) {
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const counted = useRef(false);

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

      {/* Offer CTAs land with the offers UI (S5), behind the `offers` flag. */}
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
    </div>
  );
}
