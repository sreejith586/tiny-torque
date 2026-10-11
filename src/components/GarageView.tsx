'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { GarageItem, GarageSort } from '@/domain/garage';
import { SortIcon } from './icons';
import CarCard from './CarCard';

const SORT_OPTIONS: { value: GarageSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'brand', label: 'Brand A–Z' },
  { value: 'qty', label: 'Quantity (high to low)' },
  { value: 'price', label: 'Price paid (high to low)' },
];

type Page = { items: GarageItem[]; nextCursor: string | null };

const VIEW_KEY = 'mini-vault-garage-view';
const RARITIES = ['common', 'uncommon', 'rare', 'super-rare', 'treasure-hunt', 'chase'];
const CONDITIONS = ['mint', 'near-mint', 'good', 'played', 'damaged'];

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
  const [rarity, setRarity] = useState('all');
  const [condition, setCondition] = useState('all');
  const [publicOnly, setPublicOnly] = useState(false);
  const [favouriteOnly, setFavouriteOnly] = useState(false);
  const [forSaleOnly, setForSaleOnly] = useState(false);
  const [sort, setSort] = useState<GarageSort>('newest');
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const sortPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sortPanelOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (sortPanelRef.current && !sortPanelRef.current.contains(e.target as Node)) {
        setSortPanelOpen(false);
      }
    }
    document.addEventListener('click', onOutsideClick);
    return () => document.removeEventListener('click', onOutsideClick);
  }, [sortPanelOpen]);

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
    if (rarity !== 'all') sp.set('rarity', rarity);
    if (condition !== 'all') sp.set('condition', condition);
    if (publicOnly) sp.set('isPublic', 'true');
    if (favouriteOnly) sp.set('isFavorite', 'true');
    if (forSaleOnly) sp.set('forSale', 'true');
    if (sort !== 'newest') sp.set('sort', sort);
    return sp;
  }, [debouncedQ, brand, rarity, condition, publicOnly, favouriteOnly, forSaleOnly, sort]);

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
        <div className="filter-icon-wrap" ref={sortPanelRef}>
          <button
            type="button"
            className={`filter-icon-btn ${sort !== 'newest' ? 'has-filter' : ''}`}
            onClick={() => setSortPanelOpen((v) => !v)}
            aria-label="Sort your garage"
          >
            <SortIcon size={16} />
            {sort !== 'newest' && <span className="filter-dot" />}
          </button>
          {sortPanelOpen && (
            <div className="filter-dropdown">
              {SORT_OPTIONS.map((o) => (
                <div
                  key={o.value}
                  className={`filter-dropdown-item ${sort === o.value ? 'active' : ''}`}
                  onClick={() => {
                    setSort(o.value);
                    setSortPanelOpen(false);
                  }}
                >
                  {o.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="garage-toolbar">
        <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
          <option value="all">Any rarity</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="all">Any condition</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <label className="toggle-row">
        <span>Public items only</span>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={publicOnly}
          onChange={(e) => setPublicOnly(e.target.checked)}
        />
      </label>
      <label className="toggle-row">
        <span>Favourites only</span>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={favouriteOnly}
          onChange={(e) => setFavouriteOnly(e.target.checked)}
        />
      </label>
      <label className="toggle-row" style={{ marginBottom: 12 }}>
        <span>For sale only</span>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={forSaleOnly}
          onChange={(e) => setForSaleOnly(e.target.checked)}
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

      {/* 0-height so it adds no layout; IntersectionObserver still fires via the 400px rootMargin. */}
      <div ref={sentinel} aria-hidden style={{ height: 0 }} />
      {query.isFetchingNextPage && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          Loading more…
        </p>
      )}
    </div>
  );
}
