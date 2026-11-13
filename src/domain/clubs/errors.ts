/** Error codes the clubs service raises. RPC-originated ones are the exact `raise exception` messages
 *  of 0015b_world_best_in_show_clubs, so the UI can map them to copy — same shape as domain/meetups. */
export type ClubErrorCode =
  | 'not_authorized'
  | 'club_not_found'
  | 'invalid_slug'
  | 'invalid_name'
  | 'slug_taken'
  | 'club_limit'
  | 'club_full'
  | 'club_rate_limit'
  | 'banned_from_club'
  | 'invite_required'
  | 'invitee_not_found'
  | 'invite_limit'
  | 'no_application'
  | 'not_a_member'
  | 'not_banned'
  | 'owner_cannot_leave'
  | 'not_club_staff'
  | 'invalid_cadence'
  | 'starts_in_past'
  | 'capacity_too_high'
  | 'host_not_eligible'
  | 'host_level_too_low'
  | 'host_recent_report'
  | 'hosting_suspended'
  | 'language_not_allowed'
  | 'invalid_input';

export class ClubError extends Error {
  readonly code: ClubErrorCode;
  constructor(code: ClubErrorCode) {
    super(code);
    this.code = code;
    this.name = 'ClubError';
  }
}

const RPC_CODES: ClubErrorCode[] = [
  'club_not_found',
  'invalid_slug',
  'invalid_name',
  'slug_taken',
  'club_limit',
  'club_full',
  'club_rate_limit',
  'banned_from_club',
  'invite_required',
  'invitee_not_found',
  'invite_limit',
  'no_application',
  'not_a_member',
  'not_banned',
  'owner_cannot_leave',
  'not_club_staff',
  'invalid_cadence',
  'starts_in_past',
  'capacity_too_high',
  'host_not_eligible',
  'host_level_too_low',
  'host_recent_report',
  'hosting_suspended',
  'not_authorized',
];

/** Maps a PostgREST/Postgres error whose message carries one of the RPCs' codes to a ClubError; a
 *  bare 42501 becomes not_authorized; anything else is rethrown. */
export function rethrowAsClubError(e: unknown): never {
  const err = (e ?? {}) as { message?: string; code?: string };
  const message = err.message ?? '';
  const code = RPC_CODES.find((c) => message.includes(c));
  if (code) throw new ClubError(code);
  if (err.code === '42501') throw new ClubError('not_authorized');
  throw e;
}
