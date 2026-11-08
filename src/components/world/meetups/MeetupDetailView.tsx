'use client';

// Meetup detail (MV-W06-03, F-23). Prototype pieces only (D-027 / D-086): panel, toggle-row,
// status-pill, btn-primary / btn-secondary / btn-danger, garage-grid + CarCard, native <select>,
// muted, field-error. Optimistic where cheap (rsvp, showcase); every rule is enforced by the RPCs.
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CarCard from '@/components/CarCard';
import { Spinner } from '@/components/Loaders';
import type { GarageItem } from '@/domain/garage';
import {
  allowedActions,
  acceptsRsvps,
  hostFee,
  isRoomOpen,
  refundOnCancel,
  type MeetupAction,
  type MeetupDetail,
  type MeetupRsvpStatus,
} from '@/domain/meetups';
import {
  inviteToMeetupAction,
  moderateAttendeeAction,
  rsvpMeetupAction,
  setCohostAction,
  setShowcaseAction,
  transitionMeetupAction,
} from '@/app/world/meetups/actions';
import { STATUS_LABEL, STATUS_PILL_CLASS, VISIBILITY_LABEL } from './copy';

const ACTION_LABEL: Record<MeetupAction, string> = {
  schedule: 'Schedule',
  start: 'Open the room',
  end: 'End meetup',
  cancel: 'Cancel meetup',
};

