import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatRevenue, getOverview, overviewCosts } from '@/domain/admin';

export const dynamic = 'force-dynamic';

// Admin console overview (F-16, MV-S10-04): users / items / listings / offers / scans, this
// month's scan cost, token revenue and SMS estimate — one admin-only RPC (admin_overview), no
// charts (D-027). Built from the prototype's own pieces: section-title, stat-tiles, panel, muted,
// btn-secondary.
const LINKS: Array<{ href: string; label: string }> = [
  { href: '/admin/reports', label: 'Reports queue' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/invites', label: 'Invites' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/kpis', label: 'Pilot KPIs' },
  { href: '/admin/catalogue', label: 'Catalogue proposals' },
  { href: '/admin/scan-jobs', label: 'Scan jobs' },
  { href: '/admin/flags', label: 'Feature flags' },
  { href: '/admin/world/economy', label: 'World economy' },
];

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-label">{label}</div>
    </div>
  );
}

const n = (v: number) => v.toLocaleString('en-US');

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const overview = await getOverview(supabase).catch(() => null);
  const costs = overview ? overviewCosts(overview) : null;

  return (
    <div style={{ marginTop: 12 }}>
      {overview && costs ? (
        <>
          <div className="section-title">Overview</div>
          <div className="stat-tiles">
            <Tile
              value={n(overview.users)}
              label={`Collectors · ${n(overview.users_new_7d)} new in 7 d`}
            />
            <Tile value={n(overview.items)} label="Cars in garages" />
            <Tile value={n(overview.listings_active)} label="Active listings" />
            <Tile
              value={n(overview.offers_total)}
              label={`Offers · ${n(overview.offers_pending)} pending`}
            />
            <Tile value={n(overview.deals_completed)} label="Completed deals" />
            <Tile value={n(overview.scans_month)} label="Scans this month" />
          </div>

          <div className="section-title">Costs and revenue this month (UTC)</div>
          <div className="stat-tiles">
            <Tile value={`$${costs.scanCostUsd.toFixed(2)}`} label="AI scan cost" />
            <Tile
              value={formatRevenue(costs.tokenRevenue)}
              label={`Token revenue · ${n(costs.tokenPurchases)} purchase${costs.tokenPurchases === 1 ? '' : 's'}`}
            />
            <Tile value={`$${costs.smsEstimateUsd.toFixed(2)}`} label="SMS estimate" />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            SMS estimate = {n(costs.smsUsers)} phone collectors active this month × 2 codes × $0.05
            (placeholder rate until there is a provider invoice). Scan cost is the sum logged per
            scan job.
          </p>

          <div className="panel" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>
              <Link href="/admin/reports">
                {n(overview.open_reports)} open report{overview.open_reports === 1 ? '' : 's'}
              </Link>{' '}
              ·{' '}
              <Link href="/admin/feedback">
                {n(overview.feedback_7d)} feedback message{overview.feedback_7d === 1 ? '' : 's'} in
                7 days
              </Link>
            </p>
          </div>
        </>
      ) : (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            Overview numbers are not available on this environment yet.
          </p>
        </div>
      )}

      <div className="panel" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="btn-secondary">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
