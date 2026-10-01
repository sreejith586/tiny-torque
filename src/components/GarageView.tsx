'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { GarageItem, GarageSort } from '@/domain/garage';
import CarCard from './CarCard';

type Page = { items: GarageItem[]; nextCursor: string | null };

const VIEW_KEY = 'mini-vault-garage-view';

async function fetchPage(params: URLSearchParams, cursor: string | null): Promise<Page> {
  const sp = new URLSearchParams(params);
  if (cursor) sp.set('cursor', cursor);
  const res = await fetch(`/api/garage?${sp.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load your garage.');
  return res.json();
}

export default function GarageView({
  initialItems,
  initialCursor = null,
}: {
  initialItems: GarageItem[];
  initialCursor?: string | null;
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [brand, setBrand] = useState('all');
  const [publicOnly, setPublicOnly] = useState(false);
  const [sort, setSort] = useState<GarageSort>('newest');

  // Restore the grid/list choice (per-device). Read in an effect, not a lazy initializer, so SSR
  // and the client's first paint agree ('grid') and only then swap to the stored value — the
  // hydration-safe pattern; the one-time setState is intentional.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === 'grid' || saved === 'list') setView(saved);
    } catch {
      /* private mode / blocked storage — keep the default */
    }
  }, []);
  function toggleView() {
    setView((v) => {
      const next = v === 'grid' ? 'list' : 'grid';
      try {
        localStorage.setItem(VIEW_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Debounce the search box so each keystroke doesn't hit the server.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set('q', debouncedQ);
    if (brand !== 'all') sp.set('brand', brand);
    if (publicOnly) sp.set('isPublic', 'true');
    if (sort !== 'newest') sp.set('sort', sort);
    return sp;
  }, [debouncedQ, brand, publicOnly, sort]);

  const isDefault = params.toString() === '';

  const query = useInfiniteQuery({
    queryKey: ['garage', params.toString()],
    queryFn: ({ pageParam }) => fetchPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Seed the default view from SSR so the first paint (and the visual harness) needs no fetch.
    initialData: isDefault
      ? { pages: [{ items: initialItems, nextCursor: initialCursor }], pageParams: [null] }
      : undefined,
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const brands = useMemo(() => {
    const set = new Set(items.map((i) => i.brand).filter(Boolean));
    if (brand !== 'all') set.add(brand);
    return Array.from(set).sort();
  }, [items, brand]);

  // Infinite scroll: fetch the next page when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement | null>(null);
  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    },
    [query]
  );
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(onIntersect, { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect]);

  const nothingYet = isDefault && items.length === 0 && !query.isFetching;

  if (nothingYet) {
    return (
      <div className="empty-state">
        <p>Your garage is empty.</p>
        <Link
          href="/garage/add"
          className="btn-primary"
          style={{ marginTop: 12, display: 'inline-flex' }}
        >
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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', padding: '10px 12px' }}
          onClick={toggleView}
        >
          {view === 'grid' ? 'List' : 'Grid'}
        </button>
      </div>

      <div className="garage-toolbar">
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as GarageSort)}>
          <option value="newest">Newest first</option>
          <option value="brand">Brand A–Z</option>
          <option value="qty">Quantity (high to low)</option>
          <option value="price">Price paid (high to low)</option>
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

      {items.length === 0 ? (
        <div className="empty-state">
          <p>{query.isFetching ? 'Loading…' : 'No cars match your search or filters.'}</p>
        </div>
      ) : (
        <div className={view === 'grid' ? 'garage-grid' : 'garage-list'}>
          {items.map((item) => (
            <CarCard key={item.id} item={item} view={view} />
          ))}
        </div>
      )}

      <div ref={sentinel} aria-hidden style={{ height: 1 }} />
      {query.isFetchingNextPage && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          Loading more…
        </p>
      )}
    </div>
  );
}
