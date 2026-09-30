'use server';

// F-14 (MV-S1-08): delete-account stub. Anonymises PII + soft-deletes the caller's profile
// (domain/identity, which emits user.deleted), signs them out, and sends them to /login.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { deleteAccount, signOut } from '@/domain/identity';

export async function deleteAccountAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await deleteAccount(supabase, user.id);
  await signOut(supabase);
  redirect('/login');
}
