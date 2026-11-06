import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isFlagEnabled } from '@/domain/flags';
import { acceptInvite, WorldError } from '@/domain/world';
import { getPublicProfileById } from '@/domain/identity';
import { WORLD_ERROR_COPY } from '@/components/world/copy';

export const metadata: Metadata = {
  title: 'Garage invite',
};

// /world/invite/{token} (MV-W03-04): the share-link landing. Guarded (proxy sends anon to /login
// with ?next= back here); accepting records the use and unlocks the garage, then we go there.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/world/invite/${token}`)}`);
  if (!(await isFlagEnabled(supabase, 'world', { userId: user.id }))) notFound();

  let message: string;
  try {
    const invite = await acceptInvite(supabase, token);
    const host = await getPublicProfileById(supabase, invite.garage_user_id);
    if (host?.handle) redirect(`/world/g/${host.handle}`);
    message = 'Invite accepted, but the garage could not be found.';
  } catch (e) {
    if (e instanceof WorldError) message = WORLD_ERROR_COPY[e.code];
    else throw e;
  }

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Garage invite</h1>
      <div className="panel" style={{ textAlign: 'center' }}>
        <p className="muted" style={{ fontSize: 13 }}>
          {message}
        </p>
        <Link href="/world" className="btn-secondary" style={{ marginTop: 14 }}>
          Back to Collectors World
        </Link>
      </div>
    </main>
  );
}
