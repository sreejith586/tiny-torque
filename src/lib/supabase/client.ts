'use client';

// Browser-side Supabase client — used inside client components (forms, photo
// uploads, sign-in). One of the two places allowed to import @supabase/* (D-007).
//
// Client components are also rendered once on the server during `next build`
// (static prerender). No Supabase call happens during that render, so when the
// env is missing there we hand back an inert placeholder instead of crashing
// the build; in the browser a missing env is a real misconfiguration and throws.
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (typeof window === 'undefined') {
    return createBrowserClient<Database>(url || 'https://placeholder.supabase.co', key || 'placeholder');
  }
  if (!url || !key) {
    throw new Error('Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Vercel → Environment Variables, or the Supabase↔Vercel integration).');
  }
  browserClient ??= createBrowserClient<Database>(url, key);
  return browserClient;
}
