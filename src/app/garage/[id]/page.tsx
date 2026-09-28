import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCollectionItem } from '@/domain/garage';
import CarDetailView from '@/components/CarDetailView';
import { FIXTURE_ITEMS, isVisualHarness } from '@/lib/visual-fixtures';

async function loadItem(id: string, searchParams: Record<string, string | string[] | undefined>) {
  if (isVisualHarness(searchParams)) {
    // D-041 baseline harness, non-production only
    const item = FIXTURE_ITEMS.find((i) => i.id === id);
    if (!item) notFound();
    return { item, isOwner: true };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const item = await getCollectionItem(supabase, id);
  if (!item) notFound();
  return { item, isOwner: item.owner_id === user.id };
}

export default async function CarDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { item, isOwner } = await loadItem(id, await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <CarDetailView item={item} isOwner={isOwner} />
    </main>
  );
}
