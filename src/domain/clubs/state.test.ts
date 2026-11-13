import { describe, it, expect } from 'vitest';
import {
  canHostAsClub,
  canLeave,
  canModerate,
  canReadFeed,
  canSetRole,
  clubNightOccurrences,
  hostIneligibleReason,
  isStaff,
  joinOutcome,
  nextClubNight,
  shouldAutoSuspend,
} from './state';
import { CLUB_JOIN_MODES, CLUB_ROLES, type ClubRole } from './types';

describe('club join rules (MV-W07-02, mirrors join_club)', () => {
  it('open admits, apply queues, invite refuses a newcomer', () => {
    expect(joinOutcome('open', null)).toEqual({ ok: true, status: 'active' });
    expect(joinOutcome('apply', null)).toEqual({ ok: true, status: 'pending' });
    expect(joinOutcome('invite', null)).toEqual({ ok: false, code: 'invite_required' });
  });

  it('an invitation is accepted in every join mode; an application stays pending', () => {
    for (const mode of CLUB_JOIN_MODES) {
      expect(joinOutcome(mode, { status: 'pending', invited: true })).toEqual({
        ok: true,
        status: 'active',
      });
      expect(joinOutcome(mode, { status: 'pending', invited: false })).toEqual({
        ok: true,
        status: 'pending',
      });
      expect(joinOutcome(mode, { status: 'active', invited: false })).toEqual({
        ok: true,
        status: 'active',
      });
    }
  });

  it('a banned collector cannot rejoin in any mode (F-22 AC)', () => {
    for (const mode of CLUB_JOIN_MODES) {
      for (const invited of [true, false]) {
        expect(joinOutcome(mode, { status: 'banned', invited })).toEqual({
          ok: false,
          code: 'banned_from_club',
        });
      }
    }
  });
});

describe('club roles (mirrors moderate_club_member / set_club_member_role / leave_club)', () => {
  it('owner and admin are staff, a member and an outsider are not', () => {
    expect(CLUB_ROLES.map((r) => isStaff(r))).toEqual([true, true, false]);
    expect(isStaff(null)).toBe(false);
    expect(canHostAsClub('admin')).toBe(true);
    expect(canHostAsClub('member')).toBe(false);
  });

  it('moderation matrix: actor × target', () => {
    const actors: (ClubRole | null)[] = ['owner', 'admin', 'member', null];
    const matrix = actors.map((a) => CLUB_ROLES.map((t) => canModerate(a, t, false)));
    expect(matrix).toEqual([
      // target: owner, admin, member
      [false, true, true], // owner
      [false, false, true], // admin
      [false, false, false], // member
      [false, false, false], // outsider
    ]);
  });

  it('nobody moderates themself', () => {
    for (const a of CLUB_ROLES)
      for (const t of CLUB_ROLES) expect(canModerate(a, t, true)).toBe(false);
  });

  it('only the owner changes roles, never their own', () => {
    expect(canSetRole('owner', false)).toBe(true);
    expect(canSetRole('owner', true)).toBe(false);
    expect(canSetRole('admin', false)).toBe(false);
    expect(canSetRole('member', false)).toBe(false);
    expect(canSetRole(null, false)).toBe(false);
  });

  it('everyone but the owner and the banned can leave', () => {
    expect(canLeave('owner', 'active')).toBe(false);
    expect(canLeave('admin', 'active')).toBe(true);
    expect(canLeave('member', 'active')).toBe(true);
    expect(canLeave('member', 'pending')).toBe(true);
    expect(canLeave('member', 'banned')).toBe(false);
    expect(canLeave(null, null)).toBe(false);
  });

  it('only members read a non-open club’s feed (F-22 AC)', () => {
    expect(canReadFeed('open', false)).toBe(true);
    expect(canReadFeed('apply', false)).toBe(false);
    expect(canReadFeed('invite', false)).toBe(false);
    expect(canReadFeed('apply', true)).toBe(true);
    expect(canReadFeed('invite', false, true)).toBe(true);
  });
});

