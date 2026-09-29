import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPublicProfile } from '@/domain/identity';
import { listPublicCollectionItems } from '@/domain/garage';
import PublicProfileView from '@/components/PublicProfileView';
import { FIXTURE_PUBLIC_PROFILE, FIXTURE_ITEMS, isVisualHarness } from '@/lib/visual-fixtures';

async function loadProfile(
  handle: string,
  searchParams: Record<string, string | string[] | undefined>
) {
  if (isVisualHarness(searchParams)) {
    return { profile: FIXTURE_PUBLIC_PROFILE, items: FIXTURE_ITEMS.filter((i) => i.is_public) };
  }
  const supabase = await createClient();
  let profile;
  try {
    profile = await getPublicProfile(supabase, handle);
  } catch (err) {
    // TEMPORARY diagnostic (MV-S1-07): surface the real error instead of a bare 500,
    // to see what's actually failing for an anonymous SSR request. Remove once understood.
    return {
      diag: err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err),
    };
  }
  if (!profile) return null;
  const items = await listPublicCollectionItems(supabase, profile.id!);
  return { profile, items };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { handle } = await params;
  let profile;
  try {
    profile = isVisualHarness(await searchParams)
      ? FIXTURE_PUBLIC_PROFILE
      : await getPublicProfile(await createClient(), handle);
  } catch {
    return { title: 'Collector not found' };
  }
  if (!profile) return { title: 'Collector not found' };

  const title = `${profile.display_name} (@${profile.handle})`;
  const description = `${profile.display_name}'s diecast collection on Mini Vault.`;
  // openGraph isn't covered by the root layout's title template, so it gets the full name here.
  return { title, description, openGraph: { title: `${title} · Mini Vault`, description } };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const result = await loadProfile(handle, await searchParams);
  if (!result) notFound();
  if ('diag' in result) {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{result.diag}</pre>
      </main>
    );
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <PublicProfileView profile={result.profile} items={result.items} />
    </main>
  );
}
