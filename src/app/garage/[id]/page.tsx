import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCollectionItem } from '@/lib/api';
import CarDetailView from '@/components/CarDetailView';

export default async function CarDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const item = await getCollectionItem(supabase, params.id);
  if (!item) notFound();

  const isOwner = item.owner_id === user.id;

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <CarDetailView item={item} isOwner={isOwner} />
    </main>
  );
}
