'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addCollectionItems, uploadCarPhoto } from '@/domain/garage';
import { scanPhotoForCars, type ScanCandidate } from '@/domain/ai';

// Editable review row: a scan candidate plus an "include" checkbox and the
// same fields the manual add-car form exposes, so the user can fix anything
// the model got wrong (or unchecked) before saving.
interface ReviewRow extends ScanCandidate {
  id: string; // client-only key
  include: boolean;
}

function confidenceLabel(c: number): { label: string; className: string } {
  if (c >= 0.75) return { label: 'High confidence', className: 'confidence-high' };
  if (c >= 0.4) return { label: 'Medium confidence', className: 'confidence-medium' };
  return { label: 'Low confidence — check this one', className: 'confidence-low' };
}

export default function BatchScanPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRows([]);
    setError(null);
  }

  async function handleScan() {
    if (!photoFile) return;
    setScanning(true);
    setError(null);
    try {
      const candidates = await scanPhotoForCars(supabase, photoFile);
      if (candidates.length === 0) {
        setError('No cars were recognizable in this photo. Try a clearer or closer shot.');
      }
      setRows(
        candidates.map((c, i) => ({
          ...c,
          id: `${Date.now()}-${i}`,
          include: true,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed. Try again.');
    } finally {
      setScanning(false);
    }
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const includedCount = rows.filter((r) => r.include).length;

  async function handleSaveAll() {
    setSaving(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('You need to be signed in.');

      // The same source photo is attached to every car detected in it —
      // one upload, reused as the .photo for each accepted row.
      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await uploadCarPhoto(supabase, userId, photoFile);
      }

      const toSave = rows.filter((r) => r.include);
      await addCollectionItems(
        supabase,
        userId,
        toSave.map((r) => ({
          brand: r.brand,
          model: r.model,
          variant: r.variant,
          series: r.series,
          scale: r.scale,
          photo: photoUrl,
          photos: photoUrl ? [photoUrl] : [],
        }))
      );

      router.push('/garage');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these cars. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24 }}>Batch photo scan</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Take one photo of several cars on a table or shelf. We&apos;ll identify each one — review and edit before
        adding them to your garage.
      </p>

      {!photoPreview && (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 20, width: '100%', height: 140, display: 'flex', flexDirection: 'column', gap: 6 }}
          onClick={() => fileInputRef.current?.click()}
        >
          <span style={{ fontSize: 28 }}>📷</span>
          <span>Choose a photo</span>
        </button>
      )}

      {photoPreview && (
        <div style={{ marginTop: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoPreview}
            alt=""
            style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Choose a different photo
            </button>
            {rows.length === 0 && (
              <button type="button" className="btn-primary" onClick={handleScan} disabled={scanning}>
                {scanning ? 'Scanning…' : 'Scan photo'}
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        style={{ display: 'none' }}
      />

      {error && <p className="field-error" style={{ marginTop: 16 }}>{error}</p>}

      {rows.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18 }}>
            Found {rows.length} {rows.length === 1 ? 'car' : 'cars'} — review before saving
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {rows.map((row) => {
              const conf = confidenceLabel(row.confidence);
              return (
                <div key={row.id} className="scan-review-card" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="toggle-row" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        style={{ width: 'auto' }}
                        checked={row.include}
                        onChange={(e) => updateRow(row.id, { include: e.target.checked })}
                      />
                      <span>Add this car</span>
                    </label>
                    <span className={conf.className} style={{ fontSize: 12 }}>
                      {conf.label} ({Math.round(row.confidence * 100)}%)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <div>
                      <label style={{ fontSize: 12 }}>Brand</label>
                      <input value={row.brand} onChange={(e) => updateRow(row.id, { brand: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12 }}>Model</label>
                      <input
                        value={row.model ?? ''}
                        onChange={(e) => updateRow(row.id, { model: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12 }}>Variant / color</label>
                      <input
                        value={row.variant ?? ''}
                        onChange={(e) => updateRow(row.id, { variant: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12 }}>Series</label>
                      <input
                        value={row.series ?? ''}
                        onChange={(e) => updateRow(row.id, { series: e.target.value || null })}
                      />
                    </div>
                  </div>

                  {row.notes && (
                    <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                      Note: {row.notes}
                    </p>
                  )}

                  <button
                    type="button"
                    className="btn-danger"
                    style={{ marginTop: 10, fontSize: 12 }}
                    onClick={() => removeRow(row.id)}
                  >
                    Remove from list
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 20, width: '100%' }}
            disabled={saving || includedCount === 0}
            onClick={handleSaveAll}
          >
            {saving ? 'Saving…' : `Add ${includedCount} ${includedCount === 1 ? 'car' : 'cars'} to garage`}
          </button>
        </div>
      )}
    </main>
  );
}
