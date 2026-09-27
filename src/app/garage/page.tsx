import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listCollectionItems } from '@/lib/api';
import GarageView from '@/components/GarageView';

export const metadata: Metadata = {
  title: 'My Garage',
};

export default async function GaragePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const items = await listCollectionItems(supabase, user.id);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24 }}>My Garage</h1>
      <GarageView items={items} />
    </main>
  );
}
