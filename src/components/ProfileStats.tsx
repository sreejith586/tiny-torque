import type { GarageStats } from '@/domain/garage';
import type { Badge, LevelProgress } from '@/domain/gamification';
import { AddIcon, BoltIcon, GarageIcon, MarketIcon, OffersIcon, TrophyIcon } from './icons';

// MV-S8-03 (F-13): the profile stats dashboard — totals, value, dupes, level bar, badge grid with
// progress, and Top Brands (the one chart the prototype has, D-027). Server-renderable; the only
// interactive bit (the unlock toast) is a sibling client component.

const BADGE_ICONS: Record<string, typeof TrophyIcon> = {
  add: AddIcon,
  garage: GarageIcon,
  bolt: BoltIcon,
  offers: OffersIcon,
  market: MarketIcon,
  trophy: TrophyIcon,
};

export function formatValue(n: number, currency?: string | null): string {
  const rounded = Math.round(n);
  const text = rounded.toLocaleString('en-US');
  return currency ? `${currency} ${text}` : text;
}

export function LevelCard({ level }: { level: LevelProgress }) {
  const toNext = level.nextMin != null ? level.nextMin - level.xp : 0;
  return (
    <div className="level-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700 }}>
            Level {level.level}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {level.xp.toLocaleString('en-US')} XP
            {level.nextMin != null
              ? ` · ${toNext.toLocaleString('en-US')} to level ${level.level + 1}`
              : ' · top tier reached'}
          </div>
        </div>
        <span className="level-pill">
          <TrophyIcon size={12} />
          {level.tier}
        </span>
      </div>
      <div className="xp-bar-track" aria-hidden>
        <div className="xp-bar-fill" style={{ width: `${level.percent}%` }} />
      </div>
    </div>
  );
}

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <div className="badge-grid">
      {badges.map((b) => {
        const Icon = BADGE_ICONS[b.icon] ?? TrophyIcon;
        const pct = b.target > 0 ? Math.round((b.progress / b.target) * 100) : 0;
        return (
          <div
            className={`badge-card ${b.unlocked ? '' : 'locked'}`}
            key={b.key}
            aria-label={`${b.name}: ${b.unlocked ? 'unlocked' : `${b.progress} of ${b.target}`}`}
          >
            <div className="badge-icon">
              <Icon size={24} />
            </div>
            <div className="badge-name">{b.name}</div>
            <div className="badge-desc">{b.description}</div>
            {b.unlocked ? (
              <span className="badge-progress-text">
                Unlocked
                {b.unlockedAt
                  ? ` · ${new Date(b.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : ''}
              </span>
            ) : (
              <>
                <div className="badge-progress-track" aria-hidden>
                  <div className="badge-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="badge-progress-text">
                  {b.progress.toLocaleString('en-US')} / {b.target.toLocaleString('en-US')}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TopBrands({ topBrands }: { topBrands: GarageStats['topBrands'] }) {
  if (topBrands.length === 0) return null;
  const max = topBrands[0]?.count ?? 1;
  return (
    <>
      <div className="section-title">Top brands in your garage</div>
      <div className="rank-card">
        {topBrands.map((b, i) => (
          <div className="brand-rank-row" key={b.brand}>
            <div className="brand-rank-num">#{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="brand-rank-name">{b.brand}</span>
                <span className="brand-rank-count">
                  {b.count} item{b.count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="brand-rank-bar-track">
                <div
                  className="brand-rank-bar-fill"
                  style={{ width: `${Math.round((b.count / max) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function ProfileStats({
  stats,
  level,
  badges,
  currency,
}: {
  stats: GarageStats;
  level: LevelProgress;
  badges: Badge[];
  currency?: string | null;
}) {
  return (
    <div>
      <div className="section-title">Your stats</div>
      <div className="stat-tiles">
        <div className="stat-tile">
          <div className="stat-tile-value">{stats.totalItems.toLocaleString('en-US')}</div>
          <div className="stat-tile-label">Cars</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{stats.totalQty.toLocaleString('en-US')}</div>
          <div className="stat-tile-label">Total qty</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{formatValue(stats.totalValue, currency)}</div>
          <div className="stat-tile-label">Value (paid)</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{stats.duplicates.toLocaleString('en-US')}</div>
          <div className="stat-tile-label">Duplicates</div>
        </div>
      </div>

      <LevelCard level={level} />

      <div className="section-title">Badges</div>
      <BadgeGrid badges={badges} />

      <TopBrands topBrands={stats.topBrands} />
    </div>
  );
}
