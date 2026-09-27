'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveProfile } from '@/lib/api';
import type { AccountType } from '@/types/database';

// Collects the fields completeOnboarding() used to gather in the
// prototype, then upserts them into `profiles` (schema.sql). Runs after
// a successful phone-OTP verification (see (auth)/login).
export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userMobile, setUserMobile] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [storeName, setStoreName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login');
        return;
      }
      setUserId(data.user.id);
      setUserMobile(data.user.phone ?? null);
    });
  }, [supabase, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) return;
    if (!displayName.trim()) {
      setError('Tell us what to call you.');
      return;
    }
    if (accountType === 'shop' && !storeName.trim()) {
      setError('Enter your store name.');
      return;
    }

    setLoading(true);
    try {
      await saveProfile(supabase, userId, {
        displayName: displayName.trim(),
        accountType,
        storeName: accountType === 'shop' ? storeName.trim() : null,
        location: location.trim() || null,
        mobile: userMobile,
      });
      router.push('/garage');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: '48px 20px', flex: 1 }}>
      <h1 style={{ fontSize: 26 }}>Set up your profile</h1>
      <p className="muted">Just a couple of details to get you into your garage.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="displayName">Display name</label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Varun"
          autoFocus
        />

        <label htmlFor="accountType">Account type</label>
        <select
          id="accountType"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountType)}
        >
          <option value="individual">Collector (personal use)</option>
          <option value="shop">Shop / store</option>
        </select>

        {accountType === 'shop' && (
          <>
            <label htmlFor="storeName">Store name</label>
            <input
              id="storeName"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. Speed Shop Diecast"
            />
          </>
        )}

        <label htmlFor="location">Location (optional)</label>
        <input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Bengaluru"
        />

        {error && <p className="field-error">{error}</p>}

        <button className="btn-primary" style={{ marginTop: 20 }} disabled={loading || !userId}>
          {loading ? 'Saving…' : 'Enter my garage'}
        </button>
      </form>
    </main>
  );
}
