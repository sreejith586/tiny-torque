import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Tiny Torque — Track, Organize and Trade Your Diecast Collection',
  description:
    'Tiny Torque helps diecast car collectors catalog their garage, avoid duplicate buys, and buy, sell or trade with other collectors.',
  openGraph: {
    title: 'Tiny Torque — Diecast Collection Tracker',
    description:
      'Catalog your diecast garage, avoid duplicate buys, and connect with other collectors.',
    type: 'website',
  },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/garage');
  }

  return (
    <main
      style={{ padding: '48px 20px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}
    >
      <div>
        <h1 style={{ fontSize: 32 }}>Tiny Torque</h1>
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.5 }}>
          The home for your diecast garage. Track every car you own, skip the accidental duplicate
          buys, and — coming soon — buy, sell and trade with other collectors.
        </p>
      </div>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18 }}>What you can do today</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', lineHeight: 1.6 }}>
          <li>Log in with just your phone number — no password to remember.</li>
          <li>Add cars with brand, model, series, scale, rarity, condition and up to 3 photos.</li>
          <li>Get a heads-up if you might already own a matching car.</li>
          <li>Search, filter and sort your own garage.</li>
          <li>Pick from 6 color themes to make Tiny Torque feel like yours.</li>
        </ul>
      </div>

      <Link href="/login" className="btn-primary" style={{ textAlign: 'center' }}>
        Get started
      </Link>
    </main>
  );
}
