import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CatalogError,
  carSpecsSchema,
  carSpecsInputSchema,
  getSpecs,
  hasAnySpec,
  parseStoredSpecs,
  proposeSpecs,
  verifySpecs,
} from './service';
import type { Client } from '@/lib/supabase/types';
import type { CatalogModelRow } from './types';

// Mocked repo (D-007: tests never import a repo either — the mock object stands in for it).
const repo = vi.hoisted(() => ({
  listVerifiedBrands: vi.fn(),
  searchModels: vi.fn(),
  getModelById: vi.fn(),
  listAllBrands: vi.fn(),
  listProposedModels: vi.fn(),
  verifyModel: vi.fn(),
  rejectModel: vi.fn(),
  getSpecsRow: vi.fn(),
  proposeSpecs: vi.fn(),
  verifySpecs: vi.fn(),
  listModelsWithProposedSpecs: vi.fn(),
}));
vi.mock('./repo', () => repo);

const supabase = {} as Client;
const MODEL = '33333333-3333-4333-8333-333333333333';
const MEMBER = '11111111-1111-4111-8111-111111111111';
const ADMIN = '22222222-2222-4222-8222-222222222222';

const R34 = {
  power_kw: 206,
  torque_nm: 392,
  weight_kg: 1560,
  zero_to_100_s: 4.9,
  top_speed_kmh: 250,
  drivetrain: 'awd',
  drag_cd: 0.34,
  model_year: 1999,
} as const;

