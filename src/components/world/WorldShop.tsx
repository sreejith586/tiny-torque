'use client';

// World shop v1 + inventory (MV-W02-05, D-083 proposed). Prices come from data rows; the XP gate
// and caps are enforced in the RPCs — this view only explains them. A short balance shows the
// existing <Paywall> (→ /tokens); receipts already appear in /tokens/history (S7).
import { useState, useTransition } from 'react';
import Link from 'next/link';
import Paywall from '@/components/Paywall';
import { LEVELS } from '@/domain/gamification/rules';
import type { OwnGarage, WorldItemKind, WorldItemRow, WorldShop as Shop } from '@/domain/world';
import { buyItemAction, buyLevelAction } from '@/app/world/actions';
import { ITEM_KIND_LABEL } from './copy';
import styles from './World.module.css';

const KIND_ORDER: WorldItemKind[] = ['theme', 'decor', 'signage', 'consumable', 'tune', 'trophy'];

function tierName(xpLevel: number): string {
  return LEVELS.find((l) => l.level === xpLevel)?.tier ?? `tier ${xpLevel}`;
}

export default function WorldShop({
  own,
  shop,
  balance: initialBalance,
  xpLevel,
}: {
  own: OwnGarage;
  shop: Shop;
  balance: number;
  xpLevel: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [level, setLevel] = useState(own.garage.level);
  const [extraSlots, setExtraSlots] = useState(own.garage.extra_slots);
  const [owned, setOwned] = useState(() => new Set(own.inventory.map((i) => i.item_id)));
  const [error, setError] = useState<string | null>(null);
  const [short, setShort] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const current = shop.levels.find((l) => l.level === level) ?? own.level;
  const next = shop.levels.find((l) => l.level === level + 1) ?? null;
  const gated = !!next && xpLevel < next.min_xp_level;
  const items = shop.items.filter(
    (i) => (i.effect as { grants?: string } | null)?.grants !== 'rename'
  );
  const inventoryItems = shop.items.filter((i) => owned.has(i.id));

  function run(key: string, fn: () => Promise<void>) {
    setError(null);
    setShort(false);
    setBusy(key);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setBusy(null);
      }
    });
  }

  function buyLevel() {
    if (!next) return;
    const price = next.price;
    run('level', async () => {
      const r = await buyLevelAction();
      if (!r.ok) {
        if (r.code === 'insufficient_balance') setShort(true);
        else setError(r.error);
        return;
      }
      setLevel(r.data.level);
      setBalance((b) => b - price);
    });
  }

  function buyItem(item: WorldItemRow) {
    run(item.id, async () => {
      const r = await buyItemAction(item.id);
      if (!r.ok) {
        if (r.code === 'insufficient_balance') setShort(true);
        else setError(r.error);
        return;
      }
      setBalance((b) => b - (item.price ?? 0));
      if ((item.effect as { grants?: string } | null)?.grants === 'display_slot') {
        setExtraSlots((n) => n + 1);
      } else if (item.kind !== 'consumable') {
        setOwned((s) => new Set(s).add(item.id));
      }
    });
  }

  function itemState(item: WorldItemRow): { label: string; disabled: boolean; owned: boolean } {
    if (item.price === null) return { label: 'Earned only', disabled: true, owned: false };
    if (item.kind !== 'consumable' && owned.has(item.id))
      return { label: 'Owned', disabled: true, owned: true };
    if (level < item.min_level)
      return { label: `Level ${item.min_level}+`, disabled: true, owned: false };
    if ((item.effect as { grants?: string } | null)?.grants === 'display_slot') {
      const cap = current.max_extra_slots;
      if (extraSlots >= cap) return { label: `${cap}/${cap} bought`, disabled: true, owned: false };
      return { label: `Buy (${extraSlots}/${cap})`, disabled: false, owned: false };
    }
    return { label: item.price === 0 ? 'Claim' : 'Buy', disabled: false, owned: false };
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
        <Link href="/tokens" className="muted" style={{ fontSize: 13 }}>
          Get tokens
        </Link>
      </div>

      {short && (
        <div style={{ marginBottom: 16 }}>
          <Paywall context="world" />
        </div>
      )}
      {error && (
        <p className="field-error" style={{ marginBottom: 10 }}>
          {error}
        </p>
      )}

      <div className="section-title">Garage level</div>
      <div className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <span className={styles.shopName}>
            Level {current.level} · {current.name}
          </span>
          <span className={styles.shopMeta}>
            {current.display_slots} slots · {current.decor_slots} decor · {current.visitor_cap}{' '}
            visitors
          </span>
        </div>
        {next ? (
          <div className={styles.shopRow} style={{ marginTop: 10 }}>
            <div>
              <div className={styles.shopName}>
                Next: Level {next.level} · {next.name}
              </div>
              <div className={styles.shopMeta}>
                {next.display_slots} slots · {next.decor_slots} decor · {next.visitor_cap} visitors
                {next.host_cap > 0 ? ` · host up to ${next.host_cap}` : ''}
              </div>
              {gated && (
                <div className={styles.shopMeta}>
                  Needs collector tier {next.min_xp_level} ({tierName(next.min_xp_level)}) — you are{' '}
                  {tierName(xpLevel)}. Earn XP in your garage first.
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={styles.price}>{next.price} tokens</div>
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 6, padding: '8px 14px' }}
                disabled={gated || busy !== null}
                onClick={buyLevel}
              >
                {busy === 'level' ? 'Buying…' : 'Level up'}
              </button>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Your garage is at the top level.
          </p>
        )}
      </div>

      {KIND_ORDER.map((kind) => {
        const group = items.filter((i) => i.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind}>
            <div className="section-title">{ITEM_KIND_LABEL[kind]}</div>
            <div className="panel">
              {group.map((item) => {
                const st = itemState(item);
                return (
                  <div className={styles.shopRow} key={item.id}>
                    <div>
                      <div className={styles.shopName}>{item.name}</div>
                      {item.description && (
                        <div className={styles.shopMeta}>{item.description}</div>
                      )}
                      {item.min_level > 1 && (
                        <div className={styles.shopMeta}>Level {item.min_level}+</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={styles.price}>
                        {item.price === null
                          ? '—'
                          : item.price === 0
                            ? 'Free'
                            : `${item.price} tokens`}
                      </div>
                      <button
                        type="button"
                        className={st.owned ? 'btn-secondary' : 'btn-primary'}
                        style={{ marginTop: 6, padding: '8px 14px' }}
                        disabled={st.disabled || busy !== null}
                        onClick={() => buyItem(item)}
                      >
                        {busy === item.id ? 'Buying…' : st.label}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="section-title">Your inventory</div>
      {inventoryItems.length === 0 ? (
        <div className="empty-state">
          <p>Nothing bought yet. Themes and decor you own show up here.</p>
        </div>
      ) : (
        <div className="panel">
          {inventoryItems.map((item) => (
            <div className={styles.shopRow} key={item.id}>
              <div>
                <div className={styles.shopName}>{item.name}</div>
                <div className={styles.shopMeta}>{ITEM_KIND_LABEL[item.kind]}</div>
              </div>
              {item.kind === 'theme' && (
                <Link
                  href="/world/garage"
                  className="btn-secondary"
                  style={{ padding: '8px 14px' }}
                >
                  Apply
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Every purchase is a token spend — receipts are in{' '}
        <Link href="/tokens/history">token history</Link>.
      </p>
    </div>
  );
}
