/** Error codes the catalogue specs service raises. The RPC-originated ones are the exact
 *  `raise exception` messages from 0022_catalog_specs, so the UI can map them to copy. */
export type CatalogErrorCode =
  'not_authorized' | 'model_not_found' | 'specs_invalid' | 'specs_already_verified';

export class CatalogError extends Error {
  readonly code: CatalogErrorCode;
  constructor(code: CatalogErrorCode) {
    super(code);
    this.code = code;
    this.name = 'CatalogError';
  }
}

const RPC_CODES: CatalogErrorCode[] = [
  'not_authorized',
  'model_not_found',
  'specs_invalid',
  'specs_already_verified',
];

/** Maps a PostgREST/Postgres error whose message is one of the RPCs' `raise exception` codes to a
 *  CatalogError; anything else is rethrown untouched (same pattern as domain/world). */
export function rethrowAsCatalogError(e: unknown): never {
  const message = (e as { message?: string } | null)?.message ?? '';
  const code = RPC_CODES.find((c) => message.includes(c));
  if (code) throw new CatalogError(code);
  throw e;
}
