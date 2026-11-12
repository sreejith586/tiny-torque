// Virtual meetups (F-23, MV-W06-02) — row/enum aliases derived from the GENERATED src/types/supabase.ts
// (D-006) plus the view models the screens render. Nothing here carries PII: other collectors appear as
// public identities (handle + display name) only (rule 15).
import type { Tables, Enums } from '@/lib/supabase/types';
import type { GarageItem } from '@/domain/garage';

export type MeetupRow = Tables<'meetups'>;
export type MeetupRsvpRow = Tables<'meetup_rsvps'>;
export type MeetupInviteRow = Tables<'meetup_invites'>;
export type MeetupShowcaseRow = Tables<'meetup_showcase'>;
export type ClubRow = Tables<'clubs'>;
export type ClubMemberRow = Tables<'club_members'>;

export type MeetupStatus = Enums<'meetup_status'>;
export type MeetupVisibility = Enums<'meetup_visibility'>;
export type MeetupRsvpStatus = Enums<'meetup_rsvp_status'>;
export type MeetupKind = Enums<'meetup_kind'>;

export const MEETUP_VISIBILITIES = [
  'public',
  'followers',
  'club',
  'invite',
] as const satisfies readonly MeetupVisibility[];

export const MEETUP_STATUSES = [
  'draft',
  'scheduled',
  'live',
  'ended',
  'cancelled',
] as const satisfies readonly MeetupStatus[];

/** Reaction keys the room accepts (CHECK constraint on deal_messages.reaction) and how they render. */
export const MEETUP_REACTIONS = ['thumbs', 'fire', 'clap', 'heart', 'flag'] as const;
export type MeetupReaction = (typeof MEETUP_REACTIONS)[number];
export const REACTION_EMOJI: Record<MeetupReaction, string> = {
  thumbs: '👍',
  fire: '🔥',
  clap: '👏',
  heart: '😍',
  flag: '🏁',
};

/** PLACEHOLDER mechanics (07 §3.2; same status as D-064) mirrored from the migration for the UI's
 *  pre-flight copy — the RPCs are the enforcement. */
export const SHOWCASE_LIMIT_DEFAULT = 3;
export const PRO_HOST_CAP_MULTIPLIER = 1.5;
export const HOST_EARLY_START_MINUTES = 15;
export const CANCEL_REFUND_HOURS = 24;
export const MAX_DURATION_MINUTES = 6 * 60;
/** W07 (MV-W07-01), mirrored from 0015b: attendance = 10 min on the room clock, pinged once a minute
 *  (a gap counts for at most 120 s); attend +3 (2/day), host +10 when ≥ 5 attended (2/week); the photo
 *  wall takes 6 photos per attendee while live and for 24 h after the end. */
export const ATTEND_SECONDS = 600;
export const ROOM_PING_SECONDS = 60;
export const ROOM_PING_MAX_GAP_SECONDS = 120;
export const ATTEND_REWARD = 3;
export const HOST_REWARD = 10;
export const HOST_REWARD_MIN_ATTENDED = 5;
export const PHOTO_LIMIT = 6;
export const PHOTO_WALL_HOURS_AFTER_END = 24;

export interface PublicIdentity {
  id: string;
  handle: string;
  displayName: string;
}

export interface MeetupAttendee {
  user: PublicIdentity;
  status: MeetupRsvpStatus;
  role: 'attendee' | 'cohost';
  muted: boolean;
  removed: boolean;
}

export interface MeetupShowcaseEntry {
  id: string;
  userId: string;
  itemId: string;
  position: number;
  /** Best-in-show tally (recounted from the ballots by vote_best_in_show; frozen at `ended`). */
  votes: number;
  /** null when the car is no longer public / was deleted (RLS hides it); the grid shows a placeholder. */
  item: GarageItem | null;
  owner: PublicIdentity | null;
}

/** One row of /world/meetups (upcoming / mine). */
export interface MeetupListItem {
  meetup: MeetupRow;
  host: PublicIdentity;
  goingCount: number;
  /** The viewer's own rsvp status, null when they have none (hosts: null). */
  myRsvp: MeetupRsvpStatus | null;
  isHost: boolean;
}

export interface MeetupViewerState {
  id: string | null;
  isHost: boolean;
  isCohost: boolean;
  /** host or co-host */
  isStaff: boolean;
  rsvp: MeetupRsvpRow | null;
  /** In the room: host / co-host, or going / checked in and not removed. */
  isMember: boolean;
  muted: boolean;
  /** 10 minutes on the room clock reached (rsvp.attended_at) — hosts have no clock: false. */
  attended: boolean;
}

export interface MeetupDetail {
  meetup: MeetupRow;
  host: PublicIdentity;
  viewer: MeetupViewerState;
  attendees: MeetupAttendee[];
  goingCount: number;
  waitlistCount: number;
  showcase: MeetupShowcaseEntry[];
  /** Direct invites — only filled for the host / co-hosts (RLS returns nothing to others). */
  invites: { user: PublicIdentity; createdAt: string }[];
  /** The showcase entry the viewer's ballot is on, null when they have not voted. */
  myVoteShowcaseId: string | null;
  /** Stamped by transition_meetup('end'); null while running or when nobody voted. */
  bestInShow: BestInShow | null;
  /** The photo wall (media rows, newest first). */
  wallPhotos: MeetupPhoto[];
  /** The club hosting this meetup, when there is one. */
  club: MeetupClub | null;
}

export interface BestInShow {
  showcaseId: string;
  votes: number;
  /** null when the winning car is no longer visible to the viewer. */
  entry: MeetupShowcaseEntry | null;
}

export interface MeetupPhoto {
  /** media id — rendered through <MediaImage mediaId> (D-010). */
  id: string;
  owner: PublicIdentity | null;
  ownerId: string;
  createdAt: string;
}

export interface MeetupClub {
  id: string;
  slug: string;
  name: string;
}

/** What the create form needs before it submits anything (07 §2.3 capacity by level, §3.2 fee). */
export interface HostCapacity {
  cap: number;
  level: number;
  levelName: string;
  isPro: boolean;
  /** Fee tiers the form shows next to the capacity field. */
  fee: (capacity: number) => number;
}
