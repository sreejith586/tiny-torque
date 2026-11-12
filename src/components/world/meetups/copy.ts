// User-facing copy for virtual meetups (F-23, MV-W06-03/04). Pure — imported by server actions,
// pages and client views. (Rule 11's t() keys: src/lib/i18n has never existed in this codebase;
// inline strings like every sprint before, see components/world/copy.ts.)
import type { MeetupErrorCode, MeetupStatus, MeetupVisibility } from '@/domain/meetups';

export const MEETUP_ERROR_COPY: Record<MeetupErrorCode, string> = {
  not_authorized: 'Sign in to join meetups.',
  meetup_not_found: 'That meetup is not available to you.',
  host_not_eligible: 'Hosting opens at garage level 2. Level up in the World shop first.',
  capacity_too_high: 'That is more seats than your garage level allows.',
  capacity_below_going: 'You cannot set capacity below the people already going.',
  starts_in_past: 'Pick a start time in the future.',
  not_club_member: 'You need to be a member of that club.',
  insufficient_balance: 'Not enough credits for the hosting fee.',
  invalid_transition: 'That meetup has moved on — reload to see its current state.',
  too_early: 'You can open the room 15 minutes before the start.',
  invalid_status: 'That is not a valid RSVP.',
  host_cannot_rsvp: 'You are the host — you are already in.',
  meetup_closed: 'This meetup is no longer taking changes.',
  removed_by_host: 'The host removed you from this meetup.',
  not_attending: 'RSVP first to bring cars to the showcase.',
  too_many_items: 'You can bring up to 3 cars.',
  item_not_public: 'Only your public cars can be showcased. Make it public in your garage first.',
  invitee_not_found: 'No collector with that handle.',
  invite_limit: 'This meetup has reached its invite limit.',
  message_rate_limit: 'You are posting a little fast. Try again in a moment.',
  rsvp_rate_limit: 'Too many RSVP changes in one hour. Try again later.',
  rpc_only_column: 'That field cannot be edited directly.',
  voting_closed: 'Voting is only open while the meetup is live.',
  entry_not_found: 'That car is no longer on the table.',
  own_entry: 'You cannot vote for your own car.',
  photo_wall_closed: 'The photo wall takes photos while the meetup is live and for a day after.',
  photo_limit: 'You can post up to 6 photos per meetup.',
  photo_not_found: 'That photo is no longer on the wall.',
  invalid_photo: 'That photo could not be added.',
  not_club_staff: 'Only a club’s owner or admins can host for the club.',
  host_level_too_low: 'Hosting opens at collector level 2. Keep collecting to level up.',
  host_recent_report: 'Hosting is paused for 90 days after an upheld report.',
  hosting_suspended: 'Your hosting rights are suspended. Contact support to appeal.',
  language_not_allowed: 'Please keep it friendly — that wording is not allowed here.',
  room_closed: 'The room is closed right now.',
  invalid_input: 'Please check what you entered.',
};

export const VISIBILITY_LABEL: Record<MeetupVisibility, string> = {
  public: 'Public — any collector can join',
  followers: 'Followers only',
  club: 'Club members only',
  invite: 'Invite only',
};

export const VISIBILITY_SHORT: Record<MeetupVisibility, string> = {
  public: 'Public',
  followers: 'Followers',
  club: 'Club',
  invite: 'Invite only',
};

export const STATUS_LABEL: Record<MeetupStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live now',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

/** The prototype's offer status pills, reused for meetup states. */
export const STATUS_PILL_CLASS: Record<MeetupStatus, string> = {
  draft: 'status-pending',
  scheduled: 'status-reserved',
  live: 'status-accepted',
  ended: 'status-completed',
  cancelled: 'status-cancelled',
};

const WHEN = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

/** "Sat 21 Nov, 18:00 – 20:00 UTC" — rendered on the server, so always UTC and hydration-safe. The
 *  pilot is UAE + India (D-001, two zones); a local-time label needs the viewer's zone and is a
 *  follow-up noted in PROGRESS-WORLD. */
export function formatWhen(startsAt: string, endsAt: string): string {
  return `${WHEN.format(new Date(startsAt))} – ${TIME.format(new Date(endsAt))} UTC`;
}

/** Default start for the create form: two days out, on the hour, as a `datetime-local` value. UTC
 *  wall clock from the server — the browser reads it as local, which is fine for a default. */
export function defaultStartInput(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 2 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`;
}
