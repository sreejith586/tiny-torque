import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Offline' };

// MV-S9-02 (F-17): the page the service worker serves when a navigation fails offline and no cached
// garage exists. Static (no data), precached at install (public/sw.js PRECACHE). Composed only from
// the prototype's pieces (panel, muted, btn-primary — D-027).
export default function OfflinePage() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <div className="panel" style={{ textAlign: 'center', padding: 28 }}>
        <h1 className="page-heading" style={{ fontSize: 20 }}>
          You&apos;re offline
        </h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Tiny Torque needs a connection for this page. Your garage&apos;s last saved view may still
          be available.
        </p>
        <Link
          href="/garage"
          className="btn-primary"
          style={{ marginTop: 14, display: 'inline-block', width: 'auto', padding: '10px 18px' }}
        >
          Open my garage
        </Link>
      </div>
    </main>
  );
}
