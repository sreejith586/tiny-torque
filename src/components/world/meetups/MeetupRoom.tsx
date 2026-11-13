'use client';

// Live room (MV-W06-04, F-23). The deal-chat pattern verbatim: the `thread` / `bubble-row` /
// `thread-composer` / `thread-banner` CSS, optimistic sends, a Realtime `postgres_changes` channel
// on deal_messages filtered by meetup_id — plus what a room adds: a reactions strip, the showcase
// grid, host mute / kick / end, and a live status watch that closes the composer the moment the
// meetup ends. Mobile-first at 360 px. No new chat stack (08 W06 risk note).
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import CarCard from '@/components/CarCard';
import { listRoomMessages, sendRoomMessage, sendRoomReaction } from '@/domain/messaging';

import type { DealMessageRow } from '@/domain/messaging';
import {
  ATTEND_SECONDS,
  MEETUP_REACTIONS,
  REACTION_EMOJI,
  ROOM_PING_SECONDS,
  canVoteFor,
  pingRoom,
  type MeetupDetail,
  type MeetupReaction,
  type MeetupRow,
  type MeetupStatus,
} from '@/domain/meetups';
import {
  moderateAttendeeAction,
  transitionMeetupAction,
  voteBestInShowAction,
} from '@/app/world/meetups/actions';

type PendingMessage = DealMessageRow & { pending?: boolean; tempId?: string };

