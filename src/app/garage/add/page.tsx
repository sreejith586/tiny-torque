'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { addCollectionItem, findPossibleDuplicates } from '@/domain/garage';
import type { CollectionItemRow } from '@/domain/garage';
import { getProfile } from '@/domain/identity';
import { photoLimit } from '@/domain/entitlements';
import { uploadItemMedia } from '@/domain/media';
import { compressImage } from '@/lib/image';
import { BoltIcon, CameraIcon, ChevronRightIcon, FileIcon } from '@/components/icons';
import type { Plan } from '@/types/database';

const CONDITIONS = ['mint', 'near-mint', 'good', 'played', 'damaged'];
const RARITIES = ['common', 'uncommon', 'rare', 'super-rare', 'treasure-hunt', 'chase'];

export default function AddCarPage() {
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>('free');
  const maxPhotos = photoLimit(plan);

  // Chooser screen (D-062, garage-log-147.html addChooserView) — Scan/Import link straight to
  // their own pages same as before; Manual reveals the form below instead of navigating.
  const [mode, setMode] = useState<'chooser' | 'manual'>('chooser');

  // Required
  const [brand, setBrand] = useState('');

  // Progressive disclosure ("More details")
  const [showMore, setShowMore] = useState(false);
  const [model, setModel] = useState('');
  const [series, setSeries] = useState('');
  const [scale, setScale] = useState('');
  const [variant, setVariant] = useState('');
  const [cardType, setCardType] = useState('');
  const [rarity, setRarity] = useState('');
  const [condition, setCondition] = useState('');
  const [qty, setQty] = useState('1');
  const [pricePaid, setPricePaid] = useState('');
  const [source, setSource] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [duplicates, setDuplicates] = useState<CollectionItemRow[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const profile = await getProfile(supabase, uid).catch(() => null);
        if (profile) setPlan(profile.plan);
      }
    });
  }, [supabase]);

  // Non-blocking duplicate warning: check as brand/model/variant settle.
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!userId || !brand.trim()) {
        setDuplicates([]);
        return;
      }
      setCheckingDuplicates(true);
      try {
        const found = await findPossibleDuplicates(
          supabase,
          userId,
          brand.trim(),
          model.trim() || null,
          variant.trim() || null
        );
        setDuplicates(found);
      } catch {
        // Duplicate check is a convenience, never block the form on it.
        setDuplicates([]);
      } finally {
        setCheckingDuplicates(false);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [supabase, userId, brand, model, variant]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const room = maxPhotos - photoFiles.length;
    const accepted = files.slice(0, room);
    if (accepted.length === 0) return;

    setPhotoFiles((prev) => [...prev, ...accepted]);
    accepted.forEach((file) => {
      const url = URL.createObjectURL(file);
      setPhotoPreviews((prev) => [...prev, url]);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError('You need to be signed in to add a car.');
      return;
    }
    if (!brand.trim()) {
      setError('Brand is required.');
      return;
    }

    setSaving(true);
    try {
      const item = await addCollectionItem(supabase, userId, {
        brand: brand.trim(),
        model: model.trim() || null,
        series: series.trim() || null,
        scale: scale.trim() || null,
        variant: variant.trim() || null,
        cardType: cardType.trim() || null,
        rarity: rarity.trim() || null,
        condition: condition.trim() || null,
        qty: qty ? Number(qty) : 1,
        pricePaid: pricePaid ? Number(pricePaid) : 0,
        source: source.trim() || null,
        isPublic,
      });

      // Photos are media rows now (D-010): compress client-side, then upload to item-media.
      for (let i = 0; i < photoFiles.length; i++) {
        const blob = await compressImage(photoFiles[i]!);
        await uploadItemMedia(supabase, userId, item.id, blob, { sortOrder: i, bytes: blob.size });
      }

      router.push(`/garage/${item.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this car. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (mode === 'chooser') {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        <h1 style={{ fontSize: 24 }}>Add Car</h1>
        <div className="add-choice-grid" style={{ marginTop: 16 }}>
          <Link href="/garage/scan" className="add-choice-card tint-orange">
            <div className="add-choice-left-col">
              <div
                className="add-choice-icon-badge"
                style={{ background: 'color-mix(in srgb, var(--orange) 35%, var(--panel))' }}
              >
                <CameraIcon size={22} />
              </div>
              <div className="add-choice-title">Scan my cars</div>
              <div className="add-choice-sub">Take photos of multiple cars</div>
            </div>
            <ChevronRightIcon className="add-choice-chevron" />
          </Link>

          <button
            type="button"
            className="add-choice-card tint-green"
            onClick={() => setMode('manual')}
            style={{ border: 'none', width: '100%', textAlign: 'left', font: 'inherit' }}
          >
            <div className="add-choice-left-col">
              <div
                className="add-choice-icon-badge"
                style={{ background: 'color-mix(in srgb, var(--violet) 35%, var(--panel))' }}
              >
                <BoltIcon size={22} style={{ color: 'var(--violet)' }} />
              </div>
              <div className="add-choice-title">Add manually</div>
              <div className="add-choice-sub">For individual cars</div>
            </div>
            <ChevronRightIcon className="add-choice-chevron" />
          </button>

          <Link href="/garage/import" className="add-choice-card tint-blue">
            <div className="add-choice-left-col">
              <div
                className="add-choice-icon-badge"
                style={{ background: 'color-mix(in srgb, var(--teal) 35%, var(--panel))' }}
              >
                <FileIcon size={22} style={{ color: 'var(--teal)' }} />
              </div>
              <div className="add-choice-title">Import a file</div>
              <div className="add-choice-sub">Excel / CSV / spreadsheet</div>
            </div>
            <ChevronRightIcon className="add-choice-chevron" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setMode('chooser')}
        style={{ width: 'auto', padding: '8px 14px', fontSize: 13, marginBottom: 16 }}
      >
        ← Back
      </button>
      <h1 style={{ fontSize: 24 }}>Add a car</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="brand">Brand *</label>
        <input
          id="brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Hot Wheels"
          autoFocus
        />

        {checkingDuplicates && (
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Checking your garage…
          </p>
        )}
        {duplicates[0] && (
          <div className="warning-banner">
            You may already own{' '}
            {duplicates.length === 1 ? 'a matching car' : `${duplicates.length} matching cars`}
            {duplicates[0].model
              ? ` (${duplicates[0].brand} ${duplicates[0].model})`
              : ` (${duplicates[0].brand})`}
            . You can still add this — it just won&apos;t auto-merge.
          </div>
        )}

        <label style={{ marginTop: 20 }}>
          Photos ({photoFiles.length}/{maxPhotos})
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {photoPreviews.map((src, i) => (
            <div key={src} style={{ position: 'relative', width: 84, height: 84 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10 }}
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="btn-danger"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 22,
                  height: 22,
                  padding: 0,
                  borderRadius: '50%',
                  fontSize: 12,
                }}
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
          {photoFiles.length < maxPhotos ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ width: 84, height: 84 }}
              onClick={() => fileInputRef.current?.click()}
            >
              + Photo
            </button>
          ) : plan === 'free' ? (
            // Entitlement gate (F-02): free = 1 photo; more is a Pro feature (paywall placeholder).
            <div
              className="panel"
              style={{
                width: 180,
                padding: 10,
                display: 'flex',
                alignItems: 'center',
                fontSize: 12,
              }}
            >
              <span className="muted">1 photo on Free — upgrade to Pro for up to 8.</span>
            </div>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 20 }}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? 'Hide more details' : 'More details'}
        </button>

        {showMore && (
          <div>
            <label htmlFor="model">Model</label>
            <input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Skyline GT-R"
            />

            <label htmlFor="series">Series</label>
            <input
              id="series"
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              placeholder="e.g. Fast & Furious"
            />

            <label htmlFor="scale">Scale</label>
            <input
              id="scale"
              value={scale}
              onChange={(e) => setScale(e.target.value)}
              placeholder="e.g. 1:64"
            />

            <label htmlFor="variant">Variant / color</label>
            <input
              id="variant"
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              placeholder="e.g. Blue"
            />

            <label htmlFor="cardType">Card / packaging type</label>
            <input
              id="cardType"
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              placeholder="e.g. Mainline, Treasure Hunt"
            />

            <label htmlFor="rarity">Rarity</label>
            <select id="rarity" value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="">Select…</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <label htmlFor="condition">Condition</label>
            <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Select…</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

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
              placeholder="0.00"
            />

            <label htmlFor="source">Source</label>
            <input
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Local store, marketplace"
            />

            <label className="toggle-row">
              <span>Show on my public profile</span>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
            </label>
          </div>
        )}

        {error && <p className="field-error">{error}</p>}

        <button
          className={`btn-primary ${saving ? 'btn-tap-pending' : ''}`}
          style={{ marginTop: 24 }}
          disabled={saving || !userId}
        >
          {saving ? 'Saving…' : 'Add to garage'}
        </button>
      </form>
    </main>
  );
}