function row(over: Partial<CatalogModelRow> = {}): CatalogModelRow {
  return {
    id: MODEL,
    brand_id: '44444444-4444-4444-8444-444444444444',
    name: 'Nissan Skyline GT-R R34',
    series: null,
    scale: '1:64',
    year: 2020,
    casting_code: null,
    color_variants: [],
    status: 'verified',
    merged_into_id: null,
    proposed_by: null,
    verified_by: null,
    created_at: '2026-11-03T00:00:00.000Z',
    search: null,
    specs: {},
    specs_source: null,
    specs_proposed_by: null,
    specs_verified_by: null,
    specs_verified_at: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('carSpecsSchema (mirrors catalog_specs_valid)', () => {
  it('accepts a full real-car spec and the empty object', () => {
    expect(carSpecsSchema.parse(R34)).toEqual(R34);
    expect(carSpecsSchema.parse({})).toEqual({});
  });
  it('rejects unknown keys, bad enums, strings-for-numbers and out-of-range values', () => {
    expect(carSpecsSchema.safeParse({ horsepower: 300 }).success).toBe(false);
    expect(carSpecsSchema.safeParse({ drivetrain: '4wd' }).success).toBe(false);
    expect(carSpecsSchema.safeParse({ power_kw: '206' }).success).toBe(false);
    expect(carSpecsSchema.safeParse({ power_kw: 0 }).success).toBe(false);
    expect(carSpecsSchema.safeParse({ weight_kg: 12 }).success).toBe(false);
    expect(carSpecsSchema.safeParse({ top_speed_kmh: 9999 }).success).toBe(false);
    expect(carSpecsSchema.safeParse({ model_year: 1999.5 }).success).toBe(false);
    expect(carSpecsSchema.safeParse([1, 2]).success).toBe(false);
  });
  it('the input schema refuses an empty proposal; the stored reader is lenient', () => {
    expect(carSpecsInputSchema.safeParse({}).success).toBe(false);
    expect(carSpecsInputSchema.safeParse({ power_kw: 100 }).success).toBe(true);
    expect(parseStoredSpecs({ garbage: true })).toEqual({});
    expect(parseStoredSpecs(null)).toEqual({});
    expect(hasAnySpec({})).toBe(false);
    expect(hasAnySpec({ drivetrain: 'rwd' })).toBe(true);
  });
});

describe('getSpecs', () => {
  it('returns null for an invisible/unknown model', async () => {
    repo.getSpecsRow.mockResolvedValue(null);
    expect(await getSpecs(supabase, MODEL)).toBeNull();
  });
  it('maps a pending proposal as unverified and a verified row as verified', async () => {
    repo.getSpecsRow.mockResolvedValue(
      row({ specs: { power_kw: 206 }, specs_source: 'wiki', specs_proposed_by: MEMBER })
    );
    const pending = await getSpecs(supabase, MODEL);
    expect(pending).toMatchObject({
      modelId: MODEL,
      specs: { power_kw: 206 },
      verified: false,
      source: 'wiki',
      proposedBy: MEMBER,
    });

    repo.getSpecsRow.mockResolvedValue(
      row({
        specs: R34,
        specs_verified_by: ADMIN,
        specs_verified_at: '2026-11-03T10:00:00.000Z',
        specs_source: 'manufacturer',
      })
    );
    const verified = await getSpecs(supabase, MODEL);
    expect(verified?.verified).toBe(true);
    expect(verified?.specs).toEqual(R34);
    expect(verified?.verifiedBy).toBe(ADMIN);
  });
});

describe('proposeSpecs', () => {
  it('validates before calling the RPC — invalid shape never reaches the DB', async () => {
    await expect(proposeSpecs(supabase, MODEL, { horsepower: 300 }, 'wiki')).rejects.toThrow(
      CatalogError
    );
    await expect(proposeSpecs(supabase, MODEL, {}, 'wiki')).rejects.toMatchObject({
      code: 'specs_invalid',
    });
    await expect(
      proposeSpecs(supabase, MODEL, { power_kw: 1 }, 'x'.repeat(81))
    ).rejects.toMatchObject({ code: 'specs_invalid' });
    expect(repo.proposeSpecs).not.toHaveBeenCalled();
  });
  it('passes the parsed specs + trimmed source to the RPC and maps the row', async () => {
    repo.proposeSpecs.mockResolvedValue(
      row({ specs: { power_kw: 206 }, specs_source: 'wiki', specs_proposed_by: MEMBER })
    );
    const out = await proposeSpecs(supabase, MODEL, { power_kw: 206 }, '  wiki ');
    expect(repo.proposeSpecs).toHaveBeenCalledWith(supabase, MODEL, { power_kw: 206 }, 'wiki');
    expect(out.verified).toBe(false);
    expect(out.specs).toEqual({ power_kw: 206 });
  });
  it('an empty source is omitted rather than sent as ""', async () => {
    repo.proposeSpecs.mockResolvedValue(row({ specs: { power_kw: 206 } }));
    await proposeSpecs(supabase, MODEL, { power_kw: 206 }, '');
    expect(repo.proposeSpecs).toHaveBeenCalledWith(supabase, MODEL, { power_kw: 206 }, undefined);
  });
  it('maps the RPC refusals (verified wins over proposed) to CatalogError', async () => {
    repo.proposeSpecs.mockRejectedValue(new Error('specs_already_verified'));
    await expect(proposeSpecs(supabase, MODEL, { power_kw: 1 })).rejects.toMatchObject({
      code: 'specs_already_verified',
    });
    repo.proposeSpecs.mockRejectedValue(new Error('model_not_found'));
    await expect(proposeSpecs(supabase, MODEL, { power_kw: 1 })).rejects.toMatchObject({
      code: 'model_not_found',
    });
    repo.proposeSpecs.mockRejectedValue(new Error('network down'));
    await expect(proposeSpecs(supabase, MODEL, { power_kw: 1 })).rejects.toThrow('network down');
  });
});

describe('verifySpecs', () => {
  it('validates, calls the RPC and returns a verified read model', async () => {
    repo.verifySpecs.mockResolvedValue(
      row({
        specs: R34,
        specs_verified_by: ADMIN,
        specs_verified_at: '2026-11-03T10:00:00.000Z',
        specs_source: 'manufacturer',
      })
    );
    const out = await verifySpecs(supabase, MODEL, R34, 'manufacturer');
    expect(repo.verifySpecs).toHaveBeenCalledWith(supabase, MODEL, R34, 'manufacturer');
    expect(out.verified).toBe(true);
    expect(out.verifiedBy).toBe(ADMIN);
  });
  it('rejects an invalid shape before the RPC and maps not_authorized from it', async () => {
    await expect(verifySpecs(supabase, MODEL, { drivetrain: '4wd' })).rejects.toMatchObject({
      code: 'specs_invalid',
    });
    expect(repo.verifySpecs).not.toHaveBeenCalled();
    repo.verifySpecs.mockRejectedValue(new Error('not_authorized'));
    await expect(verifySpecs(supabase, MODEL, { power_kw: 1 })).rejects.toMatchObject({
      code: 'not_authorized',
    });
  });
});
