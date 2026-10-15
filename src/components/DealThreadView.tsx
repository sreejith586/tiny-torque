'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendMessage, markThreadRead } from '@/domain/messaging';
import type { DealMessageRow } from '@/domain/messaging';

type PendingMessage = DealMessageRow & { pending?: boolean; tempId?: string };

export default function DealThreadView({
  offerId,
  offerStatus,
  viewerId,
  blocked,
  initialMessages,
}: {
  offerId: string;
  offerStatus: string;
  viewerId: string;
  blocked: boolean;
  initialMessages: DealMessageRow[];
}) {
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canSend = !blocked && (offerStatus === 'accepted' || offerStatus === 'completed');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`deal-messages-${offerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deal_messages',
          filter: `offer_id=eq.${offerId}`,
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
          if (row.sender_id !== viewerId) {
            markThreadRead(supabase, offerId, viewerId).catch(() => {});
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deal_messages',
          filter: `offer_id=eq.${offerId}`,
        },
        (payload) => {
          const row = payload.new as DealMessageRow;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        }
      )
      .subscribe((status) => {
        setOnline(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [offerId, viewerId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: PendingMessage = {
      id: tempId,
      offer_id: offerId,
      sender_id: viewerId,
      body,
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
      tempId,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    setSending(true);
    setSendError(null);
    try {
      const supabase = createClient();
      const saved = await sendMessage(supabase, viewerId, { offerId, body });
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.tempId !== tempId);
        if (withoutTemp.some((m) => m.id === saved.id)) return withoutTemp;
        return [...withoutTemp, saved];
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
      setDraft(body);
      setSendError('Could not send that message. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {!online && <div className="thread-banner">You&apos;re offline — reconnecting…</div>}
      <div className="thread">
        {messages.length === 0 && <p className="empty-state">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.sender_id === viewerId ? 'mine' : ''}`}>
            <div className="bubble-wrap">
              <div className={`bubble ${m.pending ? 'bubble-pending' : ''}`}>{m.body}</div>
              {m.sender_id === viewerId && (
                <div className="bubble-meta">
                  {m.pending ? 'Sending…' : m.read_at ? 'Seen' : 'Sent'}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {blocked ? (
        <p className="muted">You can&apos;t message this person.</p>
      ) : !canSend ? (
        <p className="muted">This chat opens once the offer is accepted.</p>
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
            placeholder="Message…"
            maxLength={2000}
            disabled={sending}
          />
          <button className="btn-primary" onClick={handleSend} disabled={sending || !draft.trim()}>
            Send
          </button>
        </div>
      )}
      {sendError && <p className="field-error">{sendError}</p>}
    </div>
  );
}
