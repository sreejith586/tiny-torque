// Admin console service (MV-S6-07, F-16). Components/routes import from here, never from repo.
import type { Client } from '@/lib/supabase/types';
import * as repo from './repo';

export async function searchUsers(supabase: Client, query: string, limit = 20) {
  return repo.searchUsers(supabase, query.trim(), limit);
}

export const setSuspension = repo.setSuspension;
