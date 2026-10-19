import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Purchase cancelled',
};

export default function TokensCancelPage() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Tokens</h1>
      <div className="panel" style={{ textAlign: 'center', marginTop: 16 }}>
        <h3 style={{ fontSize: 16 }}>Checkout cancelled</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          You haven’t been charged — no tokens were added.
        </p>
        <Link href="/tokens" className="btn-primary" style={{ marginTop: 14, display: 'block' }}>
          Back to tokens
        </Link>
      </div>
    </main>
  );
}
