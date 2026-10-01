import Link from 'next/link';
import type { GarageItem } from '@/domain/garage';
import MediaImage from './MediaImage';

export default function CarCard({ item, view }: { item: GarageItem; view: 'grid' | 'list' }) {
  const subtitle = [item.model, item.variant].filter(Boolean).join(' · ');
  const primary = item.media[0];

  if (view === 'list') {
    return (
      <Link href={`/garage/${item.id}`} className="car-card" style={{ flexDirection: 'row' }}>
        <div className="car-photo" style={{ width: 72, height: 72, flex: '0 0 auto' }}>
          <MediaImage src={primary?.url} mediaId={primary?.id} alt={item.brand} />
        </div>
        <div className="car-body" style={{ flex: 1 }}>
          <div className="car-brand">{item.brand}</div>
          {subtitle && <div className="car-meta">{subtitle}</div>}
          <div className="car-meta">
            Qty {item.qty}
            {item.is_public ? ' · Public' : ''}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/garage/${item.id}`} className="car-card">
      <div className="car-photo">
        {item.media.length > 1 ? (
          // CSS-only swipe carousel (scroll-snap) — no JS needed, works inside the card link.
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
            }}
          >
            {item.media.map((m) => (
              <div
                key={m.id}
                style={{ flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center' }}
              >
                <MediaImage src={m.url} mediaId={m.id} alt={item.brand} />
              </div>
            ))}
          </div>
        ) : (
          <MediaImage src={primary?.url} mediaId={primary?.id} alt={item.brand} />
        )}
      </div>
      <div className="car-body">
        <div className="car-brand">{item.brand}</div>
        {subtitle && <div className="car-meta">{subtitle}</div>}
        <div className="car-meta">
          Qty {item.qty}
          {item.is_public ? ' · Public' : ''}
        </div>
      </div>
    </Link>
  );
}
