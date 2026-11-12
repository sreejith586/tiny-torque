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
  // auth.users row + storage objects gone after the grace period — purge_accounts job (MV-S9-01, D-080)
  'user.purged',
  'user.blocked',
  'user.unblocked',
  'user.followed',
  'user.unfollowed',
  'user.opened',
  'user.suspended',
  'user.unsuspended',
  // admin earn freeze per user (F-26 / 06 §5 'earn exploit', MV-W05-06)
  'user.earn_frozen',
  'user.earn_unfrozen',
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
  // T-14 d expiry notice per (user, expiry day) batch of earned credits — jobs runner (MV-W04-04, D-070)
  'tokens.expiring_soon',
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
  // catalogue car specs (F-25 racing input, MV-W08-prep): member/AI proposal → admin verification
  'catalog.specs_proposed',
  'catalog.specs_verified',
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
  'world.guestbook_hidden',
  'world.invite_created',
  'world.invite_accepted',
  'world.invite_revoked',
  'world.score_updated',
  'world.item_placed',
  'meetup.created',
  'meetup.scheduled',
  'meetup.started',
  'meetup.ended',
  'meetup.cancelled',
  'meetup.rsvp',
  'meetup.checked_in',
  'meetup.best_in_show',
  // W06 additions (MV-W06-01/02): the RPCs emit these; `meetup.updated` is the service's (host edits)
  'meetup.updated',
  'meetup.invited',
  'meetup.showcase_updated',
  'meetup.moderated',
  'meetup.reminder',
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
  'season.milestone_reached',
  'season.finished',
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
  | 'catalog_model'
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
