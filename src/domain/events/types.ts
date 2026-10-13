// Typed event catalogue — every event name named across 04-feature-specs.md's per-feature
// "Events" lines, plus invite.redeemed (emitted by the redeem_invite RPC, MV-S1-05).
export const EVENT_TYPES = [
  'user.signed_up',
  'user.onboarded',
  'profile.updated',
  'user.deleted',
  'user.blocked',
  'user.suspended',
  'user.unsuspended',
  'item.created',
  'item.updated',
  'item.deleted',
  'item.restored',
  'item.made_public',
  'item.made_private',
  'item.favorited',
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
  'pro.activated',
  'pro.expired',
  'xp.granted',
  'badge.unlocked',
  'report.created',
  'report.resolved',
  'invite.redeemed',
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
  | 'invite';

export interface EmitEventInput {
  actorId: string;
  type: EventType;
  entity: EventEntity;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}
