import Link from 'next/link';

// Admin console overview (F-16). Sub-pages land across sprints; Catalogue + Scan jobs ship in S3.
export default function AdminOverviewPage() {
  return (
    <div className="panel" style={{ padding: 16, marginTop: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href="/admin/reports" className="btn-secondary">
          Reports queue
        </Link>
        <Link href="/admin/users" className="btn-secondary">
          Users
        </Link>
        <Link href="/admin/catalogue" className="btn-secondary">
          Catalogue proposals
        </Link>
        <Link href="/admin/scan-jobs" className="btn-secondary">
          Scan jobs
        </Link>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
        More pages (Overview stats, Flags, Invites) land in later sprints.
      </p>
    </div>
  );
}
