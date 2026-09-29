import Link from 'next/link';
import type { CollectionItemRow } from '@/types/database';

// Matches garage-log-147.html's noPhotoPlaceholderHtml() exactly (D-044): the car-silhouette
// PNG (public/car-placeholder.png, extracted from the mockup) as a CSS mask at reduced opacity,
// with a "No Photo" label over it -- not the plain text-only placeholder this had before.
function NoPhotoPlaceholder() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: 5,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--muted)',
          opacity: 0.3,
          WebkitMaskImage: 'url(/car-placeholder.png)',
          WebkitMaskSize: 'contain',
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          maskImage: 'url(/car-placeholder.png)',
          maskSize: 'contain',
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          fontSize: 15,
          fontWeight: 600,
          pointerEvents: 'none',
        }}
      >
        No Photo
      </span>
    </div>
  );
}

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
          {item.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.photo} alt={item.brand} />
          ) : (
            <NoPhotoPlaceholder />
          )}
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
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo} alt={item.brand} />
        ) : (
          <NoPhotoPlaceholder />
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
