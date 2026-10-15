'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  markRead,
  markAllRead,
  notificationText,
  notificationLink,
  type NotificationRow,
} from '@/domain/notifications';

export default function NotificationsListView({
  initialNotifications,
  viewerId,
}: {
  initialNotifications: NotificationRow[];
  viewerId: string;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${viewerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${viewerId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setNotifications((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewerId]);

  function handleOpen(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n))
    );
    const supabase = createClient();
    markRead(supabase, id).catch(() => {});
  }

  async function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
    const supabase = createClient();
    await markAllRead(supabase, viewerId).catch(() => {});
  }

  if (notifications.length === 0) {
    return (
      <div className="empty-state">
        <p>No notifications yet.</p>
      </div>
    );
  }

  return (
    <div>
      {unreadCount > 0 && (
        <button
          type="button"
          className="btn-secondary"
          style={{ width: 'auto', padding: '8px 10px', fontSize: 12, marginBottom: 12 }}
          onClick={handleMarkAllRead}
        >
          Mark all read
        </button>
      )}
      {notifications.map((n) => {
        const href = notificationLink(n);
        const body = (
          <div
            className="panel"
            style={{
              marginBottom: 8,
              background: n.read_at ? undefined : 'var(--panel-alt)',
            }}
          >
            <p style={{ margin: 0, fontSize: 14 }}>{notificationText(n)}</p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              {new Date(n.created_at).toLocaleString()}
            </p>
          </div>
        );
        return href ? (
          <Link
            key={n.id}
            href={href}
            onClick={() => handleOpen(n.id)}
            style={{ display: 'block' }}
          >
            {body}
          </Link>
        ) : (
          <div key={n.id} onClick={() => handleOpen(n.id)}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
