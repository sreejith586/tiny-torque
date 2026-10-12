'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { patchProfile, signOut } from '@/domain/identity';
import { uploadProfileMedia } from '@/domain/media';
import { compressImage } from '@/lib/image';
import { initials } from '@/lib/initials';
import { deleteAccountAction } from '@/app/profile/actions';
import type { AccountType, ProfileRow } from '@/types/database';
import { CameraIcon } from './icons';
import MediaImage from './MediaImage';
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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoMediaId, setPhotoMediaId] = useState(profile.photo_url);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handlePhotoChange(file: File) {
    setPhotoError(null);
    setUploadingPhoto(true);
    const localPreview = URL.createObjectURL(file);
    setPhotoPreview(localPreview);
    try {
      const blob = await compressImage(file);
      const media = await uploadProfileMedia(supabase, profile.id, blob, { bytes: blob.size });
      await patchProfile(supabase, profile.id, { photoMediaId: media.id });
      setPhotoMediaId(media.id);
      router.refresh();
    } catch {
      setPhotoError('Could not update your photo. Try again.');
    } finally {
      setUploadingPhoto(false);
      URL.revokeObjectURL(localPreview);
      setPhotoPreview(null);
    }
  }

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

  async function handleDelete() {
    if (
      !window.confirm(
        'Delete your account? This removes your profile from public view and erases your personal details. This cannot be undone.'
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteAccountAction(); // anonymises + soft-deletes, signs out, redirects to /login
    } catch {
      setError('Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <label className="profile-avatar-btn" aria-label="Change your profile photo">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : photoMediaId ? (
            <MediaImage
              mediaId={photoMediaId}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="profile-avatar-initial">
              {initials(
                profile.account_type === 'shop' ? profile.store_name : profile.display_name
              )}
            </span>
          )}
          <span className="profile-avatar-camera">
            <CameraIcon size={12} />
          </span>
          <input
            type="file"
            accept="image/*"
            className="profile-avatar-input"
            disabled={uploadingPhoto}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handlePhotoChange(file);
            }}
          />
        </label>
        {photoError && (
          <p className="field-error" style={{ textAlign: 'center', marginBottom: 10 }}>
            {photoError}
          </p>
        )}

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
            <button
              className="btn-secondary"
              style={{ marginTop: 14 }}
              onClick={() => setEditing(true)}
            >
              Edit profile
            </button>
          </>
        ) : (
          <>
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
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
                />
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

      <Link
        href="/profile/wishlist"
        className="btn-secondary"
        style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}
      >
        My wishlist
      </Link>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Appearance</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Theme choice is saved on this device only.
        </p>
        <ThemeSwitcher />
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Account</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Download a copy of your collection, or delete your account.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <a className="btn-secondary" href="/api/export">
            Export my data
          </a>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
        {error && !editing && (
          <p className="field-error" style={{ marginTop: 10 }}>
            {error}
          </p>
        )}
      </div>

      <button className="btn-danger" onClick={handleSignOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
