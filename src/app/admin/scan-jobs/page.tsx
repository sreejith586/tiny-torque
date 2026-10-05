import { createClient } from '@/lib/supabase/server';
import { listRecentScanJobs, scanCostThisMonth } from '@/domain/ai';

export default async function AdminScanJobsPage() {
  const supabase = await createClient();
  const [jobs, monthCost] = await Promise.all([
    listRecentScanJobs(supabase, 100),
    scanCostThisMonth(supabase),
  ]);

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18 }}>Scan jobs</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Last 100 jobs · this month’s AI cost: ${monthCost.toFixed(2)}
      </p>
      {jobs.length === 0 ? (
        <p className="muted">No scan jobs yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>When</th>
                <th style={{ textAlign: 'left' }}>Kind</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Accepted</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{new Date(j.created_at).toLocaleDateString()}</td>
                  <td>{j.kind}</td>
                  <td>{j.status}</td>
                  <td style={{ textAlign: 'right' }}>{j.accepted_count}</td>
                  <td style={{ textAlign: 'right' }}>${Number(j.cost_usd ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
