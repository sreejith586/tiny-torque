'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resolveReport, ReportError, type ReportRow, type AdminReportAction } from '@/domain/trust';
import type { Listing } from '@/domain/marketplace';
import type { PublicProfileRow } from '@/types/database';

type Item = {
  report: ReportRow;
  listingPreview: Listing | null;
  userPreview: PublicProfileRow | null;
  reporterName: string | null;
};

const ACTION_LABEL: Record<AdminReportAction, string> = {
  dismiss: 'Dismiss',
  remove_listing: 'Remove listing',
  warn: 'Warn',
  suspend: 'Suspend (7 days)',
};

const ACTION_CONFIRM: Record<AdminReportAction, string> = {
  dismiss: 'Dismiss this report with no action?',
  remove_listing: 'Remove this listing? It will no longer be visible to anyone.',
  warn: 'Send this user a warning notification?',
  suspend: "Suspend this user's account for 7 days?",
};

function ReportRowCard({ item, onResolved }: { item: Item; onResolved: (id: string) => void }) {
  const { report, listingPreview, userPreview, reporterName } = item;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<AdminReportAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions: AdminReportAction[] =
    report.target_type === 'listing'
      ? ['remove_listing', 'warn', 'suspend', 'dismiss']
      : report.target_type === 'user'
        ? ['warn', 'suspend', 'dismiss']
        : ['dismiss'];

  async function run(action: AdminReportAction) {
    if (!window.confirm(ACTION_CONFIRM[action])) return;
    setBusy(action);
    setError(null);
    try {
      const supabase = createClient();
      await resolveReport(supabase, {
        reportId: report.id,
        action,
        note: note.trim() || undefined,
      });
      onResolved(report.id);
    } catch (err) {
      setError(
        err instanceof ReportError
          ? `Could not resolve this report (${err.code}).`
          : 'Could not resolve this report.'
      );
    } finally {
      setBusy(null);
    }
  }

  const preview = listingPreview && `${listingPreview.brand} ${listingPreview.model ?? ''}`.trim();

  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {report.target_type}:{' '}
          {preview || userPreview?.display_name || report.target_name || report.target_id}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {new Date(report.created_at).toLocaleDateString()}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
        Reason: {report.reason ?? '—'} · Reported by {reporterName ?? 'a collector'}
      </p>
      {report.notes && (
        <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, fontStyle: 'italic' }}>
          &ldquo;{report.notes}&rdquo;
        </p>
      )}
      <label htmlFor={`note-${report.id}`}>Resolution note (optional)</label>
      <textarea
        id={`note-${report.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        disabled={busy !== null}
        style={{ minHeight: 50, resize: 'none' }}
      />
      {error && <p className="field-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            className={action === 'suspend' ? 'btn-danger' : 'btn-secondary'}
            style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
            disabled={busy !== null}
            onClick={() => run(action)}
          >
            {busy === action ? '…' : ACTION_LABEL[action]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminReportsQueueView({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);

  function handleResolved(reportId: string) {
    setItems((prev) => prev.filter((i) => i.report.id !== reportId));
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No open reports.</p>
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => (
        <ReportRowCard key={item.report.id} item={item} onResolved={handleResolved} />
      ))}
    </div>
  );
}
