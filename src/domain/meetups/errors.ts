/** Error codes the meetups service raises. RPC-originated ones are the exact `raise exception` messages
 *  of 0015_clubs_meetups (and spend_tokens), so the UI can map them to copy — same shape as domain/world. */
export type MeetupErrorCode =
  | 'not_authorized'
  | 'meetup_not_found'
  | 'host_not_eligible'
  | 'capacity_too_high'
  | 'capacity_below_going'
  | 'starts_in_past'
  | 'not_club_member'
  | 'insufficient_balance'
  | 'invalid_transition'
  | 'too_early'
  | 'invalid_status'
  | 'host_cannot_rsvp'
  | 'meetup_closed'
  | 'removed_by_host'
  | 'not_attending'
  | 'too_many_items'
  | 'item_not_public'
  | 'invitee_not_found'
  | 'invite_limit'
  | 'message_rate_limit'
  | 'rsvp_rate_limit'
  | 'rpc_only_column'
  | 'voting_closed'
  | 'entry_not_found'
  | 'own_entry'
  | 'photo_wall_closed'
  | 'photo_limit'
  | 'photo_not_found'
  | 'invalid_photo'
  | 'not_club_staff'
  | 'host_level_too_low'
  | 'host_recent_report'
  | 'hosting_suspended'
  | 'language_not_allowed'
  | 'room_closed'
  | 'invalid_input';

export class MeetupError extends Error {
  readonly code: MeetupErrorCode;
  constructor(code: MeetupErrorCode) {
    super(code);
    this.code = code;
    this.name = 'MeetupError';
  }
}

const RPC_CODES: MeetupErrorCode[] = [
  'not_authorized',
  'meetup_not_found',
  'host_not_eligible',
  'capacity_too_high',
  'capacity_below_going',
  'starts_in_past',
  'not_club_member',
  'insufficient_balance',
  'invalid_transition',
  'too_early',
  'invalid_status',
  'host_cannot_rsvp',
  'meetup_closed',
  'removed_by_host',
  'not_attending',
  'too_many_items',
  'item_not_public',
  'invitee_not_found',
  'invite_limit',
  'message_rate_limit',
  'rsvp_rate_limit',
  'rpc_only_column',
  'voting_closed',
  'entry_not_found',
  'own_entry',
  'photo_wall_closed',
  'photo_limit',
  'photo_not_found',
  'invalid_photo',
  'not_club_staff',
  'host_level_too_low',
  'host_recent_report',
  'hosting_suspended',
];

/** Maps a PostgREST/Postgres error whose message carries one of the RPCs' codes to a MeetupError; an
 *  RLS refusal on the room (42501 with no code) becomes room_closed; anything else is rethrown. */
export function rethrowAsMeetupError(e: unknown): never {
  const err = (e ?? {}) as { message?: string; code?: string };
  const message = err.message ?? '';
  const code = RPC_CODES.find((c) => message.includes(c));
  if (code) throw new MeetupError(code);
  if (err.code === '42501') throw new MeetupError('room_closed');
  throw e;
}
