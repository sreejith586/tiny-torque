import { createClient } from '@/lib/supabase/server';
import { getPilotKpis } from '@/domain/admin';
import AdminKpisView from '@/components/AdminKpisView';

export const dynamic = 'force-dynamic';

// /admin › Pilot KPIs (MV-S10-03, F-18): the SQL half of the 01 §6 pilot metrics, one row per UTC
// week from the materialised view pilot_kpis_weekly (admin_pilot_kpis RPC). Plain table, no charts
// (D-027). PostHog holds the funnels; docs/pilot/kpi-definitions.md maps each metric to both.
export default async function AdminKpisPage() {
  const supabase = await createClient();
  const weeks = await getPilotKpis(supabase, 12).catch(() => []);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="panel">
        <h2 style={{ fontSize: 18 }}>Pilot KPIs</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Weekly numbers for the pilot success criteria, newest week first. Rebuilt every night;
          Refresh rebuilds it now.
        </p>
      </div>
      <AdminKpisView weeks={weeks} />
    </div>
  );
}
