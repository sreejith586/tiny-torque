'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CollectionItemRow } from '@/types/database';
import CarCard from './CarCard';

type SortKey = 'newest' | 'brand-az' | 'qty-desc' | 'price-desc';

export default function GarageView({ items }: { items: CollectionItemRow[] }) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [publicOnly, setPublicOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');

  const brands = useMemo(() => {
    const set = new Set(items.map((i) => i.brand).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const visible = useMemo(() => {
    let result = items;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((i) =>
        [i.brand, i.model, i.series, i.variant]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }

    if (brandFilter !== 'all') {
      result = result.filter((i) => i.brand === brandFilter);
    }

    if (publicOnly) {
      result = result.filter((i) => i.is_public);
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'brand-az':
          return a.brand.localeCompare(b.brand);
        case 'qty-desc':
          return b.qty - a.qty;
        case 'price-desc':
          return Number(b.price_paid) - Number(a.price_paid);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [items, query, brandFilter, publicOnly, sort]);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>Your garage is empty.</p>
        <Link href="/garage/add" className="btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
          Add your first car
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="garage-toolbar">
        <input
          placeholder="Search your garage…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', padding: '10px 12px' }}
          onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
        >
          {view === 'grid' ? 'List' : 'Grid'}
        </button>
      </div>

      <div className="garage-toolbar">
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="newest">Newest first</option>
          <option value="brand-az">Brand A–Z</option>
          <option value="qty-desc">Quantity (high to low)</option>
          <option value="price-desc">Price paid (high to low)</option>
        </select>
      </div>

      <label className="toggle-row" style={{ marginBottom: 12 }}>
        <span>Show public items only</span>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={publicOnly}
          onChange={(e) => setPublicOnly(e.target.checked)}
        />
      </label>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>No cars match your search or filters.</p>
        </div>
      ) : (
        <div className={view === 'grid' ? 'garage-grid' : 'garage-list'}>
          {visible.map((item) => (
            <CarCard key={item.id} item={item} view={view} />
          ))}
        </div>
      )}
    </div>
  );
}
