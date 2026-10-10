import Link from 'next/link';
import type { MouseEvent, KeyboardEvent } from 'react';
import { type Listing, listingPriceLabel } from '@/domain/marketplace';
import MediaImage from './MediaImage';
import styles from './Market.module.css';

const HEART =
  'M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3C19.58,3,22,5.42,22,8.5c0,3.78-3.4,6.86-8.55,11.54L12,21.35z';

const DAY = 24 * 60 * 60 * 1000;
function isNew(listing: Listing): boolean {
  return Date.now() - new Date(listing.created_at).getTime() < 7 * DAY;
}

export default function ListingCard({
  listing,
  favorited = false,
  onToggleFavorite,
}: {
  listing: Listing;
  view?: 'grid' | 'list';
  favorited?: boolean;
  onToggleFavorite?: (id: string, next: boolean) => void;
}) {
  const title = [listing.model || listing.brand, listing.variant].filter(Boolean).join(' · ');
  const subtitle = [listing.brand, listing.condition].filter(Boolean).join(' · ');
  const sellerName = listing.seller_name || 'Seller';

  function handleHeartActivate(e: MouseEvent | KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(listing.id, !favorited);
  }

  return (
    <Link href={`/market/${listing.id}`} className={styles.listing}>
      <span
        className={`${styles.favHeart} ${favorited ? styles.active : ''}`}
        role={onToggleFavorite ? 'button' : undefined}
        tabIndex={onToggleFavorite ? 0 : undefined}
        aria-label={
          onToggleFavorite
            ? favorited
              ? 'Remove from favourites'
              : 'Add to favourites'
            : undefined
        }
        aria-hidden={onToggleFavorite ? undefined : true}
        onClick={onToggleFavorite ? handleHeartActivate : undefined}
        onKeyDown={
          onToggleFavorite
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') handleHeartActivate(e);
              }
            : undefined
        }
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
      </span>

      <div className={styles.thumb}>
        {listing.media.length > 1 ? (
          <div className={styles.carousel}>
            {listing.media.map((m) => (
              <div key={m.id} className={styles.carouselSlide}>
                <MediaImage src={m.url} mediaId={m.id} alt={listing.brand} />
              </div>
            ))}
            <span className={styles.carouselCount}>{listing.media.length} photos</span>
          </div>
        ) : (
          <MediaImage
            src={listing.media[0]?.url}
            mediaId={listing.media[0]?.id}
            alt={listing.brand}
          />
        )}
      </div>

      <div className={styles.info}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}

        <div className={styles.chips}>
          {isNew(listing) && <span className={`${styles.tagBadge} ${styles.tagNew}`}>New</span>}
          {(listing.listing_type === 'trade' || listing.listing_type === 'both') && (
            <span className={`${styles.tagBadge} ${styles.tagExchange}`}>Exchange</span>
          )}
          {listing.seller_type === 'shop' && (
            <span className={`${styles.tagBadge} ${styles.tagShop}`}>Shop</span>
          )}
        </div>

        <div className={styles.sellerRow}>
          <div className={styles.sellerInfo}>
            <span className={styles.sellerAvatar}>{sellerName.slice(0, 1).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <div className={styles.seller}>{sellerName}</div>
            </div>
          </div>
          <div className={styles.price}>{listingPriceLabel(listing)}</div>
        </div>
      </div>
    </Link>
  );
}
