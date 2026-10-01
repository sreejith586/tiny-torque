import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listTrashItems } from '@/domain/garage';
import TrashView from '@/components/TrashView';

export const metadata: Metadata = { title: 'Trash' };

export default async function TrashPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const items = await listTrashItems(supabase, user.id);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24 }}>Trash</h1>
      <TrashView items={items} />
    </main>
  );
}
