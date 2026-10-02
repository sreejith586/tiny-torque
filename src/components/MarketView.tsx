'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Listing, MarketSort } from '@/domain/marketplace';
import ListingCard from './ListingCard';

type Page = { items: Listing[]; nextCursor: string | null };

const CONDITIONS = ['mint', 'near-mint', 'good', 'played', 'damaged'];

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
  /** Visual-baseline harness: show the seeded fixtures and never fetch (the public feed would
   * otherwise replace them with the empty live list). */
  harness?: boolean;
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [brand, setBrand] = useState('all');
  const [type, setType] = useState<'all' | 'sale' | 'trade' | 'both'>('all');
  const [condition, setCondition] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [allCountries, setAllCountries] = useState(false);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [sort, setSort] = useState<MarketSort>('newest');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set('q', debouncedQ);
    if (brand !== 'all') sp.set('brand', brand);
    if (type !== 'all') sp.set('type', type);
    if (condition !== 'all') sp.set('condition', condition);
    if (minPrice) sp.set('minPrice', minPrice);
    if (maxPrice) sp.set('maxPrice', maxPrice);
    if (allCountries) sp.set('country', 'all');
    if (favouritesOnly && signedIn) sp.set('favourites', 'true');
    if (sort !== 'newest') sp.set('sort', sort);
    return sp;
  }, [
    debouncedQ,
    brand,
    type,
    condition,
    minPrice,
    maxPrice,
    allCountries,
    favouritesOnly,
    signedIn,
    sort,
  ]);

  const isDefault = params.toString() === '';

  const query = useInfiniteQuery({
    queryKey: ['market', params.toString()],
    queryFn: ({ pageParam }) => fetchPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: isDefault
      ? { pages: [{ items: initialListings, nextCursor: initialCursor }], pageParams: [null] }
      : undefined,
    // The SSR-seeded default page is already fresh — don't immediately refetch it on mount.
    // Filter changes use a new queryKey and fetch normally. Under the baseline harness, disable
    // fetching entirely so the seeded fixtures are what gets screenshotted.
    enabled: !harness,
    refetchOnMount: false,
    staleTime: 30_000,
  });

  const queryItems = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  // Under the harness the query is disabled; render the SSR-seeded listings directly so the
  // baseline screenshot is deterministic regardless of TanStack's disabled-query data handling.
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

  return (
    <div>
      <div className="garage-toolbar">
        <input
          placeholder="Search listings…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', padding: '10px 12px' }}
          onClick={() => setView((v) => (v === 'grid' ? 'list' : 'grid'))}
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
        <select value={sort} onChange={(e) => setSort(e.target.value as MarketSort)}>
          <option value="newest">Newest first</option>
          <option value="price_asc">Price (low to high)</option>
          <option value="price_desc">Price (high to low)</option>
          <option value="offers">Most offers</option>
        </select>
      </div>

      <div className="garage-toolbar">
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">Sale &amp; trade</option>
          <option value="sale">For sale</option>
          <option value="trade">For trade</option>
          <option value="both">Sale or trade</option>
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

      <div className="garage-toolbar">
        <input
          type="number"
          min="0"
          placeholder="Min price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </div>

      <label className="toggle-row">
        <span>All countries</span>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={allCountries}
          onChange={(e) => setAllCountries(e.target.checked)}
        />
      </label>
      {signedIn && (
        <label className="toggle-row" style={{ marginBottom: 12 }}>
          <span>Favourites only</span>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={favouritesOnly}
            onChange={(e) => setFavouritesOnly(e.target.checked)}
          />
        </label>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <p>{query.isFetching ? 'Loading…' : 'No listings match your search or filters.'}</p>
        </div>
      ) : (
        <div className={view === 'grid' ? 'garage-grid' : 'garage-list'}>
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
