// Clubs (F-22, MV-W07-02) — row/enum aliases derived from the GENERATED src/types/supabase.ts (D-006)
// plus the view models the screens render. Other collectors appear as public identities only
// (handle + display name, rule 15).
import type { Tables, Enums } from '@/lib/supabase/types';
import type { GarageItem } from '@/domain/garage';
import type { MeetupRow, PublicIdentity } from '@/domain/meetups';

export type ClubRow = Tables<'clubs'>;
export type ClubMemberRow = Tables<'club_members'>;
export type ClubNightRow = Tables<'club_night_templates'>;

export type ClubJoinMode = Enums<'club_join_mode'>;
export type ClubRole = Enums<'club_member_role'>;
export type ClubMemberStatus = Enums<'club_member_status'>;

export const CLUB_JOIN_MODES = [
  'open',
  'apply',
  'invite',
] as const satisfies readonly ClubJoinMode[];
export const CLUB_ROLES = ['owner', 'admin', 'member'] as const satisfies readonly ClubRole[];
export const CLUB_NIGHT_CADENCES = ['weekly', 'monthly'] as const;
export type ClubNightCadence = (typeof CLUB_NIGHT_CADENCES)[number];

/** PLACEHOLDER limits mirrored from 0015b for pre-flight copy — the RPCs are the enforcement. */
export const MAX_CLUBS_OWNED = 3;
export const MAX_CLUB_MEMBERS = 500;
export const CLUB_NIGHT_WINDOW_DAYS = 7;
/** F-28: hosting a meetup / owning a club needs F-13 level 2 ("Collector"). */
export const HOST_MIN_XP_LEVEL = 2;
export const HOST_REPORT_COOLDOWN_DAYS = 90;

/** How the viewer stands with a club. `invited` = a pending row someone on the staff created. */
export interface ClubViewerState {
  id: string | null;
  role: ClubRole | null;
  status: ClubMemberStatus | null;
  invited: boolean;
  isMember: boolean;
  isStaff: boolean;
  isOwner: boolean;
}

export interface ClubMember {
  user: PublicIdentity;
  role: ClubRole;
  status: ClubMemberStatus;
  invited: boolean;
  joinedAt: string;
}

/** One row of /world/clubs. */
export interface ClubListItem {
  club: ClubRow;
  memberCount: number;
  myStatus: ClubMemberStatus | null;
  myRole: ClubRole | null;
  invited: boolean;
}

export interface ClubFeedItem {
  id: number;
  type: string;
  actor: PublicIdentity | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface ClubFeaturedCar {
  owner: PublicIdentity;
  item: GarageItem;
}

export interface ClubDetail {
  club: ClubRow;
  owner: PublicIdentity;
  viewer: ClubViewerState;
  memberCount: number;
  /** Active roster (empty when the viewer may not read it: a closed club and not a member). */
  members: ClubMember[];
  /** Applications waiting for the staff — filled for owner / admins only. */
  applications: ClubMember[];
  /** Invitations not yet accepted — staff only. */
  invitations: ClubMember[];
  /** Banned collectors — staff only. */
  banned: ClubMember[];
  /** Members' featured cars (their World garage's featured car, when public). */
  featured: ClubFeaturedCar[];
  feed: ClubFeedItem[];
  /** Upcoming club meetups the viewer may see (the host's own drafts included). */
  meetups: MeetupRow[];
  night: ClubNightRow | null;
}

/** A club the viewer can host meetups for (owner / admin) — the create form's "Host as" options. */
export interface StaffClub {
  id: string;
  slug: string;
  name: string;
}
