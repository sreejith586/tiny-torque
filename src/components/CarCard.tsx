'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { updateCollectionItem } from '@/domain/garage';
import type { GarageItem } from '@/domain/garage';
import { createClient } from '@/lib/supabase/client';
import MediaImage from './MediaImage';
import { HeartIcon } from './icons';

function rarityTier(rarity?: string | null): 'rarity-common' | 'rarity-rare' | 'rarity-elite' {
  if (rarity === 'treasure-hunt' || rarity === 'chase') return 'rarity-elite';
  if (rarity === 'rare' || rarity === 'super-rare') return 'rarity-rare';
  return 'rarity-common';
}

const RARITY_LABEL: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'super-rare': 'Super Rare',
  'treasure-hunt': 'Treasure Hunt',
  chase: 'Chase',
};

export default function CarCard({
  item,
  view,
  interactive = false,
}: {
  item: GarageItem;
  view: 'grid' | 'list';
  /** Shows a toggleable favourite heart — only meaningful for the owner's own garage, not
   *  someone else's public collection (favourite is the owner's data, not a social feature). */
  interactive?: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);
  const listSubtitle = [item.model, item.variant].filter(Boolean).join(' · ');
  const gridSubtitle = [item.variant, item.series].filter(Boolean).join(' · ');
  const primary = item.media[0];

  async function handleToggleFavorite(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await updateCollectionItem(createClient(), item.id, { is_favorite: next });
    } catch {
      setIsFavorite(!next);
    }
  }

  if (view === 'list') {
    return (
      <Link href={`/garage/${item.id}`} className="car-card" style={{ flexDirection: 'row' }}>
        <div className="car-photo" style={{ width: 72, height: 72, flex: '0 0 auto' }}>
          <MediaImage src={primary?.url} mediaId={primary?.id} alt={item.brand} />
        </div>
        <div className="car-body" style={{ flex: 1 }}>
          <div className="car-brand">{item.brand}</div>
          {listSubtitle && <div className="car-meta">{listSubtitle}</div>}
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
      <div className="qty-badge">×{item.qty}</div>
      {interactive && (
        <button
          type="button"
          className={`fav-heart ${isFavorite ? 'active' : ''}`}
          onClick={handleToggleFavorite}
          aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
        >
          <HeartIcon size={15} filled={isFavorite} />
        </button>
      )}
      <div className="thumb">
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
        {item.media.length > 1 && (
          <span className="thumb-carousel-count">{item.media.length} photos</span>
        )}
      </div>
      <div className="brand-tag">{item.brand}</div>
      <h3>{item.model}</h3>
      {gridSubtitle && <div className="car-meta">{gridSubtitle}</div>}
      {item.rarity && (
        <span className={`rarity-badge ${rarityTier(item.rarity)}`}>
          {RARITY_LABEL[item.rarity] ?? item.rarity}
        </span>
      )}
    </Link>
  );
}
