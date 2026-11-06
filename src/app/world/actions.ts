'use server';

// Collectors World server actions (MV-W02-03/05). Each one: session → `world` flag (and
// `world_shop` for anything priced) → domain/world service → a plain result the client view can
// render inline. Nothing here asserts an amount: prices, caps and gates live in the RPCs (07 P4).
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import {
  WorldError,
  buyItem,
  buyLevel,
  createInvite,
  giveKudos,
  hideGuestbookEntry,
  postGuestbook,
  renameGarage,
  revokeInvite,
  saveLayout,
  updateGarageSettings,
  type WorldErrorCode,
} from '@/domain/world';
import { WORLD_ERROR_COPY } from '@/components/world/copy';
import type { Client } from '@/lib/supabase/types';

export type WorldActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: WorldErrorCode | 'invalid' | 'unavailable'; error: string };

async function gate(
  shop = false
): Promise<
  { ok: true; supabase: Client; userId: string } | { ok: false; code: 'unavailable'; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unavailable', error: WORLD_ERROR_COPY.not_authorized };
  const ctx = { userId: user.id };
  if (!(await isFlagEnabled(supabase, 'world', ctx)))
    return { ok: false, code: 'unavailable', error: 'Collectors World is not open for you yet.' };
  if (shop && !(await isFlagEnabled(supabase, 'world_shop', ctx)))
    return { ok: false, code: 'unavailable', error: 'The shop is closed right now.' };
  return { ok: true, supabase, userId: user.id };
}

function fail(e: unknown): WorldActionResult<never> {
  if (e instanceof WorldError) return { ok: false, code: e.code, error: WORLD_ERROR_COPY[e.code] };
  if (e && typeof e === 'object' && 'issues' in e)
    return { ok: false, code: 'invalid', error: 'Please check what you entered.' };
  throw e;
}

function done() {
  revalidatePath('/world', 'layout');
}

export async function saveLayoutAction(layout: unknown): Promise<WorldActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await saveLayout(g.supabase, g.userId, layout);
    done();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function updateGarageSettingsAction(input: unknown): Promise<WorldActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await updateGarageSettings(g.supabase, g.userId, input);
    done();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function renameGarageAction(
  name: string
): Promise<WorldActionResult<{ name: string }>> {
  const g = await gate(true);
  if (!g.ok) return g;
  try {
    const row = await renameGarage(g.supabase, { name });
    done();
    return { ok: true, data: { name: row.name } };
  } catch (e) {
    return fail(e);
  }
}

export async function buyLevelAction(): Promise<WorldActionResult<{ level: number }>> {
  const g = await gate(true);
  if (!g.ok) return g;
  try {
    const row = await buyLevel(g.supabase);
    done();
    return { ok: true, data: { level: row.level } };
  } catch (e) {
    return fail(e);
  }
}

export async function buyItemAction(
  itemId: string
): Promise<WorldActionResult<{ itemId: string }>> {
  const g = await gate(true);
  if (!g.ok) return g;
  try {
    const row = await buyItem(g.supabase, { itemId });
    done();
    return { ok: true, data: { itemId: row.item_id } };
  } catch (e) {
    return fail(e);
  }
}

// ---------- W03 social (MV-W03-03/04): kudos, guestbook, invites ----------

export async function giveKudosAction(
  garageUserId: string
): Promise<WorldActionResult<{ givenOn: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await giveKudos(g.supabase, garageUserId);
    done();
    return { ok: true, data: { givenOn: row.given_on } };
  } catch (e) {
    return fail(e);
  }
}

export async function postGuestbookAction(
  garageUserId: string,
  body: string
): Promise<WorldActionResult<{ id: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await postGuestbook(g.supabase, { garageUserId, body });
    done();
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function hideGuestbookAction(
  entryId: string,
  hidden: boolean
): Promise<WorldActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await hideGuestbookEntry(g.supabase, entryId, hidden);
    done();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function createInviteAction(input: {
  inviteeHandle?: string;
  hours?: number;
  maxUses?: number;
}): Promise<WorldActionResult<{ id: string; token: string; expiresAt: string; maxUses: number }>> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    const row = await createInvite(g.supabase, input);
    done();
    return {
      ok: true,
      data: { id: row.id, token: row.token, expiresAt: row.expires_at, maxUses: row.max_uses },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeInviteAction(inviteId: string): Promise<WorldActionResult> {
  const g = await gate();
  if (!g.ok) return g;
  try {
    await revokeInvite(g.supabase, inviteId);
    done();
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
