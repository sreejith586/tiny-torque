import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listCollectionItems } from '@/domain/garage';
import GarageView from '@/components/GarageView';
import { FIXTURE_ITEMS, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'My Garage',
};

async function loadItems(searchParams: Record<string, string | string[] | undefined>) {
  if (isVisualHarness(searchParams)) return FIXTURE_ITEMS; // D-041 baseline harness, non-production only
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return listCollectionItems(supabase, user.id);
}

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const items = await loadItems(await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24 }}>My Garage</h1>
      <GarageView items={items} />
    </main>
  );
}
