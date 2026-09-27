import type { Metadata } from 'next';

// Marketplace (buy/sell/trade listings) is Phase 2 — see
// /mnt/user-data/outputs/mini-vault-features.md for the full spec. This
// stub only exists so the bottom nav's Market tab doesn't 404.

export const metadata: Metadata = {
  title: 'Market',
};

export default function MarketPage() {
  return (
    <main style={{ padding: '48px 20px', flex: 1, textAlign: 'center' }}>
      <h1 style={{ fontSize: 22 }}>Marketplace</h1>
      <p className="muted">Coming soon — buy, sell and trade with other collectors.</p>
    </main>
  );
}
