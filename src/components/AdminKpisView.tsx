'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  formatRevenue,
  pilotKpiRatios,
  refreshPilotKpis,
  revenueByCurrency,
  type PilotKpiRow,
} from '@/domain/admin';

// /admin/kpis (MV-S10-03, F-18). Two plain tables inside the prototype's panels — the ratios the
// pilot is judged on (01 §6, with their targets in the header) and the raw weekly counts — plus
// one Refresh button. No charts (D-027).

const cell: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' };
const head: React.CSSProperties = { ...cell, fontSize: 12, color: 'var(--muted)', fontWeight: 600 };
const left: React.CSSProperties = { textAlign: 'left' };

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const num = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-US'));

export default function AdminKpisView({ weeks }: { weeks: PilotKpiRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const run = await refreshPilotKpis(createClient());
      if (run.status !== 'ok') throw new Error(run.error ?? 'refresh_failed');
      router.refresh();
    } catch {
      setError('Could not refresh the numbers. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ margin: '12px 0' }}>
        <button type="button" className="btn-secondary" onClick={refresh} disabled={busy}>
          {busy ? 'Refreshing…' : 'Refresh now'}
        </button>
        {error && <p className="field-error">{error}</p>}
      </div>

      <div className="section-title">Success criteria by week (UTC weeks, Monday)</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        {weeks.length === 0 ? (
          <p className="muted">No KPI rows yet.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...head, ...left }}>Week</th>
                <th style={head}>Activation ≥ 60%</th>
                <th style={head}>Scan share ≥ 40%</th>
                <th style={head}>Scan accepted ≥ 60%</th>
                <th style={head}>Publishers ≥ 35%</th>
                <th style={head}>Offers ÷ live listing</th>
                <th style={head}>Token buyers ÷ WAU ≥ 8%</th>
                <th style={head}>W4 retention ≥ 40%</th>
                <th style={head}>Reports actioned &lt; 2%</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => {
                const r = pilotKpiRatios(w);
                return (
                  <tr key={w.week_start} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...cell, ...left }}>{w.week_start}</td>
                    <td style={cell}>{pct(r.activation)}</td>
                    <td style={cell}>{pct(r.scanShare)}</td>
                    <td style={cell}>{pct(r.scanAcceptance)}</td>
                    <td style={cell}>{pct(r.publisherShare)}</td>
                    <td style={cell}>{r.offersPerListing === null ? '—' : r.offersPerListing}</td>
                    <td style={cell}>{pct(r.tokenConversion)}</td>
                    <td style={cell}>{pct(r.retentionW4)}</td>
                    <td style={cell}>{pct(r.reportsActionedShare)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          Activation, publishers and W4 retention are cohort numbers: they describe the collectors
          who signed up in that week, so recent weeks keep moving. Offers ÷ live listing is weekly
          (the pilot target is 0.5 a month). Page speed and error rate come from Vercel and Sentry.
        </p>
      </div>

      <div className="section-title">Weekly counts</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        {weeks.length === 0 ? (
          <p className="muted">No KPI rows yet.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...head, ...left }}>Week</th>
                <th style={head}>Sign-ups</th>
                <th style={head}>WAU</th>
                <th style={head}>Cars added</th>
                <th style={head}>Scans</th>
                <th style={head}>Scan cost</th>
                <th style={head}>Listings</th>
                <th style={head}>Offers</th>
                <th style={head}>Deals done</th>
                <th style={head}>With review</th>
                <th style={head}>Token revenue</th>
                <th style={head}>Reports</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week_start} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...cell, ...left }}>{w.week_start}</td>
                  <td style={cell}>{num(w.signups)}</td>
                  <td style={cell}>{num(w.wau)}</td>
                  <td style={cell}>{num(w.items_added)}</td>
                  <td style={cell}>{num(w.scans)}</td>
                  <td style={cell}>${(Number(w.scan_cost_usd) || 0).toFixed(2)}</td>
                  <td style={cell}>{num(w.listings_published)}</td>
                  <td style={cell}>{num(w.offers_created)}</td>
                  <td style={cell}>{num(w.deals_completed)}</td>
                  <td style={cell}>{num(w.deals_reviewed)}</td>
                  <td style={cell}>{formatRevenue(revenueByCurrency(w.token_revenue))}</td>
                  <td style={cell}>{num(w.reports_created)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
