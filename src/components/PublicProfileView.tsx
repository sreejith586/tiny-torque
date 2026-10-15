import type { PublicProfileRow } from '@/types/database';
import type { GarageItem } from '@/domain/garage';
import CarCard from './CarCard';
import ReportPrompt from './ReportPrompt';
import BlockUserButton from './BlockUserButton';

// F-14 v1: read-only, composed from existing prototype pieces only (panel/toggle-row,
// GarageView's CarCard grid) — no avatar/banner/follow/tabs, those need media (S2) and
// follows-count decisions that haven't landed yet. Rating (MV-S6-03) and report/block
// (MV-S6-05) have landed.
export default function PublicProfileView({
  profile,
  items,
  viewerId,
}: {
  profile: PublicProfileRow;
  items: GarageItem[];
  viewerId?: string;
}) {
  const isOwnProfile = !!viewerId && viewerId === profile.id;
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const location = [profile.city, profile.country_code].filter(Boolean).join(', ');

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22 }}>{profile.display_name}</h1>
          {profile.account_type === 'shop' && (
            <span
              className="muted"
              style={{
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '2px 10px',
              }}
            >
              Shop
            </span>
          )}
        </div>
        <p className="muted">@{profile.handle}</p>

        <div className="toggle-row">
          <span className="muted">
            {profile.account_type === 'shop' ? 'Store name' : 'Location'}
          </span>
          <span>
            {profile.account_type === 'shop' ? (profile.store_name ?? '—') : location || '—'}
          </span>
        </div>
        {profile.account_type === 'shop' && location && (
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
          <span>
            {profile.rating_count
              ? `★ ${profile.rating_avg} (${profile.rating_count} review${profile.rating_count === 1 ? '' : 's'})`
              : 'No ratings yet'}
          </span>
        </div>
      </div>

      {viewerId && !isOwnProfile && profile.id && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <ReportPrompt
            targetType="user"
            targetId={profile.id}
            targetName={profile.display_name}
            label="Report user"
          />
          <BlockUserButton
            viewerId={viewerId}
            targetId={profile.id}
            targetName={profile.display_name ?? 'this user'}
          />
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Public collection</h2>
      {items.length === 0 ? (
        <div className="empty-state">
          <p>Nothing public here yet.</p>
        </div>
      ) : (
        <div className="garage-grid">
          {items.map((item) => (
            <CarCard key={item.id} item={item} view="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
