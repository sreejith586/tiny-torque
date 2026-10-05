import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listGarage } from '@/domain/garage';
import GarageView from '@/components/GarageView';
import { FIXTURE_ITEMS, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'My Garage',
};

async function loadFirstPage(searchParams: Record<string, string | string[] | undefined>) {
  // D-041 baseline harness (non-production only): one page of fixtures, no cursor.
  if (isVisualHarness(searchParams)) return { items: FIXTURE_ITEMS, cursor: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { items, nextCursor } = await listGarage(supabase, user.id);
  return { items, cursor: nextCursor };
}

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { items, cursor } = await loadFirstPage(await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 24 }}>My Garage</h1>
        <Link href="/garage/trash" className="muted" style={{ fontSize: 13 }}>
          Trash
        </Link>
      </div>
      <GarageView initialItems={items} initialCursor={cursor} />
    </main>
  );
}
