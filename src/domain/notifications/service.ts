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
  // Collectors World (W03, F-21)
  world_visit: 'Someone visited your garage.',
  world_kudos: 'Your garage got kudos.',
  world_guestbook: 'Someone signed your guestbook.',
  world_invite: 'You were invited to a garage.',
  // T-14 d earned-credit expiry notice (F-26, D-070; jobs runner MV-W04-04)
  tokens_expiring: 'Some of your earned credits expire soon.',
  // H1 housekeeping jobs (MV-S9-01, F-19): hourly expire_listings / expire_offers
  listing_expired: 'One of your listings expired. Renew it to keep it on the market.',
  offer_expired: 'Your offer expired before the seller responded.',
  // Virtual meetups (W06, F-23)
  meetup_invite: 'You were invited to a meetup.',
  meetup_reminder: 'A meetup you joined starts soon.',
  meetup_live: 'A meetup you joined is live now.',
  meetup_cancelled: 'A meetup you joined was cancelled.',
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
    case 'world_visit':
    case 'world_kudos':
    case 'world_guestbook':
      return '/world/garage';
    case 'world_invite':
      return typeof payload.handle === 'string' ? `/world/g/${payload.handle}` : '/world';
    case 'tokens_expiring':
      return '/tokens/history';
    case 'listing_expired': // the Expired tab + Renew live on My listings (MV-S4-07)
      return '/market/mine';
    case 'offer_expired':
      return '/offers';
    case 'meetup_invite':
    case 'meetup_reminder':
    case 'meetup_cancelled':
      return typeof payload.meetup_id === 'string'
        ? `/world/meetups/${payload.meetup_id}`
        : '/world/meetups';
    case 'meetup_live':
      return typeof payload.meetup_id === 'string'
        ? `/world/meetups/${payload.meetup_id}/room`
        : '/world/meetups';
    default:
      return null;
  }
}
