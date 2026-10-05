'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { restoreCollectionItem } from '@/domain/garage';
import type { GarageItem } from '@/domain/garage';
import MediaImage from './MediaImage';

export default function TrashView({ items }: { items: GarageItem[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);

  async function handleRestore(id: string) {
    setRestoring(id);
    try {
      await restoreCollectionItem(supabase, id);
      router.refresh();
    } catch {
      setRestoring(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>Nothing in your trash.</p>
        <Link
          href="/garage"
          className="btn-secondary"
          style={{ marginTop: 12, display: 'inline-flex' }}
        >
          Back to garage
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Deleted cars are kept for 30 days. Restore one to put it back in your garage.
      </p>
      <div className="garage-list">
        {items.map((item) => (
          <div
            key={item.id}
            className="car-card"
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <div className="car-photo" style={{ width: 56, height: 56, flex: '0 0 auto' }}>
              <MediaImage src={item.media[0]?.url} mediaId={item.media[0]?.id} alt={item.brand} />
            </div>
            <div className="car-body" style={{ flex: 1 }}>
              <div className="car-brand">{item.brand}</div>
              {(item.model || item.variant) && (
                <div className="car-meta">
                  {[item.model, item.variant].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            <button
              className="btn-secondary"
              style={{ width: 'auto' }}
              disabled={restoring === item.id}
              onClick={() => handleRestore(item.id)}
            >
              {restoring === item.id ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
