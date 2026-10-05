'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Listing } from '@/domain/marketplace';
import ListingCard from './ListingCard';
import styles from './Market.module.css';

type Page = { items: Listing[]; nextCursor: string | null };

const CONDITIONS = ['mint', 'near-mint', 'good', 'played', 'damaged'];
// Type-filter chips, matching garage-log-147.html's market screen.
const CHIPS = ['All', 'For Sale', 'Exchange', 'New', 'Favorites', 'Trending'] as const;
type Chip = (typeof CHIPS)[number];

async function fetchPage(params: URLSearchParams, cursor: string | null): Promise<Page> {
  const sp = new URLSearchParams(params);
  if (cursor) sp.set('cursor', cursor);
  const res = await fetch(`/api/market?${sp.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load the marketplace.');
  return res.json();
}

export default function MarketView({
  initialListings,
  initialCursor = null,
  signedIn = false,
  harness = false,
}: {
  initialListings: Listing[];
  initialCursor?: string | null;
  signedIn?: boolean;
  harness?: boolean;
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [chip, setChip] = useState<Chip>('All');
  const [brand, setBrand] = useState('all');
  const [condition, setCondition] = useState('all');
  const [allCountries, setAllCountries] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set('q', debouncedQ);
    if (brand !== 'all') sp.set('brand', brand);
    if (condition !== 'all') sp.set('condition', condition);
    if (allCountries) sp.set('country', 'all');
    // Chips map onto the API's type / sort / favourites filters.
    if (chip === 'For Sale') sp.set('type', 'sale');
    else if (chip === 'Exchange') sp.set('type', 'trade');
    else if (chip === 'Trending') sp.set('sort', 'offers');
    else if (chip === 'Favorites' && signedIn) sp.set('favourites', 'true');
    return sp;
  }, [debouncedQ, brand, condition, allCountries, chip, signedIn]);

  const isDefault = params.toString() === '';

  const query = useInfiniteQuery({
    queryKey: ['market', params.toString()],
    queryFn: ({ pageParam }) => fetchPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: isDefault
      ? { pages: [{ items: initialListings, nextCursor: initialCursor }], pageParams: [null] }
      : undefined,
    enabled: !harness,
    refetchOnMount: false,
    staleTime: 30_000,
  });

  const queryItems = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const items = harness ? initialListings : queryItems;

  const brands = useMemo(() => {
    const set = new Set(items.map((i) => i.brand).filter(Boolean));
    if (brand !== 'all') set.add(brand);
    return Array.from(set).sort();
  }, [items, brand]);

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

  const chips = CHIPS.filter((c) => c !== 'Favorites' || signedIn);

  return (
    <div>
      <div className={styles.searchBar}>
        <input placeholder="Search listings…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          type="button"
          className={`btn-secondary ${styles.viewToggle}`}
          onClick={() => setView((v) => (v === 'grid' ? 'list' : 'grid'))}
        >
          {view === 'grid' ? 'List' : 'Grid'}
        </button>
      </div>

      <div className={styles.filterRow}>
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.filterChip} ${chip === c ? styles.active : ''}`}
            onClick={() => setChip(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className={styles.selectRow}>
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
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

      <label className="toggle-row" style={{ marginBottom: 12 }}>
        <span>All countries</span>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={allCountries}
          onChange={(e) => setAllCountries(e.target.checked)}
        />
      </label>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>{query.isFetching ? 'Loading…' : 'No listings match your search or filters.'}</p>
        </div>
      ) : (
        <div className={`${styles.grid} ${view === 'list' ? styles.listView : ''}`}>
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} view={view} />
          ))}
        </div>
      )}

      <div ref={sentinel} aria-hidden style={{ height: 0 }} />
      {query.isFetchingNextPage && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
          Loading more…
        </p>
      )}
    </div>
  );
}
