import type { TokenLedgerRow, TokenLedgerReason } from '@/domain/tokens';

const REASON_LABEL: Record<TokenLedgerReason, string> = {
  purchase: 'Purchased',
  spend_listing_slot: 'Spent — listing slot',
  spend_scan_pack: 'Spent — scan pack',
  spend_pro_30d: 'Spent — Pro (30 days)',
  refund: 'Refunded',
  admin_adjust: 'Admin adjustment',
  promo: 'Promo credit',
  // Collectors World reasons (07 §3.1, F-26/F-27) — ledger values exist from 0012_world_core;
  // nothing writes them until the World flags turn on.
  earn_quest: 'Earned — quest',
  earn_daily: 'Earned — daily login',
  earn_race_participation: 'Earned — race',
  earn_host: 'Earned — hosted a meetup',
  earn_attend: 'Earned — attended a meetup',
  earn_achievement: 'Earned — achievement',
  earn_referral: 'Earned — referral',
  earn_season: 'Earned — season milestone',
  expire_earned: 'Expired — earned credits',
  spend_garage_level: 'Spent — garage level',
  spend_world_item: 'Spent — World item',
  spend_meetup_host: 'Spent — meetup hosting fee',
  spend_race_entry: 'Spent — race entry',
  spend_spotlight: 'Spent — Spotlight',
  spend_rename: 'Spent — garage rename',
};

/** Where the value came from (credits) or what funded it (spends) — `token_ledger.source`, set by
 *  the RPCs since W04's FIFO (D-070): earned tokens are spent first and expire after 180 days. */
const SOURCE_LABEL: Record<NonNullable<TokenLedgerRow['source']>, string> = {
  purchased: 'purchased',
  earned: 'earned',
  promo: 'promo',
  adjust: 'adjustment',
  mixed: 'earned + purchased',
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
              {row.source ? ` · ${SOURCE_LABEL[row.source]}` : ''}
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
