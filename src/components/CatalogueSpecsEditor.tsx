'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { verifySpecs, parseStoredSpecs, CatalogError, DRIVETRAINS } from '@/domain/catalog';
import type { CarSpecs, CatalogModelRow } from '@/domain/catalog';

// Admin editor for a catalogue model's real-car specs (F-25 racing input, MV-W08-prep).
// Composed only from the prototype's pieces — native inputs/select, btn-secondary, muted,
// field-error (D-027); it is an admin-only screen the prototype never had. Saving calls the
// admin RPC through domain/catalog.verifySpecs (D-007/D-021): the row becomes verified specs.

const NUMBER_FIELDS: ReadonlyArray<{
  key: Exclude<keyof CarSpecs, 'drivetrain'>;
  label: string;
  step: string;
}> = [
  { key: 'power_kw', label: 'Power (kW)', step: '1' },
  { key: 'torque_nm', label: 'Torque (Nm)', step: '1' },
  { key: 'weight_kg', label: 'Kerb weight (kg)', step: '1' },
  { key: 'zero_to_100_s', label: '0–100 km/h (s)', step: '0.1' },
  { key: 'top_speed_kmh', label: 'Top speed (km/h)', step: '1' },
  { key: 'drag_cd', label: 'Drag coefficient (Cd)', step: '0.01' },
  { key: 'model_year', label: 'Model year (real car)', step: '1' },
];

const ERROR_COPY: Record<string, string> = {
  specs_invalid: 'Check the values — something is out of range or missing.',
  not_authorized: 'Only admins can verify specs.',
  model_not_found: 'This model no longer exists.',
};

type Draft = Record<string, string>;

function toDraft(specs: CarSpecs): Draft {
  const d: Draft = {};
  for (const f of NUMBER_FIELDS) {
    const v = specs[f.key];
    d[f.key] = v === undefined ? '' : String(v);
  }
  d.drivetrain = specs.drivetrain ?? '';
  return d;
}

/** Native inputs → the shape carSpecsSchema expects (blank = key absent). */
function fromDraft(d: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of NUMBER_FIELDS) {
    const raw = d[f.key]?.trim() ?? '';
    if (raw !== '') out[f.key] = Number(raw);
  }
  if (d.drivetrain) out.drivetrain = d.drivetrain;
  return out;
}

export default function CatalogueSpecsEditor({ model }: { model: CatalogModelRow }) {
  const supabase = createClient();
  const router = useRouter();
  const stored = parseStoredSpecs(model.specs);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(stored));
  const [source, setSource] = useState(model.specs_source ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = model.specs_verified_at
    ? 'verified'
    : Object.keys(stored).length > 0
      ? 'proposed'
      : 'none';

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await verifySpecs(supabase, model.id, fromDraft(draft), source);
      setOpen(false);
      router.refresh();
    } catch (e) {
      const code = e instanceof CatalogError ? e.code : '';
      setError(ERROR_COPY[code] ?? 'Could not save the specs. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const id = `specs-${model.id}`;
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span className="muted" style={{ fontSize: 12 }}>
          Specs: {state}
          {model.specs_source ? ` · ${model.specs_source}` : ''}
        </span>
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', fontSize: 12, padding: '4px 10px' }}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close' : state === 'none' ? 'Add specs' : 'Edit specs'}
        </button>
      </div>
      {open && (
        <div id={id} style={{ marginTop: 8 }}>
          {NUMBER_FIELDS.map((f) => (
            <div key={f.key} style={{ marginBottom: 8 }}>
              <label htmlFor={`${id}-${f.key}`}>{f.label}</label>
              <input
                id={`${id}-${f.key}`}
                type="number"
                inputMode="decimal"
                step={f.step}
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                disabled={busy}
              />
            </div>
          ))}
          <div style={{ marginBottom: 8 }}>
            <label htmlFor={`${id}-drivetrain`}>Drivetrain</label>
            <select
              id={`${id}-drivetrain`}
              value={draft.drivetrain ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, drivetrain: e.target.value }))}
              disabled={busy}
            >
              <option value="">Unknown</option>
              {DRIVETRAINS.map((dt) => (
                <option key={dt} value={dt}>
                  {dt.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor={`${id}-source`}>Source (manufacturer, wiki, …)</label>
            <input
              id={`${id}-source`}
              type="text"
              maxLength={80}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={busy}
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto' }}
            disabled={busy}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save as verified'}
          </button>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Leave a field blank if unknown. Fantasy castings stay blank and race on their archetype.
          </p>
        </div>
      )}
    </div>
  );
}
