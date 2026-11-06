import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { listInvites } from '@/domain/world';
import { listPublicProfilesByIds } from '@/domain/identity';
import GarageEditor, { type InviteSummary } from '@/components/world/GarageEditor';
import { FIXTURE_WORLD_INVITES, isVisualHarness } from '@/lib/visual-fixtures';
import { loadWorldPage } from '../_data';

export const metadata: Metadata = {
  title: 'Your garage',
};

/** Open invites with invitee handles resolved through public_profiles (never PII). */
async function loadInvites(harness: boolean, userId: string | null): Promise<InviteSummary[]> {
  const rows = harness
    ? FIXTURE_WORLD_INVITES
    : userId
      ? await listInvites(await createClient(), userId).catch(() => [])
      : [];
  const inviteeIds = rows.map((r) => r.invitee_id).filter((id): id is string => !!id);
  const handles = new Map<string, string>();
  if (harness) {
    handles.set('00000000-0000-4000-8000-000000000012', 'blr_castings');
  } else if (inviteeIds.length) {
    const profiles = await listPublicProfilesByIds(await createClient(), inviteeIds).catch(
      () => []
    );
    for (const p of profiles) if (p.id && p.handle) handles.set(p.id, p.handle);
  }
  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    inviteeHandle: r.invitee_id ? (handles.get(r.invitee_id) ?? 'collector') : null,
    expiresAt: r.expires_at,
    maxUses: r.max_uses,
    usedCount: r.used_count,
  }));
}

// Scene + editor (MV-W02-02/03, D-082) + invites panel (MV-W03-04, D-087).
export default async function WorldGaragePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { own, items, shop } = await loadWorldPage(sp, { next: '/world/garage' });
  const owned = new Set(own.inventory.map((i) => i.item_id));
  const themes = shop.items.filter((i) => i.kind === 'theme' && owned.has(i.id));
  const renamePrice = shop.items.find((i) => i.sku === 'garage_rename')?.price ?? null;
  const invites = await loadInvites(isVisualHarness(sp), own.garage.user_id);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Your garage</h1>
      <p className="page-sub">Place your public cars, pick a featured one, set who can visit.</p>
      <GarageEditor
        own={own}
        items={items}
        themes={themes}
        renamePrice={renamePrice}
        invites={invites}
      />
    </main>
  );
}
