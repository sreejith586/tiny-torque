import type { TokenLedgerRow, TokenLedgerReason } from '@/domain/tokens';

const REASON_LABEL: Record<TokenLedgerReason, string> = {
  purchase: 'Purchased',
  spend_listing_slot: 'Spent — listing slot',
  spend_scan_pack: 'Spent — scan pack',
  spend_pro_30d: 'Spent — Pro (30 days)',
  refund: 'Refunded',
  admin_adjust: 'Admin adjustment',
  promo: 'Promo credit',
};

export default function TokenHistoryView({ ledger }: { ledger: TokenLedgerRow[] }) {
  if (ledger.length === 0) {
    return (
      <div className="empty-state">
        <p>No token activity yet.</p>
      </div>
    );
  }

  return (
    <div>
      {ledger.map((row) => (
        <div
          className="panel"
          key={row.id}
          style={{
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div>{REASON_LABEL[row.reason] ?? row.reason}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {new Date(row.created_at).toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{ color: row.delta > 0 ? 'var(--teal)' : 'var(--danger)', fontWeight: 700 }}
            >
              {row.delta > 0 ? '+' : ''}
              {row.delta}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              balance {row.balance_after}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
