'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { deleteCollectionItem, updateCollectionItem } from '@/lib/api';
import type { CollectionItemRow } from '@/types/database';

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

export default function CarDetailView({ item, isOwner }: { item: CollectionItemRow; isOwner: boolean }) {
  const supabase = createClient();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, (item[f.key] as string) ?? '']))
  );
  const [qty, setQty] = useState(String(item.qty));
  const [pricePaid, setPricePaid] = useState(String(item.price_paid));
  const [isPublic, setIsPublic] = useState(item.is_public);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } as Partial<CollectionItemRow>;
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

  async function handleDelete() {
    if (!window.confirm(`Remove this ${item.brand} from your garage? This can't be undone.`)) return;
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
      <div className="car-photo" style={{ borderRadius: 14, marginBottom: 16 }}>
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo} alt={item.brand} />
        ) : (
          <span>No photo</span>
        )}
      </div>

      {item.photos && item.photos.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {item.photos.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
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
                <input type="checkbox" style={{ width: 'auto' }} checked={isPublic} onChange={handleTogglePublic} />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button>
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
          <input id="qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />

          <label htmlFor="pricePaid">Price paid</label>
          <input id="pricePaid" type="number" min="0" step="0.01" value={pricePaid} onChange={(e) => setPricePaid(e.target.value)} />

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
