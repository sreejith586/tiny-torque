'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { deleteCollectionItem, updateCollectionItem } from '@/domain/garage';
import type { CollectionItemRow, GarageItem } from '@/domain/garage';
import type { TablesUpdate } from '@/lib/supabase/types';
import {
  publishListing,
  canPublishListing,
  ListingLimitError,
  listingPriceLabel,
  LISTING_TYPE_LABEL,
  type Listing,
} from '@/domain/marketplace';
import MediaImage from './MediaImage';
import Paywall from './Paywall';
import marketStyles from './Market.module.css';

const FIELDS: Array<{ key: keyof CollectionItemRow; label: string }> = [
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'series', label: 'Series' },
  { key: 'scale', label: 'Scale' },
  { key: 'variant', label: 'Variant / color' },
  { key: 'card_type', label: 'Card / packaging type' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'condition', label: 'Condition' },
  { key: 'source', label: 'Source' },
];

export default function CarDetailView({
  item,
  isOwner,
  publishEnabled = false,
  existingListing = null,
  defaultCurrency = 'AED',
  currencyOptions = [defaultCurrency],
}: {
  item: GarageItem;
  isOwner: boolean;
  publishEnabled?: boolean;
  existingListing?: Listing | null;
  defaultCurrency?: string;
  currencyOptions?: string[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, (item[f.key] as string) ?? '']))
  );
  const [qty, setQty] = useState(String(item.qty));
  const [pricePaid, setPricePaid] = useState(String(item.price_paid));
  const [isPublic, setIsPublic] = useState(item.is_public);
  const [isFavorite, setIsFavorite] = useState(item.is_favorite);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [listing, setListing] = useState(existingListing);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [limitState, setLimitState] = useState<{ allowed: boolean } | null>(null);
  const [listingType, setListingType] = useState<'sale' | 'trade' | 'both'>('sale');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [sellQty, setSellQty] = useState(1);
  const [openToOffers, setOpenToOffers] = useState(false);
  const [minOffer, setMinOffer] = useState('');
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const hasPhoto = item.media.length > 0;
  const priceNumber = Number(price) || 0;

  async function handleToggleSaleForm() {
    const next = !showSaleForm;
    setShowSaleForm(next);
    if (next && !limitState) {
      try {
        setLimitState(await canPublishListing(supabase, item.owner_id));
      } catch {
        // leave limitState null; a blocked publish attempt still surfaces the server error
      }
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const result = await publishListing(supabase, item.owner_id, {
        sourceItemId: item.id,
        brand: item.brand,
        model: item.model,
        variant: item.variant,
        rarity: item.rarity,
        condition: item.condition,
        listingType,
        price: priceNumber,
        currency,
        qty: sellQty,
        openToOffers,
        minOffer: openToOffers && minOffer ? Number(minOffer) : null,
        description: description || null,
      });
      setListing(result);
      setShowSaleForm(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ListingLimitError) setLimitState({ allowed: false });
      else setPublishError(err instanceof Error ? err.message : 'Could not publish this listing.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const fieldPatch: Record<string, string | null> = {};
      FIELDS.forEach((f) => {
        fieldPatch[f.key as string] = values[f.key as string] || null;
      });
      const patch = {
        ...fieldPatch,
        qty: Number(qty) || 1,
        price_paid: Number(pricePaid) || 0,
        is_public: isPublic,
      } as TablesUpdate<'collection_items'>;
      await updateCollectionItem(supabase, item.id, patch);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    try {
      await updateCollectionItem(supabase, item.id, { is_public: next });
      router.refresh();
    } catch {
      setIsPublic(!next);
    }
  }

  async function handleToggleFavourite() {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await updateCollectionItem(supabase, item.id, { is_favorite: next });
      router.refresh();
    } catch {
      setIsFavorite(!next);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove this ${item.brand} from your garage? This can't be undone.`))
      return;
    setDeleting(true);
    try {
      await deleteCollectionItem(supabase, item.id);
      router.push('/garage');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this car.');
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* `.car-photo` in globals.css is scoped as `.car-card .car-photo` (the garage-grid card),
          so it has no effect without that ancestor — without sizing, the <img> rendered its native
          pixel size and overflowed the viewport on real (large) photos. Mirror those rule's values
          inline here instead of editing the hook-locked globals.css. */}
      <div
        className="car-photo"
        style={{
          borderRadius: 14,
          marginBottom: 16,
          width: '100%',
          aspectRatio: '4 / 3',
          overflow: 'hidden',
          background: 'var(--panel-alt)',
        }}
      >
        <MediaImage
          src={item.media[0]?.url}
          mediaId={item.media[0]?.id}
          alt={item.brand}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {item.media.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {item.media.map((m) => (
            <div key={m.id} style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden' }}>
              <MediaImage
                src={m.url}
                mediaId={m.id}
                alt=""
                style={{ width: 56, height: 56, objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}

      {!editing ? (
        <>
          <h1 style={{ fontSize: 24 }}>{item.brand}</h1>
          {FIELDS.slice(1).map((f) =>
            item[f.key] ? (
              <div key={f.key} className="toggle-row">
                <span className="muted">{f.label}</span>
                <span>{item[f.key] as string}</span>
              </div>
            ) : null
          )}
          <div className="toggle-row">
            <span className="muted">Quantity owned</span>
            <span>{item.qty}</span>
          </div>
          <div className="toggle-row">
            <span className="muted">Price paid</span>
            <span>{item.price_paid}</span>
          </div>

          {isOwner && (
            <>
              <label className="toggle-row">
                <span>Show on my public profile</span>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={isPublic}
                  onChange={handleTogglePublic}
                />
              </label>
              <label className="toggle-row">
                <span>Favourite</span>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={isFavorite}
                  onChange={handleToggleFavourite}
                />
              </label>

              {publishEnabled &&
                (listing ? (
                  <div className="panel" style={{ marginTop: 16 }}>
                    <div className="toggle-row">
                      <span className="muted">Listed in marketplace</span>
                      <span>{listingPriceLabel(listing)}</span>
                    </div>
                    <Link
                      href={`/market/${listing.id}`}
                      className="btn-secondary"
                      style={{ display: 'block', textAlign: 'center' }}
                    >
                      View listing
                    </Link>
                  </div>
                ) : (
                  <>
                    <label className="toggle-row" style={{ marginTop: 16 }}>
                      <span>List for sale</span>
                      <input
                        type="checkbox"
                        style={{ width: 'auto' }}
                        checked={showSaleForm}
                        onChange={handleToggleSaleForm}
                      />
                    </label>
                    {showSaleForm &&
                      (limitState && !limitState.allowed ? (
                        <Paywall context="listings" />
                      ) : (
                        <div className="panel" style={{ marginTop: 10 }}>
                          <label htmlFor="listingType">Listing type</label>
                          <select
                            id="listingType"
                            value={listingType}
                            onChange={(e) =>
                              setListingType(e.target.value as 'sale' | 'trade' | 'both')
                            }
                          >
                            {(['sale', 'trade', 'both'] as const).map((t) => (
                              <option key={t} value={t}>
                                {LISTING_TYPE_LABEL[t]}
                              </option>
                            ))}
                          </select>

                          <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <label htmlFor="price">Price</label>
                              <input
                                id="price"
                                type="number"
                                min="0"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label htmlFor="currency">Currency</label>
                              <select
                                id="currency"
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

                          {item.qty > 1 && (
                            <>
                              <label>Quantity to sell</label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ width: 40, margin: 0 }}
                                  onClick={() => setSellQty((q) => Math.max(1, q - 1))}
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span style={{ flex: 1, textAlign: 'center' }}>{sellQty}</span>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ width: 40, margin: 0 }}
                                  onClick={() => setSellQty((q) => Math.min(item.qty, q + 1))}
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            </>
                          )}

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
                              <label htmlFor="minOffer">Minimum offer</label>
                              <input
                                id="minOffer"
                                type="number"
                                min="0"
                                value={minOffer}
                                onChange={(e) => setMinOffer(e.target.value)}
                                placeholder={price || '0'}
                              />
                            </>
                          )}

                          <label htmlFor="description">Description</label>
                          <textarea
                            id="description"
                            maxLength={2000}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />

                          {!hasPhoto && (
                            <p className="field-error">
                              Add at least one photo above to publish this listing.
                            </p>
                          )}

                          {priceNumber > 0 && (
                            <div
                              className={marketStyles.listing}
                              style={{ marginTop: 14, pointerEvents: 'none' }}
                            >
                              <div className={marketStyles.thumb}>
                                <MediaImage
                                  src={item.media[0]?.url}
                                  mediaId={item.media[0]?.id}
                                  alt={item.brand}
                                />
                              </div>
                              <div className={marketStyles.info}>
                                <h3 className={marketStyles.title}>
                                  {[item.model || item.brand, item.variant]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </h3>
                                <div className={marketStyles.price}>
                                  {listingPriceLabel({
                                    listing_type: listingType,
                                    currency,
                                    price: priceNumber,
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {publishError && <p className="field-error">{publishError}</p>}

                          <button
                            className="btn-primary"
                            style={{ marginTop: 14 }}
                            onClick={handlePublish}
                            disabled={publishing || !hasPhoto || priceNumber <= 0}
                          >
                            {publishing ? 'Publishing…' : 'Publish to marketplace'}
                          </button>
                        </div>
                      ))}
                  </>
                ))}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn-secondary" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Removing…' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}

          <label htmlFor="qty">Quantity owned</label>
          <input
            id="qty"
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />

          <label htmlFor="pricePaid">Price paid</label>
          <input
            id="pricePaid"
            type="number"
            min="0"
            step="0.01"
            value={pricePaid}
            onChange={(e) => setPricePaid(e.target.value)}
          />

          {error && <p className="field-error">{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
