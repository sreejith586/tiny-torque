'use client';

// World shop + inventory (MV-W02-05 → D-083; completed in MV-W05-01, D-092 proposed). Prices,
// gates and caps are enforced in buy_world_item / buy_world_level (07 P4) — this view only explains
// them: every kind (themes / decor / signage / extras / tunes / trophies), level-locked and
// season-limited labels, earned-only rows that are visible but never buyable, Spotlight as a
// labelled 24 h consumable with its expiry, a receipt line after each purchase. Prototype pieces
// only (D-027 rule 12 / D-086): panel, section-title, btn-*, status-pill, muted, Paywall.
import { useState, useTransition } from 'react';
import Link from 'next/link';
import Paywall from '@/components/Paywall';
import { LEVELS } from '@/domain/gamification/rules';
import type {
  OwnGarage,
  WorldInventoryRow,
  WorldItemKind,
  WorldItemRow,
  WorldShop as Shop,
} from '@/domain/world';
import type { SeasonRow } from '@/domain/quests';
import { buyItemAction, buyLevelAction } from '@/app/world/actions';
import { ITEM_KIND_LABEL } from './copy';
import styles from './World.module.css';

const KIND_ORDER: WorldItemKind[] = ['theme', 'decor', 'signage', 'consumable', 'tune', 'trophy'];

const KIND_NOTE: Partial<Record<WorldItemKind, string>> = {
  tune: 'Tunes apply to races. Racing arrives in a later update — buying now is fine, nothing is lost.',
  trophy: 'Trophies are earned, never bought: finish a season track or win an event.',
  consumable:
    'Extras are used up: Spotlight puts your garage at the top of Open garages for 24 hours, labelled.',
};

type Effect = { grants?: string; hours?: number | string } | null;

function effectOf(item: WorldItemRow): Effect {
  return item.effect as Effect;
}

