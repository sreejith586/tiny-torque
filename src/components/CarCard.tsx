import Link from 'next/link';
import type { CollectionItemRow } from '@/types/database';
import MediaImage from './MediaImage';

export default function CarCard({
  item,
  view,
}: {
  item: CollectionItemRow;
  view: 'grid' | 'list';
}) {
  const subtitle = [item.model, item.variant].filter(Boolean).join(' · ');

  if (view === 'list') {
    return (
      <Link href={`/garage/${item.id}`} className="car-card" style={{ flexDirection: 'row' }}>
        <div className="car-photo" style={{ width: 72, height: 72, flex: '0 0 auto' }}>
          <MediaImage src={item.photo} alt={item.brand} />
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
        <MediaImage src={item.photo} alt={item.brand} />
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
