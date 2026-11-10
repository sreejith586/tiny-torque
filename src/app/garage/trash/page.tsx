import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listTrashItems } from '@/domain/garage';
import TrashView from '@/components/TrashView';
import { FIXTURE_TRASH_ITEMS } from '@/lib/visual-fixtures';
import { isHarnessRequest } from '@/lib/visual-harness.server';

export const metadata: Metadata = { title: 'Trash' };

async function loadItems(searchParams: Record<string, string | string[] | undefined>) {
  // D-056 fixture harness (non-production only, MV-S9-05).
  if (await isHarnessRequest(searchParams)) return FIXTURE_TRASH_ITEMS;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return listTrashItems(supabase, user.id);
}

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const items = await loadItems(await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24 }}>Trash</h1>
      <TrashView items={items} />
    </main>
  );
}
