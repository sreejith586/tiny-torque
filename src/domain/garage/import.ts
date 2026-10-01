// CSV / XLSX garage import (MV-S2-08, F-04). Pure header-mapping + row validation (unit-tested)
// plus thin papaparse / SheetJS parse wrappers. No @supabase here — the batched insert goes
// through the garage service (addCollectionItems) in 100-row batches.
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { collectionItemInputSchema } from './schema';
import type { CollectionItemInput } from './types';

export const IMPORT_FIELDS = [
  { key: 'brand', label: 'Brand', required: true },
  { key: 'model', label: 'Model', required: false },
  { key: 'series', label: 'Series', required: false },
  { key: 'scale', label: 'Scale', required: false },
  { key: 'variant', label: 'Variant', required: false },
  { key: 'cardType', label: 'Card / packaging', required: false },
  { key: 'rarity', label: 'Rarity', required: false },
  { key: 'condition', label: 'Condition', required: false },
  { key: 'qty', label: 'Quantity', required: false },
  { key: 'pricePaid', label: 'Price paid', required: false },
  { key: 'source', label: 'Source', required: false },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]['key'];
export type HeaderMapping = Partial<Record<ImportField, string>>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Guess a header→field mapping: exact key/label match first, then a loose "contains". */
export function autoMapHeaders(headers: string[]): HeaderMapping {
  const map: HeaderMapping = {};
  for (const f of IMPORT_FIELDS) {
    const key = norm(f.key);
    const label = norm(f.label);
    const hit =
      headers.find((h) => norm(h) === key || norm(h) === label) ??
      headers.find((h) => norm(h).includes(key) && key.length >= 3);
    if (hit) map[f.key] = hit;
  }
  return map;
}

export type RowResult = { ok: true; input: CollectionItemInput } | { ok: false; errors: string[] };

/** Map one raw row through the header mapping and validate it against the garage input schema. */
export function validateImportRow(raw: Record<string, string>, mapping: HeaderMapping): RowResult {
  const get = (f: ImportField): string => {
    const col = mapping[f];
    return col ? String(raw[col] ?? '').trim() : '';
  };
  const num = (f: ImportField): number | undefined => {
    const v = get(f);
    return v === '' ? undefined : Number(v);
  };

  const candidate = {
    brand: get('brand'),
    model: get('model') || null,
    series: get('series') || null,
    scale: get('scale') || null,
    variant: get('variant') || null,
    cardType: get('cardType') || null,
    rarity: get('rarity') || null,
    condition: get('condition') || null,
    qty: num('qty'),
    pricePaid: num('pricePaid'),
    source: get('source') || null,
  };

  const parsed = collectionItemInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`),
    };
  }
  return { ok: true, input: candidate as CollectionItemInput };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const IMPORT_BATCH_SIZE = 100;

export const CSV_TEMPLATE =
  IMPORT_FIELDS.map((f) => f.label).join(',') +
  '\nHot Wheels,Skyline GT-R,Fast & Furious,1:64,Silver,Mainline,Super Treasure Hunt,mint,1,45,Local store\n';

// ---------- parse wrappers (browser) ----------

export type ParsedSheet = { headers: string[]; rows: Record<string, string>[] };

export async function parseCsv(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve({ headers: res.meta.fields ?? [], rows: res.data }),
      error: (err: unknown) => reject(err instanceof Error ? err : new Error('CSV parse failed')),
    });
  });
}

export async function parseXlsx(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return { headers: [], rows: [] };
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
  return { headers, rows };
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  return file.name.toLowerCase().endsWith('.csv') ? parseCsv(file) : parseXlsx(file);
}