function tierName(xpLevel: number): string {
  return LEVELS.find((l) => l.level === xpLevel)?.tier ?? `tier ${xpLevel}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorldShop({
  own,
  shop,
  seasons,
  balance: initialBalance,
  xpLevel,
}: {
  own: OwnGarage;
  shop: Shop;
  /** Every season row (public read) — for the season-limited labels. */
  seasons: SeasonRow[];
  balance: number;
  xpLevel: number;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [level, setLevel] = useState(own.garage.level);
  const [extraSlots, setExtraSlots] = useState(own.garage.extra_slots);
  const [inventory, setInventory] = useState<WorldInventoryRow[]>(own.inventory);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [short, setShort] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // the clock the labels compare against: fixed per mount (purity), refreshed by a purchase
  const [now] = useState(() => Date.now());
  const current = shop.levels.find((l) => l.level === level) ?? own.level;
  const next = shop.levels.find((l) => l.level === level + 1) ?? null;
  const gated = !!next && xpLevel < next.min_xp_level;
  const items = shop.items.filter((i) => effectOf(i)?.grants !== 'rename');
  const itemById = new Map(shop.items.map((i) => [i.id, i]));
  const seasonById = new Map(seasons.map((s) => [s.id, s]));

  const ownedDurable = new Set(inventory.filter((r) => r.durable).map((r) => r.item_id));
  const activeConsumables = inventory.filter(
    (r) => !r.durable && r.expires_at && new Date(r.expires_at).getTime() > now
  );
  const spotlightUntil =
    activeConsumables
      .filter(
        (r) => effectOf(itemById.get(r.item_id) ?? ({} as WorldItemRow))?.grants === 'spotlight'
      )
      .map((r) => r.expires_at!)
      .sort()
      .at(-1) ?? null;

  function seasonState(item: WorldItemRow): { label: string; open: boolean } | null {
    if (!item.season_id) return null;
    const s = seasonById.get(item.season_id);
    if (!s) return { label: 'Season-limited', open: false };
    const running = now >= new Date(s.starts_at).getTime() && now < new Date(s.ends_at).getTime();
    if (running) return { label: `${s.name} only · until ${shortDate(s.ends_at)}`, open: true };
    return {
      label:
        now < new Date(s.starts_at).getTime()
          ? `${s.name} · from ${shortDate(s.starts_at)}`
          : `${s.name} · over`,
      open: false,
    };
  }

  function run(key: string, fn: () => Promise<void>) {
    setError(null);
    setShort(false);
    setReceipt(null);
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
      setReceipt(`Level ${r.data.level} · ${next.name} for ${price} tokens.`);
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
      const price = item.price ?? 0;
      setBalance((b) => b - price);
      const grants = effectOf(item)?.grants;
      if (grants === 'display_slot') setExtraSlots((n) => n + 1);
      const row: WorldInventoryRow = {
        id: r.data.inventoryId,
        user_id: own.garage.user_id,
        item_id: item.id,
        acquired_via: 'purchase',
        ledger_id: null,
        durable: item.kind !== 'consumable',
        expires_at: r.data.expiresAt,
        created_at: new Date().toISOString(),
      };
      setInventory((list) => [row, ...list]);
      setReceipt(
        `${item.name} for ${price === 0 ? 'free' : `${price} tokens`}${
          r.data.expiresAt ? ` · Spotlight until ${shortTime(r.data.expiresAt)}` : ''
        }.`
      );
    });
  }

  function itemState(item: WorldItemRow): { label: string; disabled: boolean; owned: boolean } {
    if (item.price === null) return { label: 'Earned only', disabled: true, owned: false };
    if (item.kind !== 'consumable' && ownedDurable.has(item.id))
      return { label: 'Owned', disabled: true, owned: true };
    if (level < item.min_level)
      return { label: `Level ${item.min_level}+`, disabled: true, owned: false };
    const season = seasonState(item);
    if (season && !season.open) return { label: 'Not on sale', disabled: true, owned: false };
    const grants = effectOf(item)?.grants;
    if (grants === 'display_slot') {
      const cap = current.max_extra_slots;
      if (extraSlots >= cap) return { label: `${cap}/${cap} bought`, disabled: true, owned: false };
      return { label: `Buy (${extraSlots}/${cap})`, disabled: false, owned: false };
    }
    if (grants === 'spotlight' && spotlightUntil)
      return { label: `On until ${shortTime(spotlightUntil)}`, disabled: true, owned: false };
    return { label: item.price === 0 ? 'Claim' : 'Buy', disabled: false, owned: false };
  }

  const inventoryRows = [...inventory.filter((r) => r.durable), ...activeConsumables].flatMap(
    (r) => {
      const item = itemById.get(r.item_id);
      return item ? [{ row: r, item }] : [];
    }
  );

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
      {receipt && !error && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 10 }} role="status">
          Bought: {receipt} Receipt in <Link href="/tokens/history">token history</Link>.
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
                  {tierName(xpLevel)}. Earn XP in your garage first; tokens alone cannot skip it.
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
              {KIND_NOTE[kind] && (
                <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                  {KIND_NOTE[kind]}
                </p>
              )}
              {group.map((item) => {
                const st = itemState(item);
                const season = seasonState(item);
                const grants = effectOf(item)?.grants;
                return (
                  <div className={styles.shopRow} key={item.id}>
                    <div>
                      <div className={styles.shopName}>{item.name}</div>
                      {item.description && (
                        <div className={styles.shopMeta}>{item.description}</div>
                      )}
                      <div className={styles.shopMeta}>
                        {[
                          item.min_level > 1 ? `Level ${item.min_level}+` : null,
                          season?.label ?? null,
                          grants === 'spotlight'
                            ? `${effectOf(item)?.hours ?? 24} h · labelled "Spotlight"`
                            : null,
                          item.price === null ? 'Earned only' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
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
      {inventoryRows.length === 0 ? (
        <div className="empty-state">
          <p>Nothing bought yet. Themes, decor and extras you own show up here.</p>
        </div>
      ) : (
        <div className="panel">
          {inventoryRows.map(({ row, item }) => (
            <div className={styles.shopRow} key={row.id}>
              <div>
                <div className={styles.shopName}>{item.name}</div>
                <div className={styles.shopMeta}>
                  {ITEM_KIND_LABEL[item.kind]}
                  {row.acquired_via === 'earn' ? ' · earned' : ''}
                  {row.expires_at ? ` · Spotlight until ${shortTime(row.expires_at)}` : ''}
                </div>
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
              {(item.kind === 'decor' || item.kind === 'signage' || item.kind === 'trophy') && (
                <Link
                  href="/world/garage"
                  className="btn-secondary"
                  style={{ padding: '8px 14px' }}
                >
                  Place
                </Link>
              )}
              {row.expires_at && <span className="status-pill status-completed">Spotlight</span>}
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Every purchase is a token spend — receipts are in{' '}
        <Link href="/tokens/history">token history</Link>. Earned tokens are spent first.
      </p>
    </div>
  );
}
