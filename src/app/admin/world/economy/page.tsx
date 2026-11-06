import { createClient } from '@/lib/supabase/server';
import { getEconomySummary, getEconomyWeekly } from '@/domain/admin';
import AdminEconomyView from '@/components/AdminEconomyView';

export const dynamic = 'force-dynamic';

// /admin › World › Economy (MV-W05-05, F-28, 07 §3.4). Admin-gated by the layout + proxy; the two
// RPCs re-check is_admin() themselves. Plain tables, no charts (D-027).
export default async function AdminWorldEconomyPage() {
  const supabase = await createClient();
  const [weekly, summary] = await Promise.all([
    getEconomyWeekly(supabase, 8).catch(() => []),
    getEconomySummary(supabase).catch(() => []),
  ]);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="panel">
        <h2 style={{ fontSize: 18 }}>World economy</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Sinks vs sources, earned vs purchased, ceiling hits and breakage — straight from the
          ledger&apos;s <code>source</code> / <code>reason</code> columns.
        </p>
      </div>
      <AdminEconomyView weekly={weekly} summary={summary} />
    </div>
  );
}
