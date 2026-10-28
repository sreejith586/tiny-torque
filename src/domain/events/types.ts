// Typed event catalogue — every event name named across 04-feature-specs.md's per-feature
// "Events" lines, plus invite.redeemed (emitted by the redeem_invite RPC, MV-S1-05), the S8
// additions (D-079): item.photo_added + user.opened (F-13 XP inputs that had no event to count),
// user.unblocked (settings blocked-users list) and feedback.created (settings feedback form), plus
// the Collectors World catalogue (F-20…F-28, MV-W01-06): world.* / meetup.* / race.* / club.* /
// quest.* are registered up front so every World sprint emits from the same list; consumers
// (XP, score, notifications) land in their own sprints (W02 slot-integrity, W04 earn engine…).
export const EVENT_TYPES = [
  'user.signed_up',
  'user.onboarded',
  'user.accepted_terms',
  'profile.updated',
  'user.deleted',
  'user.blocked',
  'user.unblocked',
  'user.opened',
  'user.suspended',
  'user.unsuspended',
  'item.created',
  'item.updated',
  'item.deleted',
  'item.restored',
  'item.made_public',
  'item.made_private',
  'item.favorited',
  'item.photo_added',
  'scan.requested',
  'scan.completed',
  'scan.accepted',
  'import.completed',
  'listing.published',
  'listing.updated',
  'listing.renewed',
  'listing.expired',
  'listing.removed',
  'listing.sold',
  'listing.viewed',
  'offer.created',
  'offer.accepted',
  'offer.declined',
  'offer.withdrawn',
  'offer.expired',
  'offer.completed',
  'offer.cancelled',
  'message.sent',
  'tokens.purchased',
  'tokens.spent',
  'tokens.refunded',
  'tokens.adjusted',
  'tokens.earned',
  'tokens.expired',
  'pro.activated',
  'pro.expired',
  'xp.granted',
  'badge.unlocked',
  'report.created',
  'report.resolved',
  'review.created',
  'invite.redeemed',
  'feedback.created',
  'flag.updated',
  // ---- Collectors World (07 §2, §6.2) ----
  'world.garage_created',
  'world.garage_updated',
  'world.layout_saved',
  'world.level_up',
  'world.item_bought',
  'world.item_granted',
  'world.visited',
  'world.kudos_given',
  'world.guestbook_posted',
  'world.score_updated',
  'meetup.created',
  'meetup.scheduled',
  'meetup.started',
  'meetup.ended',
  'meetup.cancelled',
  'meetup.rsvp',
  'meetup.checked_in',
  'meetup.best_in_show',
  'race.created',
  'race.entered',
  'race.locked',
  'race.completed',
  'race.cancelled',
  'club.created',
  'club.joined',
  'club.left',
  'club.role_changed',
  'quest.progressed',
  'quest.completed',
  'quest.reset',
  'season.started',
  'season.ended',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventEntity =
  | 'profile'
  | 'item'
  | 'scan'
  | 'import'
  | 'listing'
  | 'offer'
  | 'token'
  | 'badge'
  | 'report'
  | 'review'
  | 'invite'
  | 'flag'
  | 'garage'
  | 'world_item'
  | 'meetup'
  | 'race'
  | 'club'
  | 'quest'
  | 'season';

export interface EmitEventInput {
  actorId: string;
  type: EventType;
  entity: EventEntity;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}
