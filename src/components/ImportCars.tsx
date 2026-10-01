'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addCollectionItems } from '@/domain/garage';
import type { CollectionItemInput } from '@/domain/garage';
import {
  IMPORT_FIELDS,
  IMPORT_BATCH_SIZE,
  CSV_TEMPLATE,
  autoMapHeaders,
  validateImportRow,
  parseSpreadsheet,
  chunk,
  type HeaderMapping,
  type ParsedSheet,
} from '@/domain/garage/import';

type Step = 'select' | 'map' | 'importing' | 'done';

export default function ImportCars({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState<Step>('select');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<HeaderMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [skipped, setSkipped] = useState(0);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mini-vault-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.rows.length === 0) {
        setError('That file has no data rows.');
        return;
      }
      setSheet(parsed);
      setMapping(autoMapHeaders(parsed.headers));
      setStep('map');
    } catch {
      setError('Could not read that file. Use the CSV/XLSX template.');
    }
  }

  // Validate every row against the current mapping (recomputed on render — cheap for a preview).
  const results = sheet ? sheet.rows.map((r) => validateImportRow(r, mapping)) : [];
  const valid = results.filter((r) => r.ok);
  const invalid = results.filter((r) => !r.ok);

  async function handleImport() {
    setStep('importing');
    setError(null);
    const inputs = valid
      .map((r) => (r.ok ? r.input : null))
      .filter(Boolean) as CollectionItemInput[];
    setSkipped(invalid.length);
    try {
      let done = 0;
      for (const batch of chunk(inputs, IMPORT_BATCH_SIZE)) {
        await addCollectionItems(supabase, userId, batch);
        done += batch.length;
        setImported(done);
        setProgress(Math.round((done / inputs.length) * 100));
      }
      setStep('done');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Import failed partway. Some rows may have been added.'
      );
      setStep('map');
    }
  }

  if (step === 'done') {
    return (
      <div className="panel">
        <h2 style={{ fontSize: 18 }}>Import complete</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Added {imported} {imported === 1 ? 'car' : 'cars'}
          {skipped > 0 ? ` · skipped ${skipped} invalid ${skipped === 1 ? 'row' : 'rows'}` : ''}.
        </p>
        <button
          className="btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => {
            router.push('/garage');
            router.refresh();
          }}
        >
          Go to my garage
        </button>
      </div>
    );
  }

  return (
    <div>
      {step === 'select' && (
        <div className="panel">
          <p className="muted">
            Upload a CSV or Excel file. Not sure of the format?{' '}
            <button
              type="button"
              className="btn-secondary"
              style={{ width: 'auto' }}
              onClick={downloadTemplate}
            >
              Download template
            </button>
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ marginTop: 14 }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {error && <p className="field-error">{error}</p>}
        </div>
      )}

      {step === 'map' && sheet && (
        <>
          <div className="panel" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16 }}>Match your columns</h2>
            {IMPORT_FIELDS.map((f) => (
              <div className="toggle-row" key={f.key}>
                <span className="muted">
                  {f.label}
                  {f.required ? ' *' : ''}
                </span>
                <select
                  value={mapping[f.key] ?? ''}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))
                  }
                  style={{ width: 'auto' }}
                >
                  <option value="">— skip —</option>
                  {sheet.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <p>
              <strong>{valid.length}</strong> of {results.length} rows ready to import
              {invalid.length > 0 ? ` · ${invalid.length} will be skipped` : ''}.
            </p>
            {invalid.length > 0 && invalid[0] && !invalid[0].ok && (
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                First problem: {invalid[0].errors[0]}
              </p>
            )}
          </div>

          {error && <p className="field-error">{error}</p>}

          <button className="btn-primary" disabled={valid.length === 0} onClick={handleImport}>
            Import {valid.length} {valid.length === 1 ? 'car' : 'cars'}
          </button>
        </>
      )}

      {step === 'importing' && (
        <div className="panel">
          <p>Importing… {imported} added</p>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', marginTop: 10 }}>
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'var(--orange)',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
