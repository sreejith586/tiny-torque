// Notifications service (MV-S6-06, F-12). Components/routes import from here, never from repo.
import * as repo from './repo';
import type { NotificationRow, NotificationType } from './types';

export const listNotifications = repo.listNotifications;
export const countUnread = repo.countUnread;
export const markRead = repo.markRead;
export const markAllRead = repo.markAllRead;

const NOTIFICATION_TEXT: Record<NotificationType, string> = {
  offer_received: 'You received a new offer.',
  offer_accepted: 'Your offer was accepted.',
  offer_declined: 'Your offer was declined.',
  message: 'You have a new message.',
  listing_sold: 'A listing was marked sold.',
  review_received: 'You received a new review.',
  badge_unlocked: 'You unlocked a new badge.',
  wishlist_match: 'A new listing matches your wishlist.',
  system: 'Tiny Torque update.',
};

/** Pure: what the notification says. No DB access, unit-testable in isolation. */
export function notificationText(n: Pick<NotificationRow, 'type'>): string {
  return NOTIFICATION_TEXT[n.type] ?? 'Notification';
}

/** Pure: where tapping the notification should go, or null when there's nowhere to deep-link yet
 * (wishlist_match/system — neither surface exists to link into). */
export function notificationLink(n: Pick<NotificationRow, 'type' | 'payload'>): string | null {
  const payload = (n.payload ?? {}) as Record<string, unknown>;
  switch (n.type) {
    case 'offer_received':
    case 'offer_accepted':
    case 'offer_declined':
    case 'listing_sold':
      return '/offers';
    case 'message':
      return typeof payload.offer_id === 'string' ? `/deals/${payload.offer_id}` : '/offers';
    case 'review_received':
    case 'badge_unlocked': // the badge grid lives on the profile stats dashboard (MV-S8-03)
      return '/profile';
    default:
      return null;
  }
}
