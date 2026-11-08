import {
  jobHealth,
  jobResultSummary,
  jobRunSeconds,
  KNOWN_JOB_NAMES,
  type JobRunRow,
} from '@/domain/admin';

// /admin/world/economy › "Job runs" (MV-W04-04, F-26, 06 §5). The scheduled-jobs log as two plain
// tables inside the prototype's panel — one row per job with its latest run, then the raw recent
// runs — no charts, no controls (D-027): a run is fired from the Edge Function `jobs` or psql, never
// from a button here. Server-rendered from an admin-only read of job_runs.

const cell: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' };
const head: React.CSSProperties = { ...cell, fontSize: 12, color: 'var(--muted)', fontWeight: 600 };

function when(iso: string | null): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16) + ' UTC';
}

function statusLabel(status: string): string {
  if (status === 'ok') return 'ok';
  if (status === 'error') return 'error';
  return 'running';
}

export default function AdminJobRunsView({ runs }: { runs: JobRunRow[] }) {
  const health = jobHealth(runs);
  const seen = new Set(health.map((h) => h.job));
  const neverRan = KNOWN_JOB_NAMES.filter((j) => !seen.has(j));

  return (
    <div>
      <div className="section-title">Job runs</div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        {runs.length === 0 ? (
          <p className="muted">
            No job has run yet. pg_cron fires <code>run_world_job</code> on its schedules once the
            migration is live; the Edge Function <code>jobs</code> runs one by hand (06 §5).
          </p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={head}>Job</th>
                <th style={head}>Last run</th>
                <th style={head}>Status</th>
                <th style={head}>Result</th>
                <th style={head}>Errors / runs</th>
              </tr>
            </thead>
            <tbody>
              {health.map((h) => (
                <tr key={h.job} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={cell}>
                    <code>{h.job}</code>
                  </td>
                  <td style={cell}>
                    {when(h.latest.started_at)}
                    <span className="muted"> · {h.latest.triggered_by}</span>
                  </td>
                  <td style={{ ...cell, fontWeight: h.latest.status === 'error' ? 700 : 400 }}>
                    {statusLabel(h.latest.status)}
                  </td>
                  <td style={{ ...cell, whiteSpace: 'normal' }}>
                    {h.latest.status === 'error' ? (
                      <span className="field-error">{h.latest.error ?? 'unknown error'}</span>
                    ) : (
                      jobResultSummary(h.latest.result) || <span className="muted">—</span>
                    )}
                  </td>
                  <td style={cell}>
                    {h.errors} / {h.runs}
                  </td>
                </tr>
              ))}
              {neverRan.map((job) => (
                <tr key={job} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={cell}>
                    <code>{job}</code>
                  </td>
                  <td style={cell} className="muted" colSpan={4}>
                    never ran
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Schedules (UTC) — World: quest reset 00:05 daily + 00:10 Monday · expiry notice 00:20 ·
          expiry 00:30 · season rollover hourly · score recompute 02:45. H1 (MV-S9-01): expire
          listings :15 hourly · expire offers :20 hourly · purge trash 03:35 · event partitions
          03:50 · purge media + purge accounts daily 04:00 via the <code>h1-jobs</code> GitHub
          workflow → Edge Function <code>jobs</code>. A red row = read its error, then 06 §5 &quot;a
          job_runs row shows an error&quot;.
        </p>
      </div>

      {runs.length > 0 && (
        <>
          <div className="section-title">Recent runs</div>
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={head}>Started</th>
                  <th style={head}>Job</th>
                  <th style={head}>Via</th>
                  <th style={head}>Status</th>
                  <th style={head}>Seconds</th>
                  <th style={head}>Result / error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const secs = jobRunSeconds(r);
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={cell}>{when(r.started_at)}</td>
                      <td style={cell}>
                        <code>{r.job}</code>
                      </td>
                      <td style={cell}>{r.triggered_by}</td>
                      <td style={{ ...cell, fontWeight: r.status === 'error' ? 700 : 400 }}>
                        {statusLabel(r.status)}
                      </td>
                      <td style={cell}>{secs === null ? '—' : secs}</td>
                      <td style={{ ...cell, whiteSpace: 'normal' }}>
                        {r.status === 'error' ? (
                          <span className="field-error">{r.error ?? 'unknown error'}</span>
                        ) : (
                          jobResultSummary(r.result) || <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
