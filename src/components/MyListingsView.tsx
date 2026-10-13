'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  renewListing,
  removeListing,
  updateListing,
  markListingSoldOutsideApp,
  listingPriceLabel,
  LISTING_TYPE_LABEL,
  daysUntilExpiry,
  type Listing,
} from '@/domain/marketplace';
import MediaImage from './MediaImage';
import marketStyles from './Market.module.css';

type Status = 'active' | 'reserved' | 'sold' | 'expired';
const TABS: { key: Status; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'sold', label: 'Sold' },
  { key: 'expired', label: 'Expired' },
];

/** There's no DB `expired` status (the real enum is active/reserved/sold/removed, and no
 * expire_listings() cron exists despite 03-data-model.md describing one) — "expired" here is a
 * view computed over `active` rows past their `expires_at`, not a stored status. */
function viewStatus(l: Listing): Status | null {
  if (l.status === 'sold' || l.status === 'reserved') return l.status;
  if (l.status === 'active') {
    const days = daysUntilExpiry(l.expires_at);
    return days != null && days < 0 ? 'expired' : 'active';
  }
  return null;
}

export default function MyListingsView({
  initialListings,
  currencyOptions,
  userId,
}: {
  initialListings: Listing[];
  currencyOptions: string[];
  userId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [tab, setTab] = useState<Status>('active');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<Status, Listing[]> = { active: [], reserved: [], sold: [], expired: [] };
    for (const l of listings) {
      const vs = viewStatus(l);
      if (vs) g[vs].push(l);
    }
    return g;
  }, [listings]);

  async function handleRenew(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await renewListing(supabase, userId, id);
      setListings((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                status: 'active',
                expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
              }
            : l
        )
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not renew this listing.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkSold(id: string) {
    if (
      !window.confirm(
        'Mark this as sold outside the app? This skips the offers flow entirely and cannot be undone.'
      )
    )
      return;
    setBusyId(id);
    setError(null);
    try {
      await markListingSoldOutsideApp(supabase, userId, id);
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'sold' as const } : l)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark this listing sold.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm('Remove this listing from the marketplace? This can’t be undone.')) return;
    setBusyId(id);
    setError(null);
    try {
      await removeListing(supabase, userId, id);
      setListings((prev) => prev.filter((l) => l.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this listing.');
    } finally {
      setBusyId(null);
    }
  }

  const tabListings = grouped[tab];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'btn-primary' : 'btn-secondary'}
            style={{ width: 'auto', margin: 0, padding: '8px 14px' }}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({grouped[t.key].length})
          </button>
        ))}
      </div>

      {error && <p className="field-error">{error}</p>}

      {tabListings.length === 0 && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p className="muted">No {tab} listings.</p>
        </div>
      )}

      {tabListings.map((listing) => (
        <div key={listing.id} className="panel" style={{ marginBottom: 12 }}>
          <div className={marketStyles.listing} style={{ pointerEvents: 'none' }}>
            <div className={marketStyles.thumb}>
              <MediaImage
                src={listing.media[0]?.url}
                mediaId={listing.media[0]?.id}
                alt={listing.brand}
              />
            </div>
            <div className={marketStyles.info}>
              <h3 className={marketStyles.title}>
                {[listing.model || listing.brand, listing.variant].filter(Boolean).join(' · ')}
              </h3>
              <div className={marketStyles.price}>{listingPriceLabel(listing)}</div>
            </div>
          </div>

          {tab === 'active' &&
            (() => {
              const days = daysUntilExpiry(listing.expires_at);
              return days != null ? (
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {days > 0 ? `${days} day${days === 1 ? '' : 's'} left` : 'Expires today'}
                </p>
              ) : null;
            })()}

          {editingId === listing.id ? (
            <EditListingForm
              listing={listing}
              currencyOptions={currencyOptions}
              onCancel={() => setEditingId(null)}
              onSaved={(patch) => {
                setListings((prev) =>
                  prev.map((l) => (l.id === listing.id ? { ...l, ...patch } : l))
                );
                setEditingId(null);
                router.refresh();
              }}
              supabase={supabase}
              userId={userId}
            />
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {(tab === 'active' || tab === 'expired') && (
                <button
                  className="btn-secondary"
                  style={{ width: 'auto', margin: 0 }}
                  disabled={busyId === listing.id}
                  onClick={() => handleRenew(listing.id)}
                >
                  Renew
                </button>
              )}
              {(tab === 'active' || tab === 'reserved') && (
                <button
                  className="btn-secondary"
                  style={{ width: 'auto', margin: 0 }}
                  disabled={busyId === listing.id}
                  onClick={() => setEditingId(listing.id)}
                >
                  Edit
                </button>
              )}
              {(tab === 'active' || tab === 'reserved') && (
                <button
                  className="btn-secondary"
                  style={{ width: 'auto', margin: 0 }}
                  disabled={busyId === listing.id}
                  onClick={() => handleMarkSold(listing.id)}
                >
                  Mark sold (outside app)
                </button>
              )}
              {tab !== 'sold' && (
                <button
                  className="btn-danger"
                  style={{ width: 'auto', margin: 0 }}
                  disabled={busyId === listing.id}
                  onClick={() => handleRemove(listing.id)}
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EditListingForm({
  listing,
  currencyOptions,
  onCancel,
  onSaved,
  supabase,
  userId,
}: {
  listing: Listing;
  currencyOptions: string[];
  onCancel: () => void;
  onSaved: (patch: Partial<Listing>) => void;
  supabase: ReturnType<typeof createClient>;
  userId: string;
}) {
  const [listingType, setListingType] = useState(listing.listing_type);
  const [price, setPrice] = useState(String(listing.price));
  const [currency, setCurrency] = useState(listing.currency ?? currencyOptions[0] ?? 'AED');
  const [qty, setQty] = useState(String(listing.qty));
  const [openToOffers, setOpenToOffers] = useState(listing.open_to_offers);
  const [minOffer, setMinOffer] = useState(
    listing.min_offer != null ? String(listing.min_offer) : ''
  );
  const [description, setDescription] = useState(listing.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const priceNumber = Number(price) || 0;
      const patch = {
        listingType,
        price: priceNumber,
        currency,
        qty: Number(qty) || 1,
        openToOffers,
        minOffer: openToOffers && minOffer ? Number(minOffer) : null,
        description: description || null,
      };
      await updateListing(supabase, userId, listing.id, patch);
      onSaved({
        listing_type: listingType,
        price: priceNumber,
        currency,
        qty: patch.qty,
        open_to_offers: openToOffers,
        min_offer: patch.minOffer ?? priceNumber,
        description: patch.description,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label htmlFor={`type-${listing.id}`}>Listing type</label>
      <select
        id={`type-${listing.id}`}
        value={listingType}
        onChange={(e) => setListingType(e.target.value as 'sale' | 'trade' | 'both')}
      >
        {(['sale', 'trade', 'both'] as const).map((t) => (
          <option key={t} value={t}>
            {LISTING_TYPE_LABEL[t]}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor={`price-${listing.id}`}>Price</label>
          <input
            id={`price-${listing.id}`}
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor={`currency-${listing.id}`}>Currency</label>
          <select
            id={`currency-${listing.id}`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor={`qty-${listing.id}`}>Quantity</label>
      <input
        id={`qty-${listing.id}`}
        type="number"
        min="1"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
      />

      <label className="toggle-row">
        <span>Open to cash offers</span>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={openToOffers}
          onChange={(e) => setOpenToOffers(e.target.checked)}
        />
      </label>
      {openToOffers && (
        <>
          <label htmlFor={`minOffer-${listing.id}`}>Minimum offer</label>
          <input
            id={`minOffer-${listing.id}`}
            type="number"
            min="0"
            value={minOffer}
            onChange={(e) => setMinOffer(e.target.value)}
            placeholder={price || '0'}
          />
        </>
      )}

      <label htmlFor={`description-${listing.id}`}>Description</label>
      <textarea
        id={`description-${listing.id}`}
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {error && <p className="field-error">{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
