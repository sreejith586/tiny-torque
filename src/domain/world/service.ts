// Collectors World core service (MV-W01-04/06, F-20/F-27). Components/routes call this, never the
// repo (D-007). Every mutation emits a domain event (D-009): the RPC-backed ones
// (ensure/buyLevel/buyItem) emit inside the RPC transaction, the owner edits emit from here.
// Everything here stays dark until the `world*` flags are on (D-018/D-028) — the flag check is
// the caller's job (route/page), same as every other domain service.
import type { Client, Json } from '@/lib/supabase/types';
import { emitEvent } from '@/domain/events';
import { findBannedLanguage } from '@/lib/clean-language';
import { getPublicProfile, listPublicProfilesByIds } from '@/domain/identity';
import { listPublicCollectionItems } from '@/domain/garage';
import * as repo from './repo';
import { WorldError, rethrowAsWorldError } from './errors';
import {
  buyItemSchema,
  createInviteSchema,
  handleParamSchema,
  inviteTokenSchema,
  openGaragesQuerySchema,
  parseStoredLayout,
  postGuestbookSchema,
  renameGarageSchema,
  updateGarageSchema,
  validateLayout,
} from './schema';
import type { GarageLayout } from './schema';
import type {
  GuestbookEntry,
  OwnGarage,
  RecentVisitor,
  VisitorGarage,
  WorldGarageRow,
  WorldGuestbookRow,
  WorldInventoryRow,
  WorldInviteRow,
  WorldKudosRow,
  WorldOpenGarageRow,
  WorldShop,
  WorldVisitRow,
} from './types';

export { WorldError } from './errors';
export type { WorldErrorCode } from './errors';

