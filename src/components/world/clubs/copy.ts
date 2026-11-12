// User-facing copy for clubs (F-22, MV-W07-03/04). Pure — imported by server actions, pages and
// client views (inline strings like every World screen before it, see components/world/copy.ts).
import type {
  ClubErrorCode,
  ClubFeedItem,
  ClubJoinMode,
  ClubNightCadence,
  ClubRole,
} from '@/domain/clubs';

export const CLUB_ERROR_COPY: Record<ClubErrorCode, string> = {
  not_authorized: 'You cannot do that in this club.',
  club_not_found: 'That club is not available to you.',
  invalid_slug: 'Use 3–24 lowercase letters, numbers or underscores for the club address.',
  invalid_name: 'Give the club a name (2–60 characters).',
  slug_taken: 'That club address is taken. Try another.',
  club_limit: 'You can own up to 3 clubs.',
  club_full: 'This club is full.',
  club_rate_limit: 'You joined a lot of clubs just now. Try again in an hour.',
  banned_from_club: 'You cannot join this club.',
  invite_required: 'This club is invite only.',
  invitee_not_found: 'No collector with that handle.',
  invite_limit: 'This club has too many open invitations.',
  no_application: 'That request is no longer waiting.',
  not_a_member: 'That collector is not in the club.',
  not_banned: 'That collector is not banned.',
  owner_cannot_leave: 'Hand the club over to another member before you leave.',
  not_club_staff: 'Only the club’s owner or admins can do that.',
  invalid_cadence: 'Pick weekly or monthly.',
  starts_in_past: 'Pick a start time in the future.',
  capacity_too_high: 'That is more seats than your garage level allows.',
  host_not_eligible: 'Hosting opens at garage level 2. Level up in the World shop first.',
  host_level_too_low: 'Starting a club opens at collector level 2. Keep collecting to level up.',
  host_recent_report: 'Starting a club is paused for 90 days after an upheld report.',
  hosting_suspended: 'Your hosting rights are suspended. Contact support to appeal.',
  language_not_allowed: 'Please keep it friendly — that wording is not allowed here.',
  invalid_input: 'Please check what you entered.',
};

export const JOIN_MODE_LABEL: Record<ClubJoinMode, string> = {
  open: 'Open — anyone can join',
  apply: 'Apply — the club approves requests',
  invite: 'Invite only',
};

export const JOIN_MODE_SHORT: Record<ClubJoinMode, string> = {
  open: 'Open club',
  apply: 'Apply to join',
  invite: 'Invite only',
};

export const ROLE_LABEL: Record<ClubRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export const CADENCE_LABEL: Record<ClubNightCadence, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const WHEN = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

/** "12 Nov" — UTC, hydration-safe. */
export function formatDay(iso: string): string {
  return DAY.format(new Date(iso));
}

/** "Sat 21 Nov, 18:00 UTC" */
export function formatStart(iso: string): string {
  return `${WHEN.format(new Date(iso))} UTC`;
}

/** One line of the club feed. Names are public handles only. */
export function feedLine(item: ClubFeedItem): string {
  const who = item.actor ? `@${item.actor.handle}` : 'A collector';
  const text = (key: string) =>
    typeof item.payload[key] === 'string' ? (item.payload[key] as string) : null;
  switch (item.type) {
    case 'club.created':
      return `${who} started the club`;
    case 'club.joined':
      return `${who} joined`;
    case 'club.left':
      return `${who} left`;
    case 'club.role_changed':
      return `A member is now ${text('role') === 'owner' ? 'the owner' : `a club ${text('role') ?? 'member'}`}`;
    case 'club.updated':
      return 'Club details were updated';
    case 'club.meetup_scheduled':
      return `Meetup scheduled: ${text('title') ?? 'a club meetup'}`;
    case 'club.night_set':
      return `Club night set: ${text('title') ?? 'club night'}`;
    default:
      return 'Club update';
  }
}
