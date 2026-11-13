'use client';

// The clubhouse (MV-W07-03/04, F-22). Prototype pieces only (D-027 / D-086): panel, toggle-row,
// level-pill, status-pill, btn-primary / btn-secondary / btn-danger, garage-grid + CarCard, native
// <select> / <input>, muted, field-error, empty-state. Every rule is enforced by the club RPCs; the
// pure helpers from domain/clubs only decide which buttons a viewer sees.
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CarCard from '@/components/CarCard';
import ReportPrompt from '@/components/ReportPrompt';
import { Spinner } from '@/components/Loaders';
import {
  CLUB_JOIN_MODES,
  CLUB_NIGHT_CADENCES,
  canLeave,
  canModerate,
  canSetRole,
  type ClubDetail,
  type ClubJoinMode,
  type ClubMember,
  type ClubNightCadence,
  type ClubRole,
} from '@/domain/clubs';
import { MEETUP_VISIBILITIES, hostFee, type MeetupVisibility } from '@/domain/meetups';
import {
  decideApplicationAction,
  inviteToClubAction,
  joinClubAction,
  leaveClubAction,
  moderateMemberAction,
  setClubNightAction,
  setMemberRoleAction,
  stopClubNightAction,
  updateClubAction,
  type ClubActionResult,
} from '@/app/world/clubs/actions';
import {
  STATUS_LABEL,
  STATUS_PILL_CLASS,
  VISIBILITY_LABEL,
  formatWhen,
} from '@/components/world/meetups/copy';
import {
  CADENCE_LABEL,
  JOIN_MODE_LABEL,
  ROLE_LABEL,
  feedLine,
  formatDay,
  formatStart,
} from './copy';

const DURATIONS = [60, 90, 120, 180];
const small = { width: 'auto', padding: '4px 10px', fontSize: 12 } as const;

