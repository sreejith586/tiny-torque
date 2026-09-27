import Link from 'next/link';
import type { CollectionItemRow } from '@/types/database';

export default function CarCard({ item, view }: { item: CollectionItemRow; view: 'grid' | 'list' }) {
  const subtitle = [item.model, item.variant].filter(Boolean).join(' · ');

  if (view === 'list') {
    return (
      <Link href={`/garage/${item.id}`} className="car-card" style={{ flexDirection: 'row' }}>
        <div className="car-photo" style={{ width: 72, height: 72, flex: '0 0 auto' }}>
          {item.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photo} alt={item.brand} />
          ) : (
            <span>No photo</span>
          )}
        </div>
        <div className="car-body" style={{ flex: 1 }}>
          <div className="car-brand">{item.brand}</div>
          {subtitle && <div className="car-meta">{subtitle}</div>}
          <div className="car-meta">Qty {item.qty}{item.is_public ? ' · Public' : ''}</div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/garage/${item.id}`} className="car-card">
      <div className="car-photo">
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo} alt={item.brand} />
        ) : (
          <span>No photo</span>
        )}
      </div>
      <div className="car-body">
        <div className="car-brand">{item.brand}</div>
        {subtitle && <div className="car-meta">{subtitle}</div>}
        <div className="car-meta">Qty {item.qty}{item.is_public ? ' · Public' : ''}</div>
      </div>
    </Link>
  );
}
