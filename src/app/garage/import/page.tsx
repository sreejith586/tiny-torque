import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import ImportCars from '@/components/ImportCars';
import { FIXTURE_PROFILE } from '@/lib/visual-fixtures';
import { isHarnessRequest } from '@/lib/visual-harness.server';

export const metadata: Metadata = { title: 'Import cars' };

async function load(searchParams: Record<string, string | string[] | undefined>) {
  // D-056 fixture harness (non-production only, MV-S9-05): the import flow's first step, no session.
  if (await isHarnessRequest(searchParams)) return { userId: FIXTURE_PROFILE.id, enabled: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const enabled = await isFlagEnabled(supabase, 'csv_import', { userId: user.id });
  return { userId: user.id, enabled };
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, enabled } = await load(await searchParams);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 style={{ fontSize: 24 }}>Import cars</h1>
      {enabled ? (
        <ImportCars userId={userId} />
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
