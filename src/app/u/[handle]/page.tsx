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
  const profile = await getPublicProfile(supabase, handle);
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
    // A metadata-generation error takes down the whole route in Next.js, not just the <title> —
    // fail soft here and let the page component's own error handling be the real signal.
    return { title: 'Collector not found' };
  }
  if (!profile) return { title: 'Collector not found' };

  const title = `${profile.display_name} (@${profile.handle})`;
  const description = `${profile.display_name}'s diecast collection on Tiny Torque.`;
  // openGraph isn't covered by the root layout's title template, so it gets the full name here.
  return { title, description, openGraph: { title: `${title} · Tiny Torque`, description } };
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const result = await loadProfile(handle, sp);
  if (!result) notFound();

  let viewerId: string | undefined;
  if (!isVisualHarness(sp)) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerId = user?.id;
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <PublicProfileView profile={result.profile} items={result.items} viewerId={viewerId} />
    </main>
  );
}