export default function MeetupDetailView({
  detail,
  myItems,
  harness = false,
  harnessQuery = '',
}: {
  detail: MeetupDetail;
  /** The viewer's public cars — what the showcase picker offers. */
  myItems: GarageItem[];
  harness?: boolean;
  harnessQuery?: string;
}) {
  const router = useRouter();
  const { meetup, host, viewer } = detail;
  const [status, setStatus] = useState(meetup.status);
  const [myRsvp, setMyRsvp] = useState<MeetupRsvpStatus | null>(viewer.rsvp?.status ?? null);
  const [goingCount, setGoingCount] = useState(detail.goingCount);
  const [picks, setPicks] = useState<string[]>(
    detail.showcase.filter((s) => s.userId === viewer.id).map((s) => s.itemId)
  );
  const [inviteHandle, setInviteHandle] = useState('');
  const [cohostHandle, setCohostHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const now = new Date();
  const ctx = { now, startsAt: new Date(meetup.starts_at), endsAt: new Date(meetup.ends_at) };
  const role = viewer.isHost ? 'host' : viewer.isCohost ? 'cohost' : 'other';
  const actions = allowedActions(status, role, ctx);
  const isMember =
    viewer.isStaff ||
    (viewer.rsvp?.removed_at == null && (myRsvp === 'going' || myRsvp === 'checked_in'));
  const removed = viewer.rsvp?.removed_at != null;
  const fee = hostFee(meetup.capacity);
  const refund = refundOnCancel(status, meetup.fee_paid, ctx.startsAt, now);
  const full = goingCount >= meetup.capacity;
  const myPicksItems = picks
    .map((id) => myItems.find((i) => i.id === id) ?? null)
    .filter((i): i is GarageItem => i !== null);
  const othersShowcase = detail.showcase.filter((s) => s.userId !== viewer.id);

  function flash(msg: string) {
    setError(null);
    setNotice(msg);
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    setNotice(null);
    if (harness) return;
    startTransition(fn);
  }

  function transition(action: MeetupAction) {
    run(async () => {
      const r = await transitionMeetupAction(meetup.id, action);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setStatus(r.data.status);
      flash(
        action === 'schedule'
          ? `Scheduled — ${r.data.feePaid}-credit hosting fee charged.`
          : action === 'cancel'
            ? refund
              ? 'Cancelled — the hosting fee was refunded.'
              : 'Cancelled.'
            : action === 'start'
              ? 'The room is open.'
              : 'Meetup ended.'
      );
      if (action === 'start') router.push(`/world/meetups/${meetup.id}/room`);
      else router.refresh();
    });
  }

  function rsvp(next: 'going' | 'declined') {
    const before = { myRsvp, goingCount };
    // optimistic: the seat count moves at once, the RPC decides going vs waitlist
    if (next === 'going') {
      setMyRsvp(full ? 'waitlist' : 'going');
      if (!full) setGoingCount((c) => c + 1);
    } else {
      if (myRsvp === 'going') setGoingCount((c) => c - 1);
      setMyRsvp('declined');
    }
    run(async () => {
      const r = await rsvpMeetupAction(meetup.id, next);
      if (!r.ok) {
        setMyRsvp(before.myRsvp);
        setGoingCount(before.goingCount);
        setError(r.error);
        return;
      }
      setMyRsvp(r.data.status);
      flash(
        r.data.status === 'going'
          ? 'You’re in.'
          : r.data.status === 'waitlist'
            ? 'Full for now — you are on the waitlist.'
            : 'You left the meetup.'
      );
      router.refresh();
    });
  }

  function togglePick(itemId: string) {
    const next = picks.includes(itemId)
      ? picks.filter((id) => id !== itemId)
      : picks.length < meetup.showcase_limit
        ? [...picks, itemId]
        : picks;
    if (next === picks) return;
    const before = picks;
    setPicks(next);
    run(async () => {
      const r = await setShowcaseAction(meetup.id, next);
      if (!r.ok) {
        setPicks(before);
        setError(r.error);
        return;
      }
      setPicks(r.data.itemIds);
      flash('Showcase saved.');
      router.refresh();
    });
  }

  function invite() {
    const handle = inviteHandle.trim();
    if (!handle) return;
    run(async () => {
      const r = await inviteToMeetupAction(meetup.id, handle);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setInviteHandle('');
      flash(`Invited @${handle.replace(/^@/, '')}.`);
      router.refresh();
    });
  }

  function cohost(on: boolean, handle = cohostHandle.trim()) {
    if (!handle) return;
    run(async () => {
      const r = await setCohostAction(meetup.id, handle, on);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCohostHandle('');
      flash(on ? `@${handle.replace(/^@/, '')} is now a co-host.` : 'Co-host removed.');
      router.refresh();
    });
  }

  function moderate(userId: string, action: 'mute' | 'unmute' | 'kick') {
    run(async () => {
      const r = await moderateAttendeeAction(meetup.id, userId, action);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      flash(action === 'kick' ? 'Attendee removed.' : action === 'mute' ? 'Muted.' : 'Unmuted.');
      router.refresh();
    });
  }

  return (
    <div>
      {/* ---- status + who ---- */}
      <div className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <span className={`status-pill ${STATUS_PILL_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            {goingCount}/{meetup.capacity} going
            {detail.waitlistCount > 0 ? ` · ${detail.waitlistCount} waitlisted` : ''}
          </span>
        </div>
        {meetup.theme && <p style={{ marginTop: 8, fontWeight: 600 }}>{meetup.theme}</p>}
        {meetup.description && (
          <p className="muted" style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>
            {meetup.description}
          </p>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {VISIBILITY_LABEL[meetup.visibility]} · at{' '}
          <Link href={`/world/g/${host.handle}${harnessQuery}`}>@{host.handle}’s garage</Link>
        </p>

        {/* viewer's own controls */}
        {!viewer.isStaff && acceptsRsvps(status) && !removed && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {myRsvp === 'going' || myRsvp === 'waitlist' || myRsvp === 'checked_in' ? (
              <>
                <span className="muted" style={{ flex: 1, fontSize: 13, alignSelf: 'center' }}>
                  {myRsvp === 'waitlist' ? 'You are on the waitlist.' : 'You’re in.'}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => rsvp('declined')}
                  disabled={pending}
                >
                  Not going
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={() => rsvp('going')}
                disabled={pending}
              >
                {full ? 'Join the waitlist' : 'I’m going'}
              </button>
            )}
          </div>
        )}
        {removed && (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            The host removed you from this meetup.
          </p>
        )}
        {isRoomOpen(status) && isMember && (
          <Link
            href={`/world/meetups/${meetup.id}/room${harnessQuery}`}
            className="btn-primary"
            style={{ display: 'block', textAlign: 'center', marginTop: 14 }}
          >
            Enter the live room
          </Link>
        )}
        {isRoomOpen(status) && !isMember && (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            The room is live for attendees. RSVP to get in.
          </p>
        )}
      </div>

      {/* ---- host panel ---- */}
      {viewer.isStaff && (
        <>
          <div className="section-title">Host controls</div>
          <div className="panel">
            {status === 'draft' && viewer.isHost && (
              <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                Scheduling charges the {fee}-credit hosting fee (a platform fee; refunded if you
                cancel 24 h or more before the start). Attendees can only see the meetup once it is
                scheduled.
              </p>
            )}
            {status === 'scheduled' && viewer.isHost && (
              <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                {refund
                  ? `Cancelling now refunds the ${meetup.fee_paid}-credit fee.`
                  : 'Cancelling less than 24 h before the start keeps the hosting fee.'}{' '}
                The room opens on schedule, or up to 15 minutes early from here.
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {actions.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={
                    a === 'cancel' ? 'btn-danger' : a === 'end' ? 'btn-secondary' : 'btn-primary'
                  }
                  style={{ flex: 1, minWidth: 140 }}
                  onClick={() => transition(a)}
                  disabled={pending}
                >
                  {pending ? <Spinner /> : ACTION_LABEL[a]}
                </button>
              ))}
              {actions.length === 0 && status === 'scheduled' && (
                <span className="muted" style={{ fontSize: 13 }}>
                  The room opens automatically at the start.
                </span>
              )}
            </div>

            {(status === 'scheduled' || status === 'live') && (
              <div style={{ marginTop: 14 }}>
                <label htmlFor="mt-invite">Invite a collector by handle</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    id="mt-invite"
                    value={inviteHandle}
                    onChange={(e) => setInviteHandle(e.target.value)}
                    placeholder="@handle"
                    maxLength={25}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={invite}
                    disabled={pending || !inviteHandle.trim()}
                  >
                    Invite
                  </button>
                </div>
                {detail.invites.length > 0 && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Invited: {detail.invites.map((i) => `@${i.user.handle}`).join(', ')}
                  </p>
                )}
              </div>
            )}

            {viewer.isHost && status !== 'ended' && status !== 'cancelled' && (
              <div style={{ marginTop: 14 }}>
                <label htmlFor="mt-cohost">Add a co-host by handle</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    id="mt-cohost"
                    value={cohostHandle}
                    onChange={(e) => setCohostHandle(e.target.value)}
                    placeholder="@handle"
                    maxLength={25}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => cohost(true)}
                    disabled={pending || !cohostHandle.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- attendees ---- */}
      <div className="section-title">Attendees</div>
      {detail.attendees.length === 0 ? (
        <div className="empty-state">
          <p>No one has joined yet.</p>
        </div>
      ) : (
        <div className="panel">
          {detail.attendees.map((a) => (
            <div className="toggle-row" key={a.user.id}>
              <span>
                <Link href={`/u/${a.user.handle}`}>{a.user.displayName}</Link>{' '}
                <span className="muted" style={{ fontSize: 12 }}>
                  @{a.user.handle}
                  {a.role === 'cohost' ? ' · co-host' : ''}
                  {a.status === 'waitlist' ? ' · waitlist' : ''}
                  {a.muted ? ' · muted' : ''}
                </span>
              </span>
              {viewer.isStaff && (a.role !== 'cohost' || viewer.isHost) && (
                <span style={{ display: 'flex', gap: 6 }}>
                  {a.role === 'cohost' ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => cohost(false, a.user.handle)}
                      disabled={pending}
                    >
                      Remove co-host
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => moderate(a.user.id, a.muted ? 'unmute' : 'mute')}
                        disabled={pending}
                      >
                        {a.muted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => moderate(a.user.id, 'kick')}
                        disabled={pending}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---- showcase ---- */}
      <div className="section-title">Showcase</div>
      {isMember && acceptsRsvps(status) && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Bring up to {meetup.showcase_limit} of your public cars. Tap to add or remove.
          </p>
          {myItems.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              You have no public cars yet — make one public in{' '}
              <Link href="/garage">your garage</Link>.
            </p>
          ) : (
            <ul
              aria-label="Your cars"
              style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}
            >
              {myItems.map((item) => {
                const on = picks.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={on ? 'btn-primary' : 'btn-secondary'}
                      style={{ width: '100%', textAlign: 'left' }}
                      aria-pressed={on}
                      onClick={() => togglePick(item.id)}
                      disabled={pending || (!on && picks.length >= meetup.showcase_limit)}
                    >
                      {on ? '✓ ' : ''}
                      {item.brand} {item.model ?? ''}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {myPicksItems.length === 0 && othersShowcase.length === 0 ? (
        <div className="empty-state">
          <p>No cars on the table yet.</p>
        </div>
      ) : (
        <>
          {myPicksItems.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Yours
              </p>
              <div className="garage-grid" style={{ marginBottom: 12 }}>
                {myPicksItems.map((item) => (
                  <CarCard key={item.id} item={item} view="grid" />
                ))}
              </div>
            </>
          )}
          {othersShowcase.length > 0 && (
            <div className="garage-grid">
              {othersShowcase.map((s) =>
                s.item ? (
                  <div key={s.id}>
                    <CarCard item={s.item} view="grid" />
                    <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      @{s.owner?.handle ?? 'collector'}
                    </p>
                  </div>
                ) : (
                  <div key={s.id} className="empty-state" style={{ padding: 12 }}>
                    <p className="muted" style={{ fontSize: 12 }}>
                      Car no longer public
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {notice && (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="field-error" style={{ marginTop: 12 }}>
          {error}
          {error.includes('credits') && (
            <>
              {' '}
              <Link href="/tokens">Top up</Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
