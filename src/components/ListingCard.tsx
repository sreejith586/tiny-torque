import Link from 'next/link';
import type { Listing } from '@/domain/marketplace';
import MediaImage from './MediaImage';

const TYPE_LABEL: Record<Listing['listing_type'], string> = {
  sale: 'For sale',
  trade: 'For trade',
  both: 'Sale or trade',
};

function price(listing: Listing): string {
  if (listing.listing_type === 'trade') return 'Trade only';
  return `${listing.currency ?? ''} ${Number(listing.price).toLocaleString()}`.trim();
}

export default function ListingCard({
  listing,
  view,
}: {
  listing: Listing;
  view: 'grid' | 'list';
}) {
  const subtitle = [listing.model, listing.variant].filter(Boolean).join(' · ');
  const primary = listing.media[0];

  if (view === 'list') {
    return (
      <Link href={`/market/${listing.id}`} className="car-card" style={{ flexDirection: 'row' }}>
        <div className="car-photo" style={{ width: 72, height: 72, flex: '0 0 auto' }}>
          <MediaImage src={primary?.url} mediaId={primary?.id} alt={listing.brand} />
        </div>
        <div className="car-body" style={{ flex: 1 }}>
          <div className="car-brand">{listing.brand}</div>
          {subtitle && <div className="car-meta">{subtitle}</div>}
          <div className="car-meta">
            {price(listing)} · {TYPE_LABEL[listing.listing_type]}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/market/${listing.id}`} className="car-card">
      <div className="car-photo">
        {listing.media.length > 1 ? (
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
            }}
          >
            {listing.media.map((m) => (
              <div
                key={m.id}
                style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center' }}
              >
                <MediaImage src={m.url} mediaId={m.id} alt={listing.brand} />
              </div>
            ))}
          </div>
        ) : (
          <MediaImage src={primary?.url} mediaId={primary?.id} alt={listing.brand} />
        )}
      </div>
      <div className="car-body">
        <div className="car-brand">{listing.brand}</div>
        {subtitle && <div className="car-meta">{subtitle}</div>}
        <div className="car-meta">{price(listing)}</div>
        <div className="car-meta muted">{TYPE_LABEL[listing.listing_type]}</div>
      </div>
    </Link>
  );
}
