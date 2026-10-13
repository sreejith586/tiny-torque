'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  submitReport,
  ReportError,
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  type ReportReason,
  type ReportTargetType,
} from '@/domain/trust';

const REPORT_ERROR_LABEL: Record<string, string> = {
  rate_limited: "You've sent a lot of reports today — try again tomorrow.",
  not_authorized: 'Sign in to report this.',
};

export default function ReportPrompt({
  targetType,
  targetId,
  targetName,
  label = 'Report',
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetName?: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('other');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="muted" style={{ fontSize: 12 }}>
        Report submitted. Thanks for flagging this.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn-secondary"
        style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      await submitReport(supabase, {
        targetType,
        targetId,
        targetName,
        reason,
        notes: notes.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ReportError
          ? (REPORT_ERROR_LABEL[err.code] ?? 'Could not submit that report.')
          : 'Could not submit that report.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 10, background: 'var(--panel-alt)' }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        Report {targetName ?? 'this'}
      </p>
      <label htmlFor={`report-reason-${targetId}`}>Reason</label>
      <select
        id={`report-reason-${targetId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
        disabled={busy}
      >
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {REPORT_REASON_LABEL[r]}
          </option>
        ))}
      </select>
      <label htmlFor={`report-notes-${targetId}`}>Additional details (optional)</label>
      <textarea
        id={`report-notes-${targetId}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={1000}
        disabled={busy}
        style={{ minHeight: 60, resize: 'none' }}
      />
      {error && <p className="field-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-danger"
          style={{ width: 'auto', padding: '8px 10px', fontSize: 12 }}
          onClick={handleSubmit}
          disabled={busy}
        >
          {busy ? '…' : 'Submit report'}
        </button>
      </div>
    </div>
  );
}
