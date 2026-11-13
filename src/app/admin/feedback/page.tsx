import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listFeedback } from '@/domain/admin';

export const dynamic = 'force-dynamic';

// /admin › Feedback (MV-S10-05, F-15 "feedback/bug form → admin notifications"). The Settings
// form writes `feedback`; a trigger notifies every admin (feedback_received → this page). Admin-only
// read under RLS; one panel per message (D-027 rule 12).
const KIND_LABEL: Record<string, string> = { bug: 'Bug', idea: 'Idea', other: 'Other' };

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const items = await listFeedback(supabase, 100).catch(() => []);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="panel">
        <h2 style={{ fontSize: 18 }}>Feedback</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          The newest 100 messages from Settings › Send feedback.
        </p>
      </div>
      {items.length === 0 ? (
        <div className="panel" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            No feedback yet.
          </p>
        </div>
      ) : (
        items.map((f) => (
          <div key={f.id} className="panel" style={{ marginTop: 8 }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
            >
              <strong>{KIND_LABEL[f.kind] ?? f.kind}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {f.created_at.replace('T', ' ').slice(0, 16)} UTC
              </span>
            </div>
            <p style={{ margin: '8px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {f.message}
            </p>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              {f.handle ? (
                <Link href={`/u/${f.handle}`}>@{f.handle}</Link>
              ) : (
                (f.display_name ?? 'Deleted collector')
              )}
              {f.page ? ` · from ${f.page}` : ''}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
