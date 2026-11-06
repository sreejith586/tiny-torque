import type { Metadata } from 'next';
import Link from 'next/link';
import CarCard from '@/components/CarCard';
import { loadWorldPage } from './_data';

export const metadata: Metadata = {
  title: 'Collectors World',
};

// /world home (MV-W02-01, D-081 proposed): your garage card, then the two placeholders 08 names
// — "Open garages" (visits, W03) and "Today's quests" (earn engine, W04) — as honest empty states.
export default async function WorldHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { own, items } = await loadWorldPage(await searchParams, { next: '/world' });
  const featured = own.garage.featured_item_id
    ? (items.find((i) => i.id === own.garage.featured_item_id) ?? null)
    : null;
  const placed = own.layout.slots.length;

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Collectors World</h1>
      <p className="page-sub">Your garage as a place — build it, open it, show your cars.</p>

      <div className="section-title">Your garage</div>
      <div className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <h2 style={{ fontSize: 18 }}>{own.garage.name}</h2>
          <span className="level-pill">
            Level {own.level.level} · {own.level.name}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {placed} of {own.displayCapacity} display slots filled
          {own.garage.score > 0 ? ` · ${own.garage.score} garage points` : ''}
        </p>
        <div style={{ margin: '12px auto 0', maxWidth: 320 }}>
          {featured ? (
            <div className="garage-grid" style={{ gridTemplateColumns: '1fr' }}>
              <CarCard item={featured} view="grid" />
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 18 }}>
              <p>No featured car yet.</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Link
            href="/world/garage"
            className="btn-primary"
            style={{ flex: 1, textAlign: 'center' }}
          >
            Arrange garage
          </Link>
          <Link
            href="/world/shop"
            className="btn-secondary"
            style={{ flex: 1, textAlign: 'center' }}
          >
            Shop
          </Link>
        </div>
      </div>

      <div className="section-title">Open garages</div>
      <div className="empty-state">
        <p>Visiting other collectors&apos; garages opens in the next release.</p>
      </div>

      <div className="section-title">Today&apos;s quests</div>
      <div className="empty-state">
        <p>Quests and credit rewards arrive with the earn update.</p>
      </div>
    </main>
  );
}
