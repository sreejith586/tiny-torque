// Catalogue read model — components/routes import from here (D-007).
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';
import { CatalogError, rethrowAsCatalogError } from './errors';
import { carSpecsInputSchema, parseStoredSpecs, specsSourceSchema } from './specs';
import type { CarSpecs } from './specs';
import type { CatalogModelRow } from './types';

export const listVerifiedBrands = repo.listVerifiedBrands;
export const searchCatalogModels = repo.searchModels;
export const getCatalogModel = repo.getModelById;

export type { CatalogBrandRow, CatalogModelRow } from './types';

export const listAllBrands = repo.listAllBrands;
export const listProposedModels = repo.listProposedModels;
export const verifyModel = repo.verifyModel;
export const rejectModel = repo.rejectModel;

// ---------- car specs (F-25 racing input, MV-W08-prep, D-075) ----------
// D-008's proposed→verified pattern applied to one jsonb column: a member or the AI scan
// proposes, an admin verifies; verified specs can't be overwritten by a later proposal (the RPC
// refuses with `specs_already_verified`). Both RPCs emit their domain event inside the DB
// transaction (D-009) — nothing is emitted app-side here, so a failed write leaves no event.

export { CatalogError } from './errors';
export type { CatalogErrorCode } from './errors';
export {
  carSpecsSchema,
  carSpecsInputSchema,
  parseStoredSpecs,
  hasAnySpec,
  DRIVETRAINS,
  SPEC_KEYS,
  SPEC_BOUNDS,
  EMPTY_SPECS,
} from './specs';
export type { CarSpecs, Drivetrain, SpecKey } from './specs';

export interface CatalogModelSpecs {
  modelId: string;
  specs: CarSpecs;
  /** false = `{}` (unknown) or a pending proposal. Racing should treat only `true` as real. */
  verified: boolean;
  source: string | null;
  proposedBy: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export function toModelSpecs(row: repo.CatalogSpecsColumns): CatalogModelSpecs {
  return {
    modelId: row.id,
    specs: parseStoredSpecs(row.specs),
    verified: row.specs_verified_at !== null,
    source: row.specs_source,
    proposedBy: row.specs_proposed_by,
    verifiedBy: row.specs_verified_by,
    verifiedAt: row.specs_verified_at,
  };
}

/** The specs on a model, or null when the model isn't visible to the caller / doesn't exist. */
export async function getSpecs(
  supabase: Client,
  modelId: string
): Promise<CatalogModelSpecs | null> {
  const row = await repo.getSpecsRow(supabase, modelId);
  return row ? toModelSpecs(row) : null;
}

/** Admin queue: models whose specs are a pending proposal. */
export const listModelsWithProposedSpecs = repo.listModelsWithProposedSpecs;

function parseInput(input: unknown, source: unknown): { specs: CarSpecs; source?: string } {
  const specs = carSpecsInputSchema.safeParse(input);
  if (!specs.success) throw new CatalogError('specs_invalid');
  if (source === undefined || source === null || source === '') return { specs: specs.data };
  const src = specsSourceSchema.safeParse(source);
  if (!src.success) throw new CatalogError('specs_invalid');
  return { specs: specs.data, source: src.data };
}

/** Member / AI proposal (RPC `propose_catalog_specs`, emits catalog.specs_proposed). */
export async function proposeSpecs(
  supabase: Client,
  modelId: string,
  input: unknown,
  source?: unknown
): Promise<CatalogModelSpecs> {
  const v = parseInput(input, source);
  let row: CatalogModelRow;
  try {
    row = await repo.proposeSpecs(supabase, modelId, v.specs, v.source);
  } catch (e) {
    rethrowAsCatalogError(e);
  }
  return toModelSpecs(row);
}

/** Admin verification (RPC `verify_catalog_specs`, emits catalog.specs_verified). The RPC checks
 *  is_admin() itself — the page's admin gate is defense in depth, not the authority. */
export async function verifySpecs(
  supabase: Client,
  modelId: string,
  input: unknown,
  source?: unknown
): Promise<CatalogModelSpecs> {
  const v = parseInput(input, source);
  let row: CatalogModelRow;
  try {
    row = await repo.verifySpecs(supabase, modelId, v.specs, v.source);
  } catch (e) {
    rethrowAsCatalogError(e);
  }
  return toModelSpecs(row);
}
