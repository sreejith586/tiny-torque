'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { patchProfile } from '@/domain/identity';
import { uploadProfileMedia } from '@/domain/media';
import { isProActive } from '@/domain/entitlements';
import { compressImage } from '@/lib/image';
import { initials } from '@/lib/initials';
import type { AccountType, ProfileRow } from '@/types/database';
import { CameraIcon, GearIcon, ShareIcon, TrophyIcon } from './icons';
import MediaImage from './MediaImage';
import StarRating from './StarRating';

export type ProfileReview = {
  id: string;
  rating: number;
  comment: string | null;
  buyerName: string;
};

// Own profile (F-14 v2, MV-S8-03/04): banner hero + avatar, the edit form (now with bio), links
// out to the public page / settings / wishlist, and the buyer-review list. Stats, level and
// badges render in the sibling <ProfileStats>; everything that used to be "settings" on this
// screen (theme, export, delete, sign-out) moved to /settings (MV-S8-05).
export default function ProfileView({
  profile,
  tier,
  reviews = [],
}: {
  profile: ProfileRow;
  tier: string;
  reviews?: ProfileReview[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [accountType, setAccountType] = useState<AccountType>(profile.account_type);
  const [storeName, setStoreName] = useState(profile.store_name ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photoMediaId, setPhotoMediaId] = useState(profile.photo_url);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [bannerMediaId, setBannerMediaId] = useState(profile.banner_media_id);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'photo' | 'banner' | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handleImageChange(kind: 'avatar' | 'banner', file: File) {
    setPhotoError(null);
    setUploading(kind === 'avatar' ? 'photo' : 'banner');
    const localPreview = URL.createObjectURL(file);
    if (kind === 'avatar') setPhotoPreview(localPreview);
    else setBannerPreview(localPreview);
    try {
      const blob = await compressImage(file);
      const media = await uploadProfileMedia(
        supabase,
        profile.id,
        blob,
        { bytes: blob.size },
        kind
      );
      if (kind === 'avatar') {
        await patchProfile(supabase, profile.id, { photoMediaId: media.id });
        setPhotoMediaId(media.id);
      } else {
        await patchProfile(supabase, profile.id, { bannerMediaId: media.id });
        setBannerMediaId(media.id);
      }
      router.refresh();
    } catch {
      setPhotoError(
        kind === 'avatar'
          ? 'Could not update your photo. Try again.'
          : 'Could not update your banner. Try again.'
      );
    } finally {
      setUploading(null);
      URL.revokeObjectURL(localPreview);
      if (kind === 'avatar') setPhotoPreview(null);
      else setBannerPreview(null);
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
        bio: bio.trim() || null,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  const publicUrl = `/u/${profile.handle}`;
  // Pro is derived (pro_until > now or plan='pro'), same rule as domain/entitlements.isProActive.
  const isPro = isProActive(profile);

  return (
    <div>
      <div className="profile-banner">
        {bannerPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerPreview}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : bannerMediaId ? (
          <MediaImage
            mediaId={bannerMediaId}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
        <label className="icon-btn profile-banner-edit" aria-label="Change your banner photo">
          <CameraIcon size={16} />
          <input
            type="file"
            accept="image/*"
            className="profile-banner-input"
            disabled={uploading !== null}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleImageChange('banner', file);
            }}
          />
        </label>
      </div>

      <div className="panel" style={{ marginBottom: 16, paddingTop: 0 }}>
        <label
          className={`profile-avatar-btn profile-hero-avatar ${isPro ? 'pro' : ''}`}
          aria-label="Change your profile photo"
        >
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
            disabled={uploading !== null}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleImageChange('avatar', file);
            }}
          />
        </label>
        {photoError && (
          <p className="field-error" style={{ textAlign: 'center', marginBottom: 10 }}>
            {photoError}
          </p>
        )}

        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>
            {profile.display_name}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            @{profile.handle}
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 6 }}>
            <span className="level-pill">
              <TrophyIcon size={12} />
              {tier}
            </span>
            {profile.account_type === 'shop' && <span className="level-pill">Shop</span>}
            {isPro && <span className="level-pill pro-pill">Pro</span>}
          </div>
        </div>

        {!editing ? (
          <>
            {profile.bio && (
              <p style={{ fontSize: 14, lineHeight: 1.5, textAlign: 'center', marginBottom: 8 }}>
                {profile.bio}
              </p>
            )}
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
            {(profile.city || profile.location) && (
              <div className="toggle-row">
                <span className="muted">Location</span>
                <span>
                  {[profile.city ?? profile.location, profile.country_code]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            {profile.mobile && (
              <div className="toggle-row">
                <span className="muted">Mobile</span>
                <span>{profile.mobile}</span>
              </div>
            )}
            <div className="toggle-row">
              <span className="muted">Rating</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {profile.rating_count ? (
                  <>
                    <StarRating avg={profile.rating_avg} />
                    {profile.rating_avg} ({profile.rating_count} review
                    {profile.rating_count === 1 ? '' : 's'})
                  </>
                ) : (
                  'No ratings yet'
                )}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                className="btn-secondary"
                style={{ fontSize: 13, padding: '12px 8px' }}
                onClick={() => setEditing(true)}
              >
                Edit profile
              </button>
              <Link
                href={publicUrl}
                className="btn-secondary"
                style={{ fontSize: 13, padding: '12px 8px', whiteSpace: 'nowrap' }}
              >
                <ShareIcon size={14} />
                Public page
              </Link>
            </div>
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

            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              rows={3}
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What do you collect? (280 characters)"
            />
            <p className="muted" style={{ fontSize: 11, textAlign: 'right' }}>
              {bio.length}/280
            </p>

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

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Link
          href="/profile/wishlist"
          className="btn-secondary"
          style={{ fontSize: 13, padding: '12px 8px' }}
        >
          My wishlist
        </Link>
        <Link
          href="/settings"
          className="btn-secondary"
          style={{ fontSize: 13, padding: '12px 8px' }}
        >
          <GearIcon size={14} />
          Settings
        </Link>
      </div>

      <div className="section-title">Buyer reviews — trust score</div>
      {reviews.length === 0 ? (
        <div className="empty-state" style={{ padding: 20 }}>
          <p>No reviews yet.</p>
        </div>
      ) : (
        reviews.map((r) => (
          <div className="review-card" key={r.id}>
            <div className="top">
              <span className="rc-name">{r.buyerName}</span>
              <StarRating avg={r.rating} />
            </div>
            {r.comment && <div className="rc-text">{r.comment}</div>}
          </div>
        ))
      )}
    </div>
  );
}
