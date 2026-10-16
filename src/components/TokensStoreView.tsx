'use client';

import { useState } from 'react';
import Link from 'next/link';
import { buyPackAction } from '@/app/tokens/actions';
import { SPEND_OPTION_CONFIG, type TokenPackRow } from '@/domain/tokens';

const SPEND_LABEL: Record<keyof typeof SPEND_OPTION_CONFIG, string> = {
  listing_slot: 'Extra listing slot (permanent)',
  scan_pack: '+25 scans (30 days)',
  pro_30d: 'Pro for 30 days',
};

export default function TokensStoreView({
  balance,
  packs,
}: {
  balance: number;
  packs: TokenPackRow[];
}) {
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(packId: string) {
    setError(null);
    setBuyingId(packId);
    const result = await buyPackAction(packId);
    if (result.ok) {
      window.location.assign(result.url);
      return;
    }
    setError(result.error);
    setBuyingId(null);
  }

  return (
    <div>
      <div className="panel" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          Your balance
        </div>
        <div style={{ fontSize: 32, fontFamily: 'var(--font-heading)', color: 'var(--orange)' }}>
          {balance}
        </div>
      </div>

      <div className="section-title">What tokens buy</div>
      <div className="panel" style={{ marginBottom: 16 }}>
        {(Object.keys(SPEND_OPTION_CONFIG) as Array<keyof typeof SPEND_OPTION_CONFIG>).map(
          (key) => (
            <div className="toggle-row" key={key}>
              <span>{SPEND_LABEL[key]}</span>
              <span className="muted">{SPEND_OPTION_CONFIG[key].cost} tokens</span>
            </div>
          )
        )}
      </div>

      <div className="section-title">Buy tokens</div>
      {error && (
        <p className="field-error" style={{ marginBottom: 10 }}>
          {error}
        </p>
      )}
      {packs.length === 0 ? (
        <div className="empty-state">
          <p>No token packs available right now.</p>
        </div>
      ) : (
        packs.map((pack) => (
          <div
            className="panel"
            key={pack.id}
            style={{
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{pack.tokens} tokens</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {pack.price_amount} {pack.price_currency}
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ width: 'auto', padding: '10px 18px' }}
              disabled={buyingId !== null}
              onClick={() => handleBuy(pack.id)}
            >
              {buyingId === pack.id ? 'Starting checkout…' : 'Buy'}
            </button>
          </div>
        ))
      )}

      <Link
        href="/tokens/history"
        className="btn-secondary"
        style={{ display: 'block', textAlign: 'center', marginTop: 16 }}
      >
        Token history
      </Link>
    </div>
  );
}
