import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/domain/identity';
import AppHeaderClient from './AppHeaderClient';

// Persistent app-shell header (garage-log-147.html, D-044) — missing from every sprint until now.
// Server Component so it can read the session without forcing AppHeaderClient to do its own fetch;
// AppHeaderClient handles the per-route show/hide (same HIDDEN_ON as BottomNav) and the markup.
export default async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <AppHeaderClient signedIn={false} displayName={null} photoMediaId={null} />;

  const profile = await getProfile(supabase, user.id);
  return (
    <AppHeaderClient
      signedIn
      displayName={profile?.display_name ?? null}
      photoMediaId={profile?.photo_url ?? null}
    />
  );
}
