import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Not found' };

// MV-S9-06: the app-wide 404 (unknown routes, notFound() from a page). Real 404 status, prototype
// pieces only (panel, muted, btn-primary).
export default function NotFound() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <div className="panel" style={{ textAlign: 'center', padding: 28 }}>
        <h1 className="page-heading" style={{ fontSize: 20 }}>
          Nothing parked here
        </h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          That page does not exist or is no longer available.
        </p>
        <Link
          href="/garage"
          className="btn-primary"
          style={{ marginTop: 14, display: 'inline-block', width: 'auto', padding: '10px 18px' }}
        >
          Back to my garage
        </Link>
      </div>
    </main>
  );
}
