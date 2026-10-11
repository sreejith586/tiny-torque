import type { Metadata } from 'next';

// The /offers route + domain naming match F-08's spec and the prototype's own data-screen="offers";
// the visible heading uses the prototype's actual label, "Deals" (garage-log-147.html). MV-S5-04
// (the /offers inbox: Received/Sent tabs) replaces this stub.

export const metadata: Metadata = {
  title: 'Deals',
};

export default function OffersPage() {
  return (
    <main style={{ padding: '48px 20px', flex: 1, textAlign: 'center' }}>
      <h1 className="page-heading">Deals</h1>
      <p className="muted">Coming soon — track cash offers and trade proposals here.</p>
    </main>
  );
}