export default function MeetupRoom({
  detail,
  initialMessages,
  harness = false,
}: {
  detail: MeetupDetail;
  initialMessages: DealMessageRow[];
  harness?: boolean;
}) {
  const router = useRouter();
  const { meetup, viewer } = detail;
  const viewerId = viewer.id ?? '';
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const [status, setStatus] = useState<MeetupStatus>(meetup.status);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [muted, setMuted] = useState(viewer.muted);
  const [attended, setAttended] = useState(viewer.attended);
  const [myVote, setMyVote] = useState<string | null>(detail.myVoteShowcaseId);
  const [tally, setTally] = useState<Record<string, number>>(() =>
    Object.fromEntries(detail.showcase.map((s) => [s.id, s.votes]))
  );
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const names = new Map<string, string>();
  for (const a of detail.attendees) names.set(a.user.id, a.user.displayName);
  names.set(detail.host.id, detail.host.displayName);
  const nameOf = (id: string) => (id === viewerId ? 'You' : (names.get(id) ?? 'Collector'));

  const open = status === 'live';
  const canSend = open && !muted && viewer.isMember;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (harness) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`meetup-room-${meetup.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deal_messages',
          filter: `meetup_id=eq.${meetup.id}`,
        },
        (payload) => {
          const row = payload.new as DealMessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev.filter(
                (m) => !(m.pending && m.sender_id === row.sender_id && m.body === row.body)
              ),
              row,
            ];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meetups', filter: `id=eq.${meetup.id}` },
        (payload) => {
          const row = payload.new as MeetupRow;
          setStatus(row.status);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetup_showcase',
          filter: `meetup_id=eq.${meetup.id}`,
        },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetup_rsvps',
          filter: `meetup_id=eq.${meetup.id}`,
        },
        (payload) => {
          const row = payload.new as {
            user_id: string;
            muted_at: string | null;
            removed_at: string | null;
          };
          if (row.user_id === viewerId) {
            setMuted(row.muted_at !== null);
            if (row.removed_at !== null) router.push(`/world/meetups/${meetup.id}`);
          } else {
            router.refresh();
          }
        }
      )
      .subscribe((s) => setOnline(s === 'SUBSCRIBED'));
    // a missed INSERT while reconnecting: resync once the channel is back
    const resync = () =>
      listRoomMessages(supabase, meetup.id)
        .then(setMessages)
        .catch(() => {});
    window.addEventListener('online', resync);
    return () => {
      window.removeEventListener('online', resync);
      supabase.removeChannel(channel);
    };
  }, [harness, meetup.id, router, viewerId]);

  // Attendance clock (MV-W07-01): one ping on open, then one a minute while the room is live and
  // this tab is open. The server keeps the time (a gap counts for at most two minutes); the room
  // only learns whether the ten minutes are reached. Hosts have no clock.
  const hasSeat = viewer.rsvp !== null && viewer.isMember;
  useEffect(() => {
    if (harness || !open || !hasSeat || attended) return;
    const supabase = createClient();
    let stopped = false;
    const tick = () =>
      pingRoom(supabase, meetup.id).then((done) => {
        if (done && !stopped) setAttended(true);
      });
    void tick();
    const timer = window.setInterval(tick, ROOM_PING_SECONDS * 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [harness, open, hasSeat, attended, meetup.id]);

  function vote(showcaseId: string) {
    if (harness || myVote === showcaseId) return;
    setSendError(null);
    startTransition(async () => {
      const r = await voteBestInShowAction(meetup.id, showcaseId);
      if (!r.ok) {
        setSendError(r.error);
        return;
      }
      setTally((prev) => ({
        ...prev,
        ...(myVote ? { [myVote]: Math.max((prev[myVote] ?? 1) - 1, 0) } : {}),
        [showcaseId]: r.data.votes,
      }));
      setMyVote(showcaseId);
    });
  }

  async function send(body: string, reaction: MeetupReaction | null, tempId: string) {
    if (sending || harness) return;
    const optimistic: PendingMessage = {
      id: tempId,
      kind: 'meetup',
      meetup_id: meetup.id,
      offer_id: null,
      sender_id: viewerId,
      body,
      reaction,
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
      tempId,
    };
    setMessages((prev) => [...prev, optimistic]);
    if (!reaction) setDraft('');
    setSending(true);
    setSendError(null);
    try {
      const supabase = createClient();
      const saved = reaction
        ? await sendRoomReaction(supabase, viewerId, { meetupId: meetup.id, reaction })
        : await sendRoomMessage(supabase, viewerId, { meetupId: meetup.id, body });
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.tempId !== tempId);
        if (withoutTemp.some((m) => m.id === saved.id)) return withoutTemp;
        return [...withoutTemp, saved];
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
      if (!reaction) setDraft(body);
      setSendError(
        muted
          ? 'You are muted in this room.'
          : open
            ? 'Could not send that. Try again.'
            : 'The room has closed.'
      );
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    void send(body, null, `temp-${Date.now()}`);
  }

  function handleReact(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.dataset.reaction as MeetupReaction | undefined;
    if (!r) return;
    void send(r, r, `temp-${Date.now()}`);
  }

  function hostAction(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    if (harness) return;
    setSendError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setSendError(r.error ?? 'That did not work.');
        return;
      }
      after?.();
    });
  }

  const showcase = detail.showcase.filter((s) => s.item);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {!online && !harness && (
        <div className="thread-banner">You&apos;re offline — reconnecting…</div>
      )}
      {!open && (
        <div className="thread-banner">
          This meetup has ended.{' '}
          <Link href={`/world/meetups/${meetup.id}`}>Back to the meetup</Link>
        </div>
      )}

      {showcase.length > 0 && (
        <details open style={{ marginBottom: 12 }}>
          <summary className="section-title" style={{ cursor: 'pointer', marginTop: 0 }}>
            On the table ({showcase.length})
          </summary>
          <div className="garage-grid">
            {showcase.map((s) => {
              const votes = tally[s.id] ?? s.votes;
              return (
                <div key={s.id}>
                  <CarCard item={s.item!} view="grid" />
                  <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    @{s.owner?.handle ?? 'collector'} · {votes} vote{votes === 1 ? '' : 's'}
                  </p>
                  {canVoteFor(status, viewer.isMember, viewer.id, s.userId) && (
                    <button
                      type="button"
                      className={myVote === s.id ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '4px 10px', fontSize: 12, marginTop: 4 }}
                      aria-pressed={myVote === s.id}
                      onClick={() => vote(s.id)}
                      disabled={pending}
                    >
                      {myVote === s.id ? 'Your vote' : 'Vote best in show'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            One vote each — you can move it until the meetup ends.
          </p>
        </details>
      )}
      {open && hasSeat && (
        <p className="muted" style={{ fontSize: 12, marginBottom: 8 }} role="status">
          {attended
            ? 'Attendance counted.'
            : `Stay ${ATTEND_SECONDS / 60} minutes for your attendance to count.`}
        </p>
      )}

      <div className="thread" aria-live="polite">
        {messages.length === 0 && <p className="empty-state">Say hello — the room just opened.</p>}
        {messages.map((m) =>
          m.reaction ? (
            <div
              key={m.id}
              style={{ textAlign: 'center', fontSize: 12, margin: '2px 0' }}
              className={m.pending ? 'muted' : undefined}
            >
              <span aria-hidden="true">
                {REACTION_EMOJI[m.reaction as MeetupReaction] ?? m.body}
              </span>{' '}
              <span className="muted">{nameOf(m.sender_id)}</span>
            </div>
          ) : (
            <div key={m.id} className={`bubble-row ${m.sender_id === viewerId ? 'mine' : ''}`}>
              <div className="bubble-wrap">
                {m.sender_id !== viewerId && (
                  <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>
                    {nameOf(m.sender_id)}
                  </div>
                )}
                <div className={`bubble ${m.pending ? 'bubble-pending' : ''}`}>{m.body}</div>
                {m.sender_id === viewerId && m.pending && (
                  <div className="bubble-meta">Sending…</div>
                )}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {canSend && (
        <div
          role="group"
          aria-label="Reactions"
          style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '8px 0' }}
        >
          {MEETUP_REACTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 16, lineHeight: 1 }}
              aria-label={`React ${r}`}
              data-reaction={r}
              onClick={handleReact}
              disabled={sending}
            >
              {REACTION_EMOJI[r]}
            </button>
          ))}
        </div>
      )}

      {muted ? (
        <p className="muted">The host muted you in this room.</p>
      ) : !open ? null : !viewer.isMember ? (
        <p className="muted">RSVP to join the conversation.</p>
      ) : (
        <div className="thread-composer">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message the room…"
            aria-label="Message the room"
            maxLength={2000}
            disabled={sending}
          />
          <button className="btn-primary" onClick={handleSend} disabled={sending || !draft.trim()}>
            Send
          </button>
        </div>
      )}
      {sendError && <p className="field-error">{sendError}</p>}

      {viewer.isStaff && open && (
        <>
          <div className="section-title">Host controls</div>
          <div className="panel">
            {detail.attendees
              .filter((a) => a.user.id !== detail.host.id && (a.role !== 'cohost' || viewer.isHost))
              .map((a) => (
                <div className="toggle-row" key={a.user.id}>
                  <span>
                    {a.user.displayName}{' '}
                    <span className="muted" style={{ fontSize: 12 }}>
                      @{a.user.handle}
                      {a.role === 'cohost' ? ' · co-host' : ''}
                      {a.muted ? ' · muted' : ''}
                    </span>
                  </span>
                  {a.role !== 'cohost' && (
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        disabled={pending}
                        onClick={() =>
                          hostAction(
                            () =>
                              moderateAttendeeAction(
                                meetup.id,
                                a.user.id,
                                a.muted ? 'unmute' : 'mute'
                              ),
                            () => router.refresh()
                          )
                        }
                      >
                        {a.muted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        disabled={pending}
                        onClick={() =>
                          hostAction(
                            () => moderateAttendeeAction(meetup.id, a.user.id, 'kick'),
                            () => router.refresh()
                          )
                        }
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </div>
              ))}
            <button
              type="button"
              className="btn-danger"
              style={{ width: '100%', marginTop: 10 }}
              disabled={pending}
              onClick={() =>
                hostAction(
                  () => transitionMeetupAction(meetup.id, 'end'),
                  () => {
                    setStatus('ended');
                    router.push(`/world/meetups/${meetup.id}`);
                  }
                )
              }
            >
              End meetup
            </button>
          </div>
        </>
      )}
    </div>
  );
}
