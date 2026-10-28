'use server';

// F-14 account actions. deleteAccountAction: the full anonymise + cascade (delete_account() RPC via
// domain/identity, which emits user.deleted), then sign out and send them to /login.
// dismissTutorialAction (MV-S8-06): stamps tutorial_dismissed_at so the first-run tour never shows
// again on any device.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { deleteAccount, patchProfile, signOut } from '@/domain/identity';

export async function deleteAccountAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await deleteAccount(supabase);
  await signOut(supabase);
  redirect('/login?deleted=1');
}

export async function dismissTutorialAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await patchProfile(supabase, user.id, { tutorialDismissed: true });
}
