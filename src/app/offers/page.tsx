import type { Metadata } from 'next';

// Offers (cash offers, trade proposals, deal tracking) is Phase 2 — see
// /mnt/user-data/outputs/mini-vault-features.md for the full spec. This
// stub only exists so the bottom nav's Offers tab doesn't 404.

export const metadata: Metadata = {
  title: 'Offers',
};

export default function OffersPage() {
  return (
    <main style={{ padding: '48px 20px', flex: 1, textAlign: 'center' }}>
      <h1 style={{ fontSize: 22 }}>Offers</h1>
      <p className="muted">Coming soon — track cash offers and trade proposals here.</p>
    </main>
  );
}
