// Collectors World — row/enum aliases derived from the GENERATED src/types/supabase.ts (D-006).
import type { Tables, Enums } from '@/lib/supabase/types';
import type { GarageLayout } from './schema';

export type WorldGarageRow = Tables<'world_garages'>;
export type WorldLevelRow = Tables<'world_levels'>;
export type WorldItemRow = Tables<'world_items'>;
export type WorldInventoryRow = Tables<'world_inventory'>;
export type WorldVisitRow = Tables<'world_visits'>;
export type WorldKudosRow = Tables<'world_kudos'>;
export type WorldGuestbookRow = Tables<'world_guestbook'>;
export type WorldInviteRow = Tables<'world_invites'>;
/** The `world_open_garages` view (public garages + public profile, blocks applied per caller;
 *  `spotlight_until` = the active Spotlight's expiry, W05). */
export type WorldOpenGarageRow = Tables<'world_open_garages'>;
export type WorldEarnFreezeRow = Tables<'world_earn_freezes'>;

export type WorldOpenMode = Enums<'world_open_mode'>;
export type WorldItemKind = Enums<'world_item_kind'>;
export type WorldAcquiredVia = Enums<'world_acquired_via'>;

/** Kinds that may sit in a decor slot (07 §2.1 "wall, floor, lighting, signage, shelves, trophy
 *  wall"); themes apply to the whole scene, tunes are race-only, consumables are not objects. */
export const PLACEABLE_KINDS = [
  'decor',
  'signage',
  'trophy',
] as const satisfies readonly WorldItemKind[];

export function isPlaceableKind(kind: WorldItemKind): boolean {
  return (PLACEABLE_KINDS as readonly WorldItemKind[]).includes(kind);
}

export const WORLD_OPEN_MODES = [
  'public',
  'followers',
  'invite',
] as const satisfies readonly WorldOpenMode[];

/** The owner's view of their own garage — everything the editor/shop screens (W02) need. */
export interface OwnGarage {
  garage: WorldGarageRow;
  level: WorldLevelRow;
  /** null at the top level (Vault). */
  nextLevel: WorldLevelRow | null;
  /** level.display_slots + garage.extra_slots — what the layout may fill (world_slots). */
  displayCapacity: number;
  inventory: WorldInventoryRow[];
  layout: GarageLayout;
}

/** What a visitor (or anon share-link viewer) may see. No PII beyond the public profile fields —
 *  never the owner's mobile/email (rule 15). */
export interface VisitorGarage {
  garage: Pick<
    WorldGarageRow,
    | 'user_id'
    | 'level'
    | 'name'
    | 'open_mode'
    | 'featured_item_id'
    | 'theme_item_id'
    | 'score'
    | 'visit_count'
    | 'kudos_count'
    | 'created_at'
  >;
  level: WorldLevelRow;
  layout: GarageLayout;
  owner: { id: string; handle: string; displayName: string };
}

/** A guestbook line with its author's public identity (never PII). */
export interface GuestbookEntry {
  id: string;
  body: string;
  createdAt: string;
  hidden: boolean;
  author: { id: string; handle: string; displayName: string };
}

export interface RecentVisitor {
  visitorId: string;
  handle: string;
  displayName: string;
  visitedOn: string;
}

export interface WorldShop {
  levels: WorldLevelRow[];
  items: WorldItemRow[];
}
