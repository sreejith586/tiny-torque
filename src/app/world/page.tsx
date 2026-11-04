import type { Metadata } from 'next';
import Link from 'next/link';
import CarCard from '@/components/CarCard';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/domain/identity';
import {
  listOpenGarages,
  listRecentVisitors,
  type RecentVisitor,
  type WorldOpenGarageRow,
} from '@/domain/world';
import {
  FIXTURE_PROFILE,
  FIXTURE_WORLD_OPEN,
  FIXTURE_WORLD_VISITORS,
  isVisualHarness,
} from '@/lib/visual-fixtures';
import { loadWorldPage } from './_data';

export const metadata: Metadata = {
  title: 'Collectors World',
};

type SearchParams = Record<string, string | string[] | undefined>;

/** "Open garages" (own country by default, `?country=all` widens) + the owner's recent visitors. */
async function loadSocial(sp: SearchParams, userId: string) {
  const wantAll = sp.country === 'all';
  if (isVisualHarness(sp)) {
    const country = FIXTURE_PROFILE.country_code;
    return {
      country,
      showingAll: wantAll,
      open: wantAll
        ? FIXTURE_WORLD_OPEN
        : FIXTURE_WORLD_OPEN.filter((g) => g.country_code === country),
      visitors: FIXTURE_WORLD_VISITORS,
    };
  }
  const supabase = await createClient();
  const profile = await getProfile(supabase, userId).catch(() => null);
  const country = profile?.country_code ?? null;
  const [open, visitors] = await Promise.all([
    listOpenGarages(supabase, { country: wantAll ? 'all' : undefined, limit: 20 }, country).catch(
      (): WorldOpenGarageRow[] => []
    ),
    listRecentVisitors(supabase, userId).catch((): RecentVisitor[] => []),
  ]);
  return { country, showingAll: wantAll || !country, open, visitors };
}

// /world home (MV-W02-01, D-081) + Open garages and recent visitors (MV-W03-05, D-087).
export default async function WorldHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { own, items } = await loadWorldPage(sp, { next: '/world' });
  const social = await loadSocial(sp, own.garage.user_id);
  const featured = own.garage.featured_item_id
    ? (items.find((i) => i.id === own.garage.featured_item_id) ?? null)
    : null;
  const placed = own.layout.slots.length;
  const openList = social.open.filter((g) => g.user_id !== own.garage.user_id);
  // keep the fixture harness on when toggling the country chips (preview review, Playwright)
  const chipHref = (all: boolean) =>
    `/world?${[all ? 'country=all' : '', isVisualHarness(sp) ? '__visual=1' : '']
      .filter(Boolean)
      .join('&')}`.replace(/\?$/, '');

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
          {` · ${own.garage.visit_count} visit${own.garage.visit_count === 1 ? '' : 's'} · ${own.garage.kudos_count} kudos`}
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

      <div className="section-title">Recent visitors</div>
      {social.visitors.length === 0 ? (
        <div className="empty-state">
          <p>No visitors yet. Share your garage from the editor to invite someone.</p>
        </div>
      ) : (
        <div className="panel">
          {social.visitors.map((v) => (
            <div className="toggle-row" key={`${v.visitorId}-${v.visitedOn}`}>
              <Link href={`/u/${v.handle}`}>
                {v.displayName} <span className="muted">@{v.handle}</span>
              </Link>
              <span className="muted" style={{ fontSize: 12 }}>
                {v.visitedOn}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Open garages</div>
      <div className="tab-row">
        <Link
          href={chipHref(false)}
          className={`tab-chip ${social.showingAll ? '' : 'active'}`}
          aria-current={social.showingAll ? undefined : 'page'}
        >
          {social.country ? `Near you (${social.country})` : 'Near you'}
        </Link>
        <Link
          href={chipHref(true)}
          className={`tab-chip ${social.showingAll ? 'active' : ''}`}
          aria-current={social.showingAll ? 'page' : undefined}
        >
          All
        </Link>
      </div>
      {openList.length === 0 ? (
        <div className="empty-state">
          <p>
            No open garages {social.showingAll ? 'yet' : 'near you yet'}. Yours could be the first.
          </p>
        </div>
      ) : (
        <div className="panel">
          {openList.map((g) => (
            <Link
              key={g.user_id ?? g.handle ?? ''}
              href={`/world/g/${g.handle}`}
              className="toggle-row"
              style={{ textDecoration: 'none' }}
            >
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{g.name}</span>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                  @{g.handle} · Level {g.level}
                  {g.city ? ` · ${g.city}` : ''}
                </span>
              </span>
              <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {g.kudos_count ?? 0} kudos · {g.visit_count ?? 0} visits
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="section-title">Today&apos;s quests</div>
      <div className="empty-state">
        <p>Quests and credit rewards arrive with the earn update.</p>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        Visiting, kudos and guestbooks follow the{' '}
        <Link href="/legal/guidelines">community guidelines</Link>.
      </p>
    </main>
  );
}