export default function ClubhouseView({
  detail,
  meetupsOn,
  hostCap,
  defaultNightStart,
  harness = false,
  harnessQuery = '',
}: {
  detail: ClubDetail;
  /** `world_meetups` is on for the viewer: club meetups link out and the club night can be set. */
  meetupsOn: boolean;
  /** The viewer's hosting capacity (staff only; 0 = cannot host yet). */
  hostCap: number;
  /** `datetime-local` default for the club night's first start (computed by the page). */
  defaultNightStart: string;
  harness?: boolean;
  harnessQuery?: string;
}) {
  const router = useRouter();
  const { club, viewer } = detail;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [inviteHandle, setInviteHandle] = useState('');
  const [name, setName] = useState(club.name);
  const [joinMode, setJoinMode] = useState<ClubJoinMode>(club.join_mode);
  const [description, setDescription] = useState(club.description ?? '');

  const [nightTitle, setNightTitle] = useState(detail.night?.title ?? `${club.name} night`);
  const [cadence, setCadence] = useState<ClubNightCadence>(
    detail.night?.cadence === 'monthly' ? 'monthly' : 'weekly'
  );
  const [firstStart, setFirstStart] = useState(defaultNightStart);
  const [duration, setDuration] = useState(detail.night?.duration_minutes ?? 120);
  const [capacity, setCapacity] = useState(
    Math.min(detail.night?.capacity ?? 10, Math.max(hostCap, 2))
  );
  const [nightVisibility, setNightVisibility] = useState<MeetupVisibility>(
    detail.night?.visibility ?? 'club'
  );

  /** Runs one action; on success shows `done` and refreshes the server data. */
  function act(fn: () => Promise<ClubActionResult<unknown>>, done: string, after?: () => void) {
    setError(null);
    setNotice(null);
    if (harness) return;
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNotice(done);
      after?.();
      router.refresh();
    });
  }

  const handle = (m: ClubMember) => `@${m.user.handle}`;

  function memberControls(m: ClubMember) {
    const self = m.user.id === viewer.id;
    const moderate = canModerate(viewer.role, m.role, self);
    const setRole = canSetRole(viewer.role, self);
    if (!moderate && !setRole) return null;
    const next: ClubRole = m.role === 'admin' ? 'member' : 'admin';
    return (
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {setRole && (
          <>
            <button
              type="button"
              className="btn-secondary"
              style={small}
              disabled={pending}
              onClick={() =>
                act(
                  () => setMemberRoleAction(club.id, club.slug, m.user.id, next),
                  next === 'admin'
                    ? `${handle(m)} is now an admin.`
                    : `${handle(m)} is a member again.`
                )
              }
            >
              {next === 'admin' ? 'Make admin' : 'Remove admin'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={small}
              disabled={pending}
              onClick={() => {
                if (
                  !harness &&
                  !window.confirm(`Hand ${club.name} over to ${handle(m)}? You stay as an admin.`)
                )
                  return;
                act(
                  () => setMemberRoleAction(club.id, club.slug, m.user.id, 'owner'),
                  `${handle(m)} now owns the club.`
                );
              }}
            >
              Hand over
            </button>
          </>
        )}
        {moderate && (
          <>
            <button
              type="button"
              className="btn-secondary"
              style={small}
              disabled={pending}
              onClick={() =>
                act(
                  () => moderateMemberAction(club.id, club.slug, m.user.id, 'remove'),
                  `${handle(m)} was removed.`
                )
              }
            >
              Remove
            </button>
            <button
              type="button"
              className="btn-danger"
              style={small}
              disabled={pending}
              onClick={() => {
                if (
                  !harness &&
                  !window.confirm(`Ban ${handle(m)}? They will not be able to rejoin.`)
                )
                  return;
                act(
                  () => moderateMemberAction(club.id, club.slug, m.user.id, 'ban'),
                  `${handle(m)} was banned.`
                );
              }}
            >
              Ban
            </button>
          </>
        )}
      </span>
    );
  }

  return (
    <div>
      {/* ---- about + the viewer's standing ---- */}
      <div className="panel">
        {club.description ? (
          <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{club.description}</p>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            No description yet.
          </p>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {JOIN_MODE_LABEL[club.join_mode]} · owner{' '}
          <Link href={`/u/${detail.owner.handle}`}>@{detail.owner.handle}</Link>
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          {viewer.isMember ? (
            <>
              <span className="muted" style={{ flex: 1, fontSize: 13 }}>
                You are {viewer.role === 'member' ? 'a member' : `the club’s ${viewer.role}`}.
              </span>
              {canLeave(viewer.role, viewer.status) && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={pending}
                  onClick={() =>
                    act(() => leaveClubAction(club.id, club.slug), 'You left the club.')
                  }
                >
                  Leave
                </button>
              )}
            </>
          ) : viewer.status === 'banned' ? (
            <span className="muted" style={{ fontSize: 13 }}>
              You cannot join this club.
            </span>
          ) : viewer.status === 'pending' ? (
            <>
              <span className="muted" style={{ flex: 1, fontSize: 13 }}>
                {viewer.invited
                  ? 'You are invited to this club.'
                  : 'Your request is waiting for the club.'}
              </span>
              {viewer.invited && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={pending}
                  onClick={() =>
                    act(() => joinClubAction(club.id, club.slug), 'Welcome to the club.')
                  }
                >
                  Accept
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() =>
                  act(
                    () => leaveClubAction(club.id, club.slug),
                    viewer.invited ? 'Invitation declined.' : 'Request withdrawn.'
                  )
                }
              >
                {viewer.invited ? 'Decline' : 'Withdraw'}
              </button>
            </>
          ) : club.join_mode === 'invite' ? (
            <span className="muted" style={{ fontSize: 13 }}>
              This club is invite only.
            </span>
          ) : (
            <button
              type="button"
              className="btn-primary"
              style={{ flex: 1 }}
              disabled={pending}
              onClick={() =>
                act(
                  () => joinClubAction(club.id, club.slug),
                  club.join_mode === 'open' ? 'Welcome to the club.' : 'Request sent.'
                )
              }
            >
              {pending ? <Spinner /> : club.join_mode === 'open' ? 'Join the club' : 'Ask to join'}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="field-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {/* ---- clubhouse: members' featured cars ---- */}
      <div className="section-title">Clubhouse</div>
      {detail.featured.length === 0 ? (
        <div className="empty-state">
          <p>
            {detail.members.length === 0
              ? 'Members’ featured cars show here once you are in.'
              : 'No featured cars yet — members pick one in their World garage.'}
          </p>
        </div>
      ) : (
        <div className="garage-grid">
          {detail.featured.map((f) => (
            <div key={f.item.id}>
              <CarCard item={f.item} view="grid" />
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                @{f.owner.handle}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ---- upcoming club meetups ---- */}
      <div className="section-title">Club meetups</div>
      {detail.meetups.length === 0 ? (
        <div className="empty-state">
          <p>No club meetups coming up.</p>
        </div>
      ) : (
        <div className="panel">
          {detail.meetups.map((m) => {
            const row = (
              <>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{m.title}</span>
                  <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                    {formatWhen(m.starts_at, m.ends_at)}
                  </span>
                </span>
                <span className={`status-pill ${STATUS_PILL_CLASS[m.status]}`}>
                  {STATUS_LABEL[m.status]}
                </span>
              </>
            );
            return meetupsOn ? (
              <Link
                key={m.id}
                href={`/world/meetups/${m.id}${harnessQuery ? '?__visual=1' : ''}`}
                className="toggle-row"
                style={{ textDecoration: 'none', alignItems: 'flex-start' }}
              >
                {row}
              </Link>
            ) : (
              <div key={m.id} className="toggle-row" style={{ alignItems: 'flex-start' }}>
                {row}
              </div>
            );
          })}
        </div>
      )}
      {viewer.isStaff && meetupsOn && (
        <Link
          href={`/world/meetups/new${harnessQuery ? '?__visual=1&' : '?'}club=${club.id}`}
          className="btn-primary"
          style={{ display: 'block', textAlign: 'center', marginTop: 12 }}
        >
          Host a club meetup
        </Link>
      )}

      {/* ---- recurring club night ---- */}
      {viewer.isMember && (detail.night || (viewer.isStaff && meetupsOn)) && (
        <>
          <div className="section-title">Club night</div>
          <div className="panel">
            {detail.night ? (
              <p style={{ fontSize: 14 }}>
                <strong>{detail.night.title}</strong>{' '}
                <span className="muted" style={{ fontSize: 12 }}>
                  ·{' '}
                  {CADENCE_LABEL[
                    detail.night.cadence === 'monthly' ? 'monthly' : 'weekly'
                  ].toLowerCase()}{' '}
                  · next {formatStart(detail.night.next_starts_at)}
                </span>
              </p>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                No club night yet.
              </p>
            )}
            {viewer.isStaff && meetupsOn && hostCap < 2 && (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                Setting a club night needs a garage that can host — level up in the{' '}
                <Link href="/world/shop">World shop</Link>.
              </p>
            )}
            {viewer.isStaff && meetupsOn && hostCap >= 2 && (
              <form
                aria-label="Club night"
                style={{ marginTop: 12 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  act(
                    () =>
                      setClubNightAction(club.id, club.slug, {
                        title: nightTitle,
                        cadence,
                        firstStart: new Date(firstStart).toISOString(),
                        durationMinutes: duration,
                        capacity,
                        visibility: nightVisibility,
                      }),
                    'Club night saved. A draft appears in your meetups a week before each night.'
                  );
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="cn-title">Title</label>
                  <input
                    id="cn-title"
                    value={nightTitle}
                    onChange={(e) => setNightTitle(e.target.value)}
                    maxLength={80}
                    minLength={3}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="cn-start">First night</label>
                    <input
                      id="cn-start"
                      type="datetime-local"
                      value={firstStart}
                      onChange={(e) => setFirstStart(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    <label htmlFor="cn-cadence">Repeats</label>
                    <select
                      id="cn-cadence"
                      value={cadence}
                      onChange={(e) => setCadence(e.target.value as ClubNightCadence)}
                    >
                      {CLUB_NIGHT_CADENCES.map((c) => (
                        <option key={c} value={c}>
                          {CADENCE_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="cn-duration">Length</label>
                    <select
                      id="cn-duration"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    >
                      {DURATIONS.map((m) => (
                        <option key={m} value={m}>
                          {m / 60} h
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="cn-capacity">Seats</label>
                    <input
                      id="cn-capacity"
                      type="number"
                      min={2}
                      max={hostCap}
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="cn-visibility">Who can join</label>
                  <select
                    id="cn-visibility"
                    value={nightVisibility}
                    onChange={(e) => setNightVisibility(e.target.value as MeetupVisibility)}
                  >
                    {MEETUP_VISIBILITIES.map((v) => (
                      <option key={v} value={v}>
                        {VISIBILITY_LABEL[v]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                  Each night arrives as a draft a week ahead. You schedule it from your meetups; the{' '}
                  {hostFee(capacity)}-credit hosting fee is charged then, never automatically.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    disabled={
                      pending ||
                      nightTitle.trim().length < 3 ||
                      !firstStart ||
                      capacity < 2 ||
                      capacity > hostCap
                    }
                  >
                    {detail.night ? 'Replace club night' : 'Set club night'}
                  </button>
                  {detail.night && (
                    <button
                      type="button"
                      className="btn-danger"
                      style={{ width: 'auto', flex: '0 0 auto' }}
                      disabled={pending}
                      onClick={() =>
                        act(() => stopClubNightAction(club.id, club.slug), 'Club night stopped.')
                      }
                    >
                      Stop
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </>
      )}

      {/* ---- feed ---- */}
      <div className="section-title">Club feed</div>
      {detail.feed.length === 0 ? (
        <div className="empty-state">
          <p>
            {club.join_mode !== 'open' && !viewer.isMember
              ? 'The feed is for members.'
              : 'Nothing has happened yet.'}
          </p>
        </div>
      ) : (
        <div className="panel">
          {detail.feed.map((f) => (
            <div className="toggle-row" key={f.id}>
              <span style={{ fontSize: 13 }}>{feedLine(f)}</span>
              <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {formatDay(f.occurredAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---- roster ---- */}
      <div className="section-title">Members ({detail.memberCount})</div>
      {detail.members.length === 0 ? (
        <div className="empty-state">
          <p>The member list is for members.</p>
        </div>
      ) : (
        <div className="panel">
          {detail.members.map((m) => (
            <div className="toggle-row" key={m.user.id} style={{ alignItems: 'flex-start' }}>
              <span>
                <Link href={`/u/${m.user.handle}`}>{m.user.displayName}</Link>{' '}
                <span className="muted" style={{ fontSize: 12 }}>
                  @{m.user.handle}
                </span>
                {m.role !== 'member' && (
                  <>
                    {' '}
                    <span className="level-pill">{ROLE_LABEL[m.role]}</span>
                  </>
                )}
              </span>
              {memberControls(m)}
            </div>
          ))}
        </div>
      )}

      {/* ---- owner / admin tools ---- */}
      {viewer.isStaff && (
        <>
          <div className="section-title">Requests ({detail.applications.length})</div>
          {detail.applications.length === 0 ? (
            <div className="empty-state">
              <p>No requests waiting.</p>
            </div>
          ) : (
            <div className="panel">
              {detail.applications.map((m) => (
                <div className="toggle-row" key={m.user.id}>
                  <span>
                    <Link href={`/u/${m.user.handle}`}>{m.user.displayName}</Link>{' '}
                    <span className="muted" style={{ fontSize: 12 }}>
                      @{m.user.handle}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={small}
                      disabled={pending}
                      onClick={() =>
                        act(
                          () => decideApplicationAction(club.id, club.slug, m.user.id, true),
                          `${handle(m)} is in.`
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={small}
                      disabled={pending}
                      onClick={() =>
                        act(
                          () => decideApplicationAction(club.id, club.slug, m.user.id, false),
                          'Request declined.'
                        )
                      }
                    >
                      Decline
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="section-title">Invite &amp; bans</div>
          <div className="panel">
            <label htmlFor="cl-invite">Invite a collector by handle</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                id="cl-invite"
                value={inviteHandle}
                onChange={(e) => setInviteHandle(e.target.value)}
                placeholder="@handle"
                maxLength={25}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={pending || !inviteHandle.trim()}
                onClick={() => {
                  const h = inviteHandle.trim().replace(/^@/, '');
                  act(
                    () => inviteToClubAction(club.id, club.slug, h),
                    `Invited @${h}.`,
                    () => setInviteHandle('')
                  );
                }}
              >
                Invite
              </button>
            </div>
            {detail.invitations.length > 0 && (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Invited: {detail.invitations.map(handle).join(', ')}
              </p>
            )}
            {detail.banned.map((m) => (
              <div className="toggle-row" key={m.user.id} style={{ marginTop: 8 }}>
                <span className="muted" style={{ fontSize: 13 }}>
                  {handle(m)} · banned
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={small}
                  disabled={pending}
                  onClick={() =>
                    act(
                      () => moderateMemberAction(club.id, club.slug, m.user.id, 'unban'),
                      `${handle(m)} can join again.`
                    )
                  }
                >
                  Unban
                </button>
              </div>
            ))}
          </div>

          <div className="section-title">Club settings</div>
          <form
            className="panel"
            aria-label="Club settings"
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () => updateClubAction(club.id, club.slug, { name, joinMode, description }),
                'Club details saved.'
              );
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="cs-name">Club name</label>
              <input
                id="cs-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                minLength={2}
                required
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="cs-join">Who can join</label>
              <select
                id="cs-join"
                value={joinMode}
                onChange={(e) => setJoinMode(e.target.value as ClubJoinMode)}
              >
                {CLUB_JOIN_MODES.map((m) => (
                  <option key={m} value={m}>
                    {JOIN_MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="cs-description">About the club</label>
              <textarea
                id="cs-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>
            <button
              type="submit"
              className="btn-secondary"
              style={{ width: '100%' }}
              disabled={pending || name.trim().length < 2}
            >
              Save club details
            </button>
          </form>
        </>
      )}

      {!viewer.isOwner && viewer.id && (
        <div style={{ marginTop: 16 }}>
          <ReportPrompt
            targetType="club"
            targetId={club.id}
            targetName={club.name}
            label="Report club"
          />
        </div>
      )}
    </div>
  );
}
