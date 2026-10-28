/** Error codes the World service raises. The RPC-originated ones are the exact `raise exception`
 *  messages from 0013_world_rpcs / spend_tokens, so the UI can map them to copy. */
export type WorldErrorCode =
  | 'not_authorized'
  | 'garage_not_found'
  | 'insufficient_balance'
  | 'xp_level_too_low'
  | 'max_level'
  | 'item_not_found'
  | 'earned_only'
  | 'level_too_low'
  | 'already_owned'
  | 'layout_invalid'
  | 'too_many_slots'
  | 'too_many_decor'
  | 'slot_out_of_range'
  | 'duplicate_slot'
  | 'duplicate_item'
  | 'item_not_public'
  | 'item_not_owned';

export class WorldError extends Error {
  readonly code: WorldErrorCode;
  constructor(code: WorldErrorCode) {
    super(code);
    this.code = code;
    this.name = 'WorldError';
  }
}

const RPC_CODES: WorldErrorCode[] = [
  'not_authorized',
  'insufficient_balance',
  'xp_level_too_low',
  'max_level',
  'item_not_found',
  'earned_only',
  'level_too_low',
  'already_owned',
];

/** Maps a PostgREST/Postgres error whose message is one of the RPCs' `raise exception` codes to a
 *  WorldError; anything else is rethrown untouched (same pattern as domain/tokens' spendOn). */
export function rethrowAsWorldError(e: unknown): never {
  const message = (e as { message?: string } | null)?.message ?? '';
  const code = RPC_CODES.find((c) => message.includes(c));
  if (code) throw new WorldError(code);
  throw e;
}
