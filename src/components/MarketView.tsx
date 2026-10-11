'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { favoriteListing, unfavoriteListing, type Listing } from '@/domain/marketplace';
import { FilterIcon } from './icons';
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
  userId,
  initialFavoriteIds = [],
}: {
  initialListings: Listing[];
  initialCursor?: string | null;
  signedIn?: boolean;
  harness?: boolean;
  userId?: string;
  initialFavoriteIds?: string[];
}) {
  const supabase = createClient();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [chip, setChip] = useState<Chip>('All');
  const [brand, setBrand] = useState('all');
  const [condition, setCondition] = useState('all');
  const [allCountries, setAllCountries] = useState(false);
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const brandPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!brandPanelOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (brandPanelRef.current && !brandPanelRef.current.contains(e.target as Node)) {
        setBrandPanelOpen(false);
      }
    }
    document.addEventListener('click', onOutsideClick);
    return () => document.removeEventListener('click', onOutsideClick);
  }, [brandPanelOpen]);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(initialFavoriteIds));

  function handleToggleFavorite(listingId: string, next: boolean) {
    if (!userId) return;
    setFavoriteIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(listingId);
      else copy.delete(listingId);
      return copy;
    });
    const op = next
      ? favoriteListing(supabase, userId, listingId)
      : unfavoriteListing(supabase, userId, listingId);
    op.catch(() => {
      // revert on failure
      setFavoriteIds((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(listingId);
        else copy.add(listingId);
        return copy;
      });
    });
  }

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
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="all">Any condition</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="filter-icon-wrap" ref={brandPanelRef}>
          <button
            type="button"
            className={`filter-icon-btn ${brand !== 'all' ? 'has-filter' : ''}`}
            onClick={() => setBrandPanelOpen((v) => !v)}
            aria-label="Filter by brand"
          >
            <FilterIcon size={16} />
            {brand !== 'all' && <span className="filter-dot" />}
          </button>
          {brandPanelOpen && (
            <div className="filter-dropdown">
              <div
                className={`filter-dropdown-item ${brand === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setBrand('all');
                  setBrandPanelOpen(false);
                }}
              >
                All
              </div>
              {brands.map((b) => (
                <div
                  key={b}
                  className={`filter-dropdown-item ${brand === b ? 'active' : ''}`}
                  onClick={() => {
                    setBrand(b);
                    setBrandPanelOpen(false);
                  }}
                >
                  {b}
                </div>
              ))}
            </div>
          )}
        </div>
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
            <ListingCard
              key={listing.id}
              listing={listing}
              view={view}
              favorited={favoriteIds.has(listing.id)}
              onToggleFavorite={userId ? handleToggleFavorite : undefined}
            />
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
