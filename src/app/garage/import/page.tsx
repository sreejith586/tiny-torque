import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import ImportCars from '@/components/ImportCars';

export const metadata: Metadata = { title: 'Import cars' };

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const enabled = await isFlagEnabled(supabase, 'csv_import', { userId: user.id });

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24 }}>Import cars</h1>
      {enabled ? (
        <ImportCars userId={user.id} />
      ) : (
        <div className="panel" style={{ marginTop: 12 }}>
          <p className="muted">
            Bulk CSV/spreadsheet import isn’t switched on for your account yet.
          </p>
          <Link
            href="/garage/add"
            className="btn-secondary"
            style={{ marginTop: 12, display: 'inline-flex' }}
          >
            Add a car manually
          </Link>
        </div>
      )}
    </main>
  );
}
