import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCollectionItem } from '@/domain/garage';
import CarDetailView from '@/components/CarDetailView';

export default async function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const item = await getCollectionItem(supabase, id);
  if (!item) notFound();

  const isOwner = item.owner_id === user.id;

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <CarDetailView item={item} isOwner={isOwner} />
    </main>
  );
}
