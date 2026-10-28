// Collectors World — row/enum aliases derived from the GENERATED src/types/supabase.ts (D-006).
import type { Tables, Enums } from '@/lib/supabase/types';
import type { GarageLayout } from './schema';

export type WorldGarageRow = Tables<'world_garages'>;
export type WorldLevelRow = Tables<'world_levels'>;
export type WorldItemRow = Tables<'world_items'>;
export type WorldInventoryRow = Tables<'world_inventory'>;

export type WorldOpenMode = Enums<'world_open_mode'>;
export type WorldItemKind = Enums<'world_item_kind'>;
export type WorldAcquiredVia = Enums<'world_acquired_via'>;

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
    | 'created_at'
  >;
  level: WorldLevelRow;
  layout: GarageLayout;
  owner: { id: string; handle: string; displayName: string };
}

export interface WorldShop {
  levels: WorldLevelRow[];
  items: WorldItemRow[];
}
