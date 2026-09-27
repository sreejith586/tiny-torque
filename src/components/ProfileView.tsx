'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { patchProfile, signOut } from '@/domain/identity';
import type { AccountType, ProfileRow } from '@/types/database';
import ThemeSwitcher from './ThemeSwitcher';

export default function ProfileView({ profile }: { profile: ProfileRow }) {
  const supabase = createClient();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [accountType, setAccountType] = useState<AccountType>(profile.account_type);
  const [storeName, setStoreName] = useState(profile.store_name ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await patchProfile(supabase, profile.id, {
        displayName: displayName.trim(),
        accountType,
        storeName: accountType === 'shop' ? storeName.trim() : null,
        location: location.trim() || null,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut(supabase);
      router.push('/login');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        {!editing ? (
          <>
            <div className="toggle-row">
              <span className="muted">Display name</span>
              <span>{profile.display_name}</span>
            </div>
            <div className="toggle-row">
              <span className="muted">Account type</span>
              <span>{profile.account_type === 'shop' ? 'Shop / store' : 'Collector'}</span>
            </div>
            {profile.store_name && (
              <div className="toggle-row">
                <span className="muted">Store name</span>
                <span>{profile.store_name}</span>
              </div>
            )}
            {profile.location && (
              <div className="toggle-row">
                <span className="muted">Location</span>
                <span>{profile.location}</span>
              </div>
            )}
            {profile.mobile && (
              <div className="toggle-row">
                <span className="muted">Mobile</span>
                <span>{profile.mobile}</span>
              </div>
            )}
            <div className="toggle-row">
              <span className="muted">Plan</span>
              <span>{profile.plan === 'pro' ? 'Pro' : 'Free'}</span>
            </div>
            <button className="btn-secondary" style={{ marginTop: 14 }} onClick={() => setEditing(true)}>
              Edit profile
            </button>
          </>
        ) : (
          <>
            <label htmlFor="displayName">Display name</label>
            <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

            <label htmlFor="accountType">Account type</label>
            <select id="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
              <option value="individual">Collector (personal use)</option>
              <option value="shop">Shop / store</option>
            </select>

            {accountType === 'shop' && (
              <>
                <label htmlFor="storeName">Store name</label>
                <input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              </>
            )}

            <label htmlFor="location">Location</label>
            <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />

            {error && <p className="field-error">{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Appearance</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Theme choice is saved on this device only.
        </p>
        <ThemeSwitcher />
      </div>

      <button className="btn-danger" onClick={handleSignOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
