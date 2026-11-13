'use client';

// /admin › World › Hosting (MV-W07-05, F-28): the meetup / club report queues and the hosting
// suspensions. Same pieces as the reports queue and the economy dashboard (panel, plain table,
// native inputs, btn-secondary / btn-danger) — no new components (D-027).
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { resolveReport, ReportError, type AdminReportAction } from '@/domain/trust';
import { setHostSuspension } from '@/domain/admin';

export interface HostingReportItem {
  id: string;
  kind: 'meetup' | 'club';
  targetName: string;
  targetHref: string | null;
  targetNote: string;
  /** The host (meetup) or the owner (club) the report resolves against; null when it is gone. */
  subjectId: string | null;
  subject: { name: string; handle: string | null } | null;
  reason: string | null;
  notes: string | null;
  reporter: string | null;
  createdAt: string;
}

export interface HostingSuspensionItem {
  id: string;
  userId: string;
  user: { name: string; handle: string | null } | null;
  reason: string;
  note: string | null;
  appealNote: string | null;
  suspendedAt: string;
  liftedAt: string | null;
}

type QueueAction = Extract<AdminReportAction, 'warn' | 'suspend' | 'dismiss'>;

const ACTION_LABEL: Record<QueueAction, string> = {
  warn: 'Uphold + warn',
  suspend: 'Uphold + suspend account (7 days)',
  dismiss: 'Dismiss',
};
const ACTION_CONFIRM: Record<QueueAction, string> = {
  warn: 'Uphold this report and send the host a warning? An upheld report blocks hosting for 90 days; a second one suspends hosting.',
  suspend: "Uphold this report and suspend the host's account for 7 days?",
  dismiss: 'Dismiss this report with no action?',
};

const day = (iso: string) => iso.slice(0, 10);

function ReportCard({
  item,
  onResolved,
}: {
  item: HostingReportItem;
  onResolved: (id: string) => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions: QueueAction[] = item.subjectId ? ['warn', 'suspend', 'dismiss'] : ['dismiss'];

  async function run(action: QueueAction) {
    if (!window.confirm(ACTION_CONFIRM[action])) return;
    setBusy(true);
    setError(null);
    try {
      await resolveReport(createClient(), {
        reportId: item.id,
        action,
        note: note.trim() || undefined,
      });
      onResolved(item.id);
    } catch (err) {
      setError(
        err instanceof ReportError
          ? `Could not resolve this report (${err.code}).`
          : 'Could not resolve this report.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <strong>
          {item.targetHref ? (
            <Link href={item.targetHref}>{item.targetName}</Link>
          ) : (
            item.targetName
          )}
        </strong>
        <span className="muted" style={{ fontSize: 12 }}>
          {day(item.createdAt)}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        {item.targetNote} · {item.kind === 'meetup' ? 'host' : 'owner'}{' '}
        {item.subject
          ? `${item.subject.name}${item.subject.handle ? ` (@${item.subject.handle})` : ''}`
          : 'unknown'}
      </p>
      <p style={{ fontSize: 13, marginTop: 6 }}>
        {item.reason ?? 'No reason given'}
        {item.notes ? ` — ${item.notes}` : ''}
      </p>
      <p className="muted" style={{ fontSize: 12 }}>
        Reported by {item.reporter ?? 'a collector'}
      </p>
      <label htmlFor={`hr-note-${item.id}`} style={{ marginTop: 8 }}>
        Resolution note (sent with a warning)
      </label>
      <input
        id={`hr-note-${item.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            className={a === 'dismiss' ? 'btn-secondary' : 'btn-danger'}
            style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}
            disabled={busy}
            onClick={() => run(a)}
          >
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function SuspensionRow({
  item,
  onChanged,
}: {
  item: HostingSuspensionItem;
  onChanged: (next: HostingSuspensionItem) => void;
}) {
  const [note, setNote] = useState(item.appealNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = item.liftedAt === null;

  async function run(action: 'lift' | 'note') {
    if (action === 'lift' && !window.confirm('Lift this hosting suspension?')) return;
    setBusy(true);
    setError(null);
    try {
      const row = await setHostSuspension(createClient(), item.userId, action, note);
      onChanged({ ...item, appealNote: row.appeal_note, liftedAt: row.lifted_at });
    } catch {
      setError(action === 'note' ? 'Write the appeal note first.' : 'Could not lift it.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        {item.user?.name ?? 'Collector'}
        {item.user?.handle ? (
          <span className="muted" style={{ fontSize: 12 }}>
            {' '}
            @{item.user.handle}
          </span>
        ) : null}
      </td>
      <td>{item.reason === 'upheld_reports' ? 'Two upheld reports' : 'Admin'}</td>
      <td>{day(item.suspendedAt)}</td>
      <td>{active ? 'In force' : `Lifted ${day(item.liftedAt!)}`}</td>
      <td>
        {active ? (
          <>
            <input
              aria-label={`Appeal note for ${item.user?.name ?? 'collector'}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder="Appeal note"
            />
            <span style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                disabled={busy}
                onClick={() => run('note')}
              >
                Save note
              </button>
              <button
                type="button"
                className="btn-danger"
                style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                disabled={busy}
                onClick={() => run('lift')}
              >
                Lift
              </button>
            </span>
            {error && <span className="field-error">{error}</span>}
          </>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>
            {item.appealNote ?? '—'}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function AdminHostingView({
  initialReports,
  initialSuspensions,
}: {
  initialReports: HostingReportItem[];
  initialSuspensions: HostingSuspensionItem[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [suspensions, setSuspensions] = useState(initialSuspensions);
  const resolved = (id: string) => setReports((prev) => prev.filter((r) => r.id !== id));
  const queue = (kind: 'meetup' | 'club') => reports.filter((r) => r.kind === kind);

  return (
    <>
      {(['meetup', 'club'] as const).map((kind) => (
        <section key={kind} aria-label={`${kind} reports`}>
          <div className="section-title">
            {kind === 'meetup' ? 'Meetup reports' : 'Club reports'} ({queue(kind).length})
          </div>
          {queue(kind).length === 0 ? (
            <div className="empty-state">
              <p>No open {kind} reports.</p>
            </div>
          ) : (
            queue(kind).map((item) => (
              <ReportCard key={item.id} item={item} onResolved={resolved} />
            ))
          )}
        </section>
      ))}

      <div className="section-title">Hosting suspensions</div>
      {suspensions.length === 0 ? (
        <div className="empty-state">
          <p>No hosting suspensions.</p>
        </div>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th scope="col">Collector</th>
                <th scope="col">Reason</th>
                <th scope="col">Since</th>
                <th scope="col">Status</th>
                <th scope="col">Appeal</th>
              </tr>
            </thead>
            <tbody>
              {suspensions.map((s) => (
                <SuspensionRow
                  key={s.id}
                  item={s}
                  onChanged={(next) =>
                    setSuspensions((prev) => prev.map((x) => (x.id === next.id ? next : x)))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
