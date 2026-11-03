'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PublicProfileRow } from '@/types/database';
import type { GarageItem } from '@/domain/garage';
import type { Listing } from '@/domain/marketplace';
import { initials } from '@/lib/initials';
import CarCard from './CarCard';
import ListingCard from './ListingCard';
import MediaImage from './MediaImage';
import ReportPrompt from './ReportPrompt';
import BlockUserButton from './BlockUserButton';
import FollowButton from './FollowButton';
import ShareProfileButton from './ShareProfileButton';
import StarRating from './StarRating';
import { TrophyIcon } from './icons';
import type { ProfileReview } from './ProfileView';
import marketStyles from './Market.module.css';

type Tab = 'collection' | 'listings' | 'reviews';

// F-14 v2 (MV-S8-04): banner, avatar, name/handle/shop badge, country/city, level/tier, rating,
// member since, share sheet, and the three tabs (public collection · listings · reviews) — composed
// from the existing panel / tab-chip / CarCard / ListingCard / review-card pieces (D-027). Reads
// only `public_profiles` fields (rule 15). Follow button + follower count and the Pro flair are
// the MV-S8-07 stretch.
export default function PublicProfileView({
  profile,
  items,
  listings,
  reviews,
  tier,
  viewerId,
  shareUrl,
  followerCount = 0,
  viewerFollows = false,
}: {
  profile: PublicProfileRow;
  items: GarageItem[];
  listings: Listing[];
  reviews: ProfileReview[];
  tier: string;
  viewerId?: string;
  shareUrl: string;
  followerCount?: number;
  viewerFollows?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('collection');
  const [followers, setFollowers] = useState(followerCount);
  const isOwnProfile = !!viewerId && viewerId === profile.id;
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const location = [profile.city, profile.country_code].filter(Boolean).join(', ');
  const name = profile.display_name ?? 'Collector';

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'collection', label: 'Collection', count: items.length },
    { key: 'listings', label: 'Listings', count: listings.length },
    { key: 'reviews', label: 'Reviews', count: reviews.length },
  ];

  return (
    <div>
      <div className="profile-banner">
        {profile.banner_media_id && (
          <MediaImage
            mediaId={profile.banner_media_id}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>

      <div className="panel" style={{ marginBottom: 16, paddingTop: 0 }}>
        <div
          className={`profile-avatar-btn profile-hero-avatar ${profile.is_pro ? 'pro' : ''}`}
          aria-hidden
        >
          {profile.avatar_media_id ? (
            <MediaImage
              mediaId={profile.avatar_media_id}
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
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 22 }}>{name}</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            @{profile.handle} · {followers.toLocaleString('en-US')}{' '}
            {followers === 1 ? 'follower' : 'followers'}
          </p>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <span className="level-pill">
              <TrophyIcon size={12} />
              Level {Math.max(1, profile.level ?? 1)} · {tier}
            </span>
            {profile.account_type === 'shop' && <span className="level-pill">Shop</span>}
            {profile.is_pro && <span className="level-pill pro-pill">Pro</span>}
          </div>
          {profile.bio && (
            <p style={{ fontSize: 14, lineHeight: 1.5, marginTop: 10 }}>{profile.bio}</p>
          )}
        </div>

        {profile.account_type === 'shop' && profile.store_name && (
          <div className="toggle-row">
            <span className="muted">Store name</span>
            <span>{profile.store_name}</span>
          </div>
        )}
        {location && (
          <div className="toggle-row">
            <span className="muted">Location</span>
            <span>{location}</span>
          </div>
        )}
        {memberSince && (
          <div className="toggle-row">
            <span className="muted">Member since</span>
            <span>{memberSince}</span>
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

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <ShareProfileButton url={shareUrl} title={`${name} on Tiny Torque`} />
          {isOwnProfile && (
            <Link
              href="/profile"
              className="btn-secondary"
              style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}
            >
              Edit profile
            </Link>
          )}
          {viewerId && !isOwnProfile && profile.id && (
            <>
              <FollowButton
                viewerId={viewerId}
                targetId={profile.id}
                initialFollowing={viewerFollows}
                onCountChange={(delta) => setFollowers((n) => Math.max(0, n + delta))}
              />
              <ReportPrompt
                targetType="user"
                targetId={profile.id}
                targetName={profile.display_name}
                label="Report user"
              />
              <BlockUserButton viewerId={viewerId} targetId={profile.id} targetName={name} />
            </>
          )}
        </div>
      </div>

      <div className="tab-row" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab-chip ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} {t.count > 0 ? `(${t.count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'collection' &&
        (items.length === 0 ? (
          <div className="empty-state">
            <p>Nothing public here yet.</p>
            {isOwnProfile && (
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                Toggle &quot;Public&quot; on a car in your garage to show it here.
              </p>
            )}
          </div>
        ) : (
          <div className="garage-grid">
            {items.map((item) => (
              <CarCard key={item.id} item={item} view="grid" />
            ))}
          </div>
        ))}

      {tab === 'listings' &&
        (listings.length === 0 ? (
          <div className="empty-state">
            <p>No active listings.</p>
            {isOwnProfile && (
              <Link
                href="/garage"
                className="btn-secondary"
                style={{ marginTop: 12, display: 'inline-flex', width: 'auto' }}
              >
                List a car from your garage
              </Link>
            )}
          </div>
        ) : (
          <div className={marketStyles.grid}>
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ))}

      {tab === 'reviews' &&
        (reviews.length === 0 ? (
          <div className="empty-state">
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
        ))}
    </div>
  );
}
