import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/domain/identity';

export const metadata: Metadata = {
  title: 'Admin',
};

// Redundant with src/proxy.ts's role check (D-023 defense in depth) — RLS on admin-only
// tables/RPCs is the real backstop either way (identity_v2's is_admin() policies).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await getProfile(supabase, user.id);
  if (!profile || profile.role !== 'admin') redirect('/garage');

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24 }}>Admin</h1>
      {children}
    </main>
  );
}
