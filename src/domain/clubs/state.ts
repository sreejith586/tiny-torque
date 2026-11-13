// Club rules — the client-side mirror of the club RPCs in 0015b (F-22), the role domain/meetups/state.ts
// plays for transition_meetup. The DB is the enforcement; these pure helpers decide which buttons a
// viewer sees and what the copy says, so they must stay in lock-step with the migration. Table-tested
// in state.test.ts.
import type { ClubJoinMode, ClubMemberStatus, ClubNightCadence, ClubRole } from './types';
import { CLUB_NIGHT_WINDOW_DAYS, HOST_MIN_XP_LEVEL } from './types';

export interface Membership {
  status: ClubMemberStatus;
  /** A pending row the staff created (an invitation) rather than an application. */
  invited: boolean;
}

export type JoinOutcome =
  | { ok: true; status: 'active' | 'pending' }
  | { ok: false; code: 'banned_from_club' | 'invite_required' };

/** What join_club does: open → active; apply → a pending application; invite → needs an invitation.
 *  An existing invitation is accepted in any mode; an existing membership / application is kept;
 *  a ban is final until the staff lift it (F-22 AC). */
export function joinOutcome(mode: ClubJoinMode, existing: Membership | null): JoinOutcome {
  if (existing) {
    if (existing.status === 'banned') return { ok: false, code: 'banned_from_club' };
    if (existing.status === 'active') return { ok: true, status: 'active' };
    return { ok: true, status: existing.invited ? 'active' : 'pending' };
  }
  if (mode === 'invite') return { ok: false, code: 'invite_required' };
  return { ok: true, status: mode === 'open' ? 'active' : 'pending' };
}

export function isStaff(role: ClubRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

/** moderate_club_member: owner and admins act on members; only the owner acts on an admin; nobody
 *  acts on the owner or on themself. */
export function canModerate(actor: ClubRole | null, target: ClubRole, isSelf: boolean): boolean {
  if (isSelf || target === 'owner') return false;
  if (actor === 'owner') return true;
  return actor === 'admin' && target === 'member';
}

/** set_club_member_role: the owner only, never on themself. */
export function canSetRole(actor: ClubRole | null, isSelf: boolean): boolean {
  return actor === 'owner' && !isSelf;
}

/** leave_club: anyone with a live row except the owner (who hands the club over first) and the banned. */
export function canLeave(role: ClubRole | null, status: ClubMemberStatus | null): boolean {
  if (status === null || status === 'banned') return false;
  return role !== 'owner';
}

/** club_feed: an open club's feed is for any signed-in collector; otherwise members and admins. */
export function canReadFeed(
  mode: ClubJoinMode,
  isMember: boolean,
  isPlatformAdmin = false
): boolean {
  return mode === 'open' || isMember || isPlatformAdmin;
}

/** create_meetup with a club id / set_club_night: the club's owner or an admin. */
export function canHostAsClub(role: ClubRole | null): boolean {
  return isStaff(role);
}

export type HostIneligibleReason =
  'hosting_suspended' | 'host_recent_report' | 'host_level_too_low';

/** world_host_ineligible_reason: suspension first, then an upheld report in the last 90 days, then the
 *  F-13 level. Null = may host a meetup / own a club. */
export function hostIneligibleReason(input: {
  xpLevel: number;
  suspended: boolean;
  upheldReportInWindow: boolean;
}): HostIneligibleReason | null {
  if (input.suspended) return 'hosting_suspended';
  if (input.upheldReportInWindow) return 'host_recent_report';
  if (input.xpLevel < HOST_MIN_XP_LEVEL) return 'host_level_too_low';
  return null;
}

/** Two upheld reports (ever) with no active suspension → automatic suspension. */
export function shouldAutoSuspend(upheldReports: number, activeSuspension: boolean): boolean {
  return upheldReports >= 2 && !activeSuspension;
}

/** The next occurrence of a club night after `startsAt`. */
export function nextClubNight(startsAt: Date, cadence: ClubNightCadence): Date {
  const d = new Date(startsAt.getTime());
  if (cadence === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** world_job_club_nights: the occurrences that enter the 7-day window at `now` (each spawns one draft
 *  when it is still more than an hour away), and where the template stands afterwards. */
export function clubNightOccurrences(
  nextStartsAt: Date,
  cadence: ClubNightCadence,
  now: Date
): { spawn: Date[]; next: Date } {
  const horizon = now.getTime() + CLUB_NIGHT_WINDOW_DAYS * 86_400_000;
  const spawn: Date[] = [];
  let next = nextStartsAt;
  for (let guard = 0; next.getTime() <= horizon && guard < 60; guard += 1) {
    if (next.getTime() > now.getTime() + 3_600_000) spawn.push(next);
    next = nextClubNight(next, cadence);
  }
  return { spawn, next };
}