/** Lazily creates the caller's garage (RPC, idempotent, emits world.garage_created once). */
export async function ensureGarage(supabase: Client): Promise<WorldGarageRow> {
  try {
    return await repo.ensureGarage(supabase);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

/** Pure visibility rule mirrored from the world_garages RLS policy, for the viewer-side facts the
 *  service already holds (owner, public, invite). Follower/block facts stay with RLS — a row the
 *  policy hides never reaches here, so this is defense in depth on the parts that are free. */
export function isGarageVisibleTo(
  garage: Pick<WorldGarageRow, 'user_id' | 'open_mode'>,
  viewerId: string | null
): boolean {
  if (viewerId && viewerId === garage.user_id) return true;
  if (garage.open_mode === 'public') return true;
  if (garage.open_mode === 'followers') return viewerId !== null; // RLS decided the follow
  return false; // invite: owner-only until world_invites (W03)
}

export async function getOwnGarage(supabase: Client): Promise<OwnGarage> {
  const garage = await ensureGarage(supabase);
  const [levels, inventory] = await Promise.all([
    repo.listLevels(supabase),
    repo.listInventory(supabase, garage.user_id),
  ]);
  const level = levels.find((l) => l.level === garage.level);
  if (!level) throw new WorldError('garage_not_found');
  return {
    garage,
    level,
    nextLevel: levels.find((l) => l.level === garage.level + 1) ?? null,
    displayCapacity: level.display_slots + garage.extra_slots,
    inventory,
    layout: parseStoredLayout(garage.layout),
  };
}

/** A garage by its owner's handle, as seen by `viewerId` (null = anon). Returns null for unknown
 *  handle, hidden garage (open_mode / blocks via RLS) or a garage that was never created. */
export async function getGarageForVisitor(
  supabase: Client,
  handleInput: unknown,
  viewerId: string | null
): Promise<VisitorGarage | null> {
  const parsedHandle = handleParamSchema.safeParse(handleInput);
  if (!parsedHandle.success) return null;

  const owner = await getPublicProfile(supabase, parsedHandle.data);
  if (!owner?.id || !owner.handle) return null;

  const garage = await repo.getGarage(supabase, owner.id);
  if (!garage || !isGarageVisibleTo(garage, viewerId)) return null;

  const levels = await repo.listLevels(supabase);
  const level = levels.find((l) => l.level === garage.level);
  if (!level) return null;

  return {
    garage: {
      user_id: garage.user_id,
      level: garage.level,
      name: garage.name,
      open_mode: garage.open_mode,
      featured_item_id: garage.featured_item_id,
      theme_item_id: garage.theme_item_id,
      score: garage.score,
      visit_count: garage.visit_count,
      kudos_count: garage.kudos_count,
      created_at: garage.created_at,
    },
    level,
    layout: parseStoredLayout(garage.layout),
    owner: { id: owner.id, handle: owner.handle, displayName: owner.display_name ?? owner.handle },
  };
}

/** Owner edits open house mode / featured car / theme. Name, level, score and the purchase
 *  bookkeeping columns are RPC-only (world_garages_guard). */
export async function updateGarageSettings(
  supabase: Client,
  userId: string,
  input: unknown
): Promise<WorldGarageRow> {
  const v = updateGarageSchema.parse(input);
  const patch: Parameters<typeof repo.updateGarage>[2] = {};
  if (v.openMode !== undefined) patch.open_mode = v.openMode;
  if (v.featuredItemId !== undefined) patch.featured_item_id = v.featuredItemId;
  if (v.themeItemId !== undefined) patch.theme_item_id = v.themeItemId;

  await ensureGarage(supabase);
  let row: WorldGarageRow;
  try {
    row = await repo.updateGarage(supabase, userId, patch);
  } catch (e) {
    rethrowAsWorldError(e); // theme_not_owned from the guard trigger
  }
  await emitEvent(supabase, {
    actorId: userId,
    type: 'world.garage_updated',
    entity: 'garage',
    entityId: userId,
    payload: { fields: Object.keys(patch) },
  });
  return row;
}

/** Renames the garage via rename_world_garage: first one free, then the `garage_rename` price
 *  (spend_tokens, D-021). The RPC emits world.garage_updated. */
export async function renameGarage(supabase: Client, input: unknown): Promise<WorldGarageRow> {
  const v = renameGarageSchema.parse(input);
  if (findBannedLanguage(v.name)) throw new WorldError('language_not_allowed'); // MV-S6-04 / W03
  try {
    return await repo.renameGarage(supabase, v.name);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

/** Saves the layout document after checking slots ≤ capacity (level + bought extra slots), items
 *  public + owned (07 §6.2). */
export async function saveLayout(
  supabase: Client,
  userId: string,
  input: unknown
): Promise<GarageLayout> {
  const own = await getOwnGarage(supabase);
  const publicItems = await listPublicCollectionItems(supabase, userId);
  const layout = validateLayout(input, {
    displaySlots: own.displayCapacity,
    decorSlots: own.level.decor_slots,
    publicItemIds: new Set(publicItems.map((i) => i.id)),
    ownedWorldItemIds: new Set(own.inventory.map((i) => i.item_id)),
  });
  await repo.updateGarage(supabase, userId, { layout: layout as unknown as NonNullable<Json> });
  await emitEvent(supabase, {
    actorId: userId,
    type: 'world.layout_saved',
    entity: 'garage',
    entityId: userId,
    payload: { slots: layout.slots.length, decor: layout.decor.length },
  });
  return layout;
}

/** Next garage level, paid with tokens inside buy_world_level (spend_tokens, D-021). The RPC
 *  emits world.level_up. Throws WorldError: xp_level_too_low / max_level / insufficient_balance. */
export async function buyLevel(supabase: Client): Promise<WorldGarageRow> {
  try {
    return await repo.buyLevel(supabase);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

/** Shop purchase via buy_world_item (emits world.item_bought). Throws WorldError:
 *  item_not_found / earned_only / level_too_low / already_owned / insufficient_balance. */
export async function buyItem(supabase: Client, input: unknown): Promise<WorldInventoryRow> {
  const v = buyItemSchema.parse(input);
  try {
    return await repo.buyItem(supabase, v.itemId, v.idempotencyKey);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

export async function listShop(supabase: Client): Promise<WorldShop> {
  const [levels, items] = await Promise.all([
    repo.listLevels(supabase),
    repo.listActiveItems(supabase),
  ]);
  return { levels, items };
}

// ---------- W03 social: visits, kudos, guestbook, invites, open garages (MV-W03-02, F-21) ----------
// Every mutation is an RPC that emits its own domain event (D-009) and enforces visibility,
// blocks, dedup and rate limits in the DB (07 P4 / §6.6); this layer adds zod (D-013), the
// clean-language validator (MV-S6-04, mandatory from W03) and public-profile joins — handles and
// display names only, never PII (rule 15).

type PublicIdentity = { id: string; handle: string; displayName: string };

async function identities(supabase: Client, ids: string[]): Promise<Map<string, PublicIdentity>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map();
  const rows = await listPublicProfilesByIds(supabase, unique);
  return new Map(
    rows
      .filter((r) => r.id && r.handle)
      .map((r) => [
        r.id as string,
        {
          id: r.id as string,
          handle: r.handle as string,
          displayName: r.display_name ?? (r.handle as string),
        },
      ])
  );
}

/** Records today's visit (one row per visitor per day); null when the caller owns the garage.
 *  Throws garage_not_found for anything the caller may not see (hidden mode, block). */
export async function recordVisit(
  supabase: Client,
  garageUserId: string
): Promise<WorldVisitRow | null> {
  try {
    return await repo.recordVisit(supabase, garageUserId);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

/** One kudos per visitor per garage per day; a repeat returns today's row unchanged. */
export async function giveKudos(supabase: Client, garageUserId: string): Promise<WorldKudosRow> {
  try {
    return await repo.giveKudos(supabase, garageUserId);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

export async function postGuestbook(supabase: Client, input: unknown): Promise<WorldGuestbookRow> {
  const v = postGuestbookSchema.parse(input);
  if (findBannedLanguage(v.body)) throw new WorldError('language_not_allowed');
  try {
    return await repo.postGuestbook(supabase, v.garageUserId, v.body);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

/** Host (or admin) hides / unhides a line; the RPC checks ownership. */
export async function hideGuestbookEntry(
  supabase: Client,
  entryId: string,
  hidden = true
): Promise<WorldGuestbookRow> {
  try {
    return await repo.hideGuestbook(supabase, entryId, hidden);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

/** Guestbook lines the caller may see (RLS: garage visibility; hidden lines only for the host),
 *  with each author's public identity. */
export async function listGuestbook(
  supabase: Client,
  garageUserId: string,
  limit = 20
): Promise<GuestbookEntry[]> {
  const rows = await repo.listGuestbook(supabase, garageUserId, limit);
  const who = await identities(
    supabase,
    rows.map((r) => r.author_id)
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    hidden: r.hidden_by_host,
    author: who.get(r.author_id) ?? {
      id: r.author_id,
      handle: 'collector',
      displayName: 'A collector',
    },
  }));
}

/** The owner's "recent visitors" — handles only (07 §2.2). RLS limits the rows to the owner. */
export async function listRecentVisitors(
  supabase: Client,
  garageUserId: string,
  limit = 10
): Promise<RecentVisitor[]> {
  const rows = await repo.listRecentVisits(supabase, garageUserId, limit);
  const who = await identities(
    supabase,
    rows.map((r) => r.visitor_id)
  );
  return rows.flatMap((r) => {
    const p = who.get(r.visitor_id);
    return p
      ? [
          {
            visitorId: r.visitor_id,
            handle: p.handle,
            displayName: p.displayName,
            visitedOn: r.visited_on,
          },
        ]
      : [];
  });
}

/** Share-link invite (token, max uses) or direct invite by handle (single use, notifies them). */
export async function createInvite(supabase: Client, input: unknown): Promise<WorldInviteRow> {
  const v = createInviteSchema.parse(input);
  try {
    return await repo.createInvite(supabase, {
      inviteeHandle: v.inviteeHandle,
      hours: v.hours,
      maxUses: v.maxUses,
    });
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

export async function acceptInvite(supabase: Client, token: unknown): Promise<WorldInviteRow> {
  const parsed = inviteTokenSchema.safeParse(token);
  if (!parsed.success) throw new WorldError('invite_invalid');
  try {
    return await repo.acceptInvite(supabase, parsed.data);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

export async function revokeInvite(supabase: Client, inviteId: string): Promise<WorldInviteRow> {
  try {
    return await repo.revokeInvite(supabase, inviteId);
  } catch (e) {
    rethrowAsWorldError(e);
  }
}

export const listInvites = repo.listInvites;

/** /admin reports queue preview of reported guestbook lines (MV-W03-08). */
export const listGuestbookByIds = repo.listGuestbookByIds;

/** Public garages for the "Open garages" page: viewer's country by default, 'all' to widen. */
export async function listOpenGarages(
  supabase: Client,
  input: unknown,
  viewerCountry?: string | null
): Promise<WorldOpenGarageRow[]> {
  const q = openGaragesQuerySchema.parse(input ?? {});
  const country = q.country === 'all' ? undefined : (q.country ?? viewerCountry ?? undefined);
  return repo.listOpenGarages(supabase, { country, limit: q.limit });
}

export const listLevels = repo.listLevels;

export type {
  OwnGarage,
  VisitorGarage,
  WorldShop,
  WorldGarageRow,
  WorldInventoryRow,
  WorldItemRow,
  WorldLevelRow,
  WorldOpenMode,
  WorldItemKind,
} from './types';
export { WORLD_OPEN_MODES } from './types';
export {
  garageLayoutSchema,
  EMPTY_LAYOUT,
  parseStoredLayout,
  validateLayout,
  updateGarageSchema,
  renameGarageSchema,
  buyItemSchema,
  handleParamSchema,
} from './schema';
export type {
  GarageLayout,
  UpdateGarageInput,
  RenameGarageInput,
  BuyItemInput,
  LayoutContext,
} from './schema';
export {
  createInviteSchema,
  postGuestbookSchema,
  openGaragesQuerySchema,
  inviteTokenSchema,
} from './schema';
export type { CreateInviteInput, PostGuestbookInput, OpenGaragesQuery } from './schema';
export type { GuestbookEntry, RecentVisitor, WorldOpenGarageRow, WorldInviteRow } from './types';
