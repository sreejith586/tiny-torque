'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addWishlistItem, removeWishlistItem, type WishlistItemRow } from '@/domain/marketplace';
import { searchCatalogModels, type CatalogModelRow } from '@/domain/catalog';

export default function WishlistView({
  initialItems,
  userId,
  currencyOptions,
}: {
  initialItems: WishlistItemRow[];
  userId: string;
  currencyOptions: string[];
}) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [notes, setNotes] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [currency, setCurrency] = useState(currencyOptions[0] ?? 'AED');
  const [notify, setNotify] = useState(true);
  const [catalogueMatches, setCatalogueMatches] = useState<CatalogModelRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = model.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setCatalogueMatches([]);
        return;
      }
      searchCatalogModels(supabase, q)
        .then(setCatalogueMatches)
        .catch(() => setCatalogueMatches([]));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  async function handleAdd() {
    if (!brand.trim() && !model.trim()) {
      setError("Add at least what you're looking for.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const matched = catalogueMatches.find((m) => m.name === model.trim());
      const row = await addWishlistItem(supabase, userId, {
        brand: brand.trim() || null,
        model: model.trim() || null,
        catalogModelId: matched?.id ?? null,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        currency: maxPrice ? currency : null,
        notes: notes.trim() || null,
        notify,
      });
      setItems((prev) => [row, ...prev]);
      setBrand('');
      setModel('');
      setNotes('');
      setMaxPrice('');
      setCatalogueMatches([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this to your wishlist.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await removeWishlistItem(supabase, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError('Could not remove this item.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <label htmlFor="wishBrand">Brand (optional)</label>
        <input
          id="wishBrand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Hot Wheels"
          maxLength={40}
        />

        <label htmlFor="wishModel">Model / what you&apos;re looking for</label>
        <input
          id="wishModel"
          list="catalogue-matches"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="e.g. '70 Dodge Charger, red"
          maxLength={60}
        />
        <datalist id="catalogue-matches">
          {catalogueMatches.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>

        <label htmlFor="wishNotes">Notes (optional)</label>
        <input
          id="wishNotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any specific detail, color, series…"
          maxLength={100}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="wishMaxPrice">Max price (optional)</label>
            <input
              id="wishMaxPrice"
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
          {maxPrice && (
            <div style={{ flex: 1 }}>
              <label htmlFor="wishCurrency">Currency</label>
              <select
                id="wishCurrency"
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
          )}
        </div>

        <label className="toggle-row">
          <span>Notify me of matching listings</span>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
        </label>

        {error && <p className="field-error">{error}</p>}

        <button
          className="btn-primary"
          style={{ marginTop: 14 }}
          onClick={handleAdd}
          disabled={adding}
        >
          {adding ? 'Adding…' : 'Add to wishlist'}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>Nothing on your wishlist yet.</p>
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="panel"
            style={{
              marginBottom: 10,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{item.model || item.brand || 'Any brand'}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {[item.brand, item.notes].filter(Boolean).join(' · ')}
              </div>
              {item.max_price != null && (
                <div className="muted" style={{ fontSize: 13 }}>
                  Up to {item.currency} {item.max_price}
                </div>
              )}
            </div>
            <button
              className="btn-secondary"
              style={{ width: 'auto', margin: 0 }}
              onClick={() => handleRemove(item.id)}
              disabled={removingId === item.id}
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  );
}