describe('host eligibility (MV-W07-05, mirrors world_host_ineligible_reason)', () => {
  const clean = { xpLevel: 2, suspended: false, upheldReportInWindow: false };

  it('level 2 with a clean record may host', () => {
    expect(hostIneligibleReason(clean)).toBeNull();
    expect(hostIneligibleReason({ ...clean, xpLevel: 6 })).toBeNull();
  });

  it('level 1 may not', () => {
    expect(hostIneligibleReason({ ...clean, xpLevel: 1 })).toBe('host_level_too_low');
  });

  it('an upheld report in the last 90 days blocks hosting, a suspension outranks it', () => {
    expect(hostIneligibleReason({ ...clean, upheldReportInWindow: true })).toBe(
      'host_recent_report'
    );
    expect(hostIneligibleReason({ ...clean, upheldReportInWindow: true, suspended: true })).toBe(
      'hosting_suspended'
    );
    expect(hostIneligibleReason({ xpLevel: 1, suspended: true, upheldReportInWindow: false })).toBe(
      'hosting_suspended'
    );
  });

  it('two upheld reports suspend automatically, once', () => {
    expect(shouldAutoSuspend(1, false)).toBe(false);
    expect(shouldAutoSuspend(2, false)).toBe(true);
    expect(shouldAutoSuspend(5, false)).toBe(true);
    expect(shouldAutoSuspend(2, true)).toBe(false);
  });
});

describe('recurring club night (MV-W07-04, mirrors world_job_club_nights)', () => {
  const now = new Date('2026-11-12T12:00:00.000Z');
  const iso = (d: Date) => d.toISOString();

  it('advances by a week or a calendar month', () => {
    expect(iso(nextClubNight(new Date('2026-11-15T18:00:00.000Z'), 'weekly'))).toBe(
      '2026-11-22T18:00:00.000Z'
    );
    expect(iso(nextClubNight(new Date('2026-11-15T18:00:00.000Z'), 'monthly'))).toBe(
      '2026-12-15T18:00:00.000Z'
    );
  });

  it('spawns the occurrence inside the 7-day window and parks the template after it', () => {
    const r = clubNightOccurrences(new Date('2026-11-15T18:00:00.000Z'), 'weekly', now);
    expect(r.spawn.map(iso)).toEqual(['2026-11-15T18:00:00.000Z']);
    expect(iso(r.next)).toBe('2026-11-22T18:00:00.000Z');
  });

  it('is idempotent: a second run at the same instant spawns nothing', () => {
    const first = clubNightOccurrences(new Date('2026-11-15T18:00:00.000Z'), 'weekly', now);
    const second = clubNightOccurrences(first.next, 'weekly', now);
    expect(second.spawn).toEqual([]);
    expect(iso(second.next)).toBe(iso(first.next));
  });

  it('nothing spawns while the next start is more than 7 days away', () => {
    const r = clubNightOccurrences(new Date('2026-11-25T18:00:00.000Z'), 'weekly', now);
    expect(r.spawn).toEqual([]);
    expect(iso(r.next)).toBe('2026-11-25T18:00:00.000Z');
  });

  it('an occurrence already past (or under an hour away) is skipped, the template catches up', () => {
    const r = clubNightOccurrences(new Date('2026-10-29T18:00:00.000Z'), 'weekly', now);
    // 29 Oct and 5 Nov are past (skipped), 12 Nov 18:00 is 6 h away (spawned), 19 Nov 18:00 is
    // outside the window (stays as the template's next start)
    expect(r.spawn.map(iso)).toEqual(['2026-11-12T18:00:00.000Z']);
    expect(iso(r.next)).toBe('2026-11-19T18:00:00.000Z');
    const soon = clubNightOccurrences(new Date('2026-11-12T12:30:00.000Z'), 'monthly', now);
    expect(soon.spawn).toEqual([]);
    expect(iso(soon.next)).toBe('2026-12-12T12:30:00.000Z');
  });
});
