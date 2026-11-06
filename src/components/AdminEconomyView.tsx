import { economyWeekRatios, type EconomySummaryRow, type EconomyWeeklyRow } from '@/domain/admin';

// /admin/world/economy (MV-W05-05, F-28, 07 §3.4, D-094 proposed). Plain tables inside the
// prototype's panels — SQL over the ledger, no charts (D-027 "no dashboards with charts beyond
// Top Brands"), no second balance. Server-rendered from two admin-only RPCs.

const METRIC_LABEL: Record<string, string> = {
  world_active_users: 'World-active users',
  median_balance: 'Median balance',
  p90_balance: 'P90 balance (hoarding tail)',
  earned_outstanding: 'Earned tokens outstanding',
  purchased_outstanding: 'Purchased tokens outstanding',
  earn_user_days_7d: 'Earning user-days (7 d)',
  earn_cap_hits_7d: 'User-days at the ceiling (7 d)',
  breakage_total: 'Breakage (expired earned tokens)',
  frozen_users: 'Users with an earn freeze',
  median_days_to_first_world_spend: 'Median days to first World spend',
};

function ratio(n: number | null, suffix = ''): string {
  return n === null ? '—' : `${n}${suffix}`;
}

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`;
}

const cell: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' };
const head: React.CSSProperties = { ...cell, fontSize: 12, color: 'var(--muted)', fontWeight: 600 };

export default function AdminEconomyView({
  weekly,
  summary,
}: {
  weekly: EconomyWeeklyRow[];
  summary: EconomySummaryRow[];
}) {
  const capHits = summary.find((r) => r.metric === 'earn_cap_hits_7d')?.value ?? 0;
  const earnDays = summary.find((r) => r.metric === 'earn_user_days_7d')?.value ?? 0;
  const capRate = earnDays > 0 ? capHits / earnDays : null;

  return (
    <div>
      <div className="section-title">This week and the last seven (UTC weeks, Monday)</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        {weekly.length === 0 ? (
          <p className="muted">No ledger activity yet.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: 'left' }}>Week</th>
                <th style={head}>Earned</th>
                <th style={head}>Purchased</th>
                <th style={head}>Spent</th>
                <th style={head}>Sinks ÷ sources</th>
                <th style={head}>Earned share of spend</th>
                <th style={head}>World share</th>
                <th style={head}>Expired</th>
                <th style={head}>Refunded</th>
                <th style={head}>Earners</th>
                <th style={head}>Spenders</th>
                <th style={head}>Buyers</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w) => {
                const r = economyWeekRatios(w);
                return (
                  <tr key={w.week_start} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...cell, textAlign: 'left' }}>{w.week_start}</td>
                    <td style={cell}>{w.earned}</td>
                    <td style={cell}>{w.purchased}</td>
                    <td style={cell}>{w.spent}</td>
                    <td style={cell}>{ratio(r.sinksOverSources)}</td>
                    <td style={cell}>{pct(r.earnedShareOfSpend)}</td>
                    <td style={cell}>{pct(r.worldShareOfSpend)}</td>
                    <td style={cell}>{w.expired}</td>
                    <td style={cell}>{w.refunded}</td>
                    <td style={cell}>{w.earners}</td>
                    <td style={cell}>{w.spenders}</td>
                    <td style={cell}>{w.buyers}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Sinks ÷ sources = tokens spent ÷ tokens earned (target &gt; 1.2 for active users). Earned
          share = how much of the spend was funded by earned tokens (FIFO earned-first).
        </p>
      </div>

      <div className="section-title">Right now</div>
      <div className="panel">
        {summary.length === 0 ? (
          <p className="muted">Nothing to show.</p>
        ) : (
          <>
            {summary.map((row) => (
              <div className="toggle-row" key={row.metric}>
                <span>
                  <span style={{ display: 'block' }}>{METRIC_LABEL[row.metric] ?? row.metric}</span>
                  {row.note && (
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                      {row.note}
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}
            <div className="toggle-row">
              <span>
                <span style={{ display: 'block' }}>Earn-cap hit rate (7 d)</span>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                  user-days at the ceiling ÷ user-days with any earn
                </span>
              </span>
              <span style={{ fontWeight: 700 }}>{pct(capRate)}</span>
            </div>
          </>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Weekly review: 06 §5 &quot;World economy weekly review&quot;. Per-user earn freeze lives on
        the Users page; the global freeze is the <code>world_earn</code> flag audience.
      </p>
    </div>
  );
}
