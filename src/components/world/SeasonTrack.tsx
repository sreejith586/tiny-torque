import Link from 'next/link';
import type { SeasonTrackView } from '@/domain/quests';

// /world/season (MV-W05-03, F-26, D-093 proposed). Composed from the prototype's pieces only
// (D-027 rule 12 / D-086): panel, section-title, level-pill, status-pill, muted, the F-13
// xp-bar-track / xp-bar-fill (D-045 fill transition). Server-rendered; the page gates it on
// `world` + `world_earn` and hands it the caller's view. Milestones are paid by the database
// (season_track_award through earn_tokens) — this only shows where the caller stands.

function endsOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function SeasonTrack({
  view,
  trophyName,
}: {
  view: SeasonTrackView;
  trophyName: string | null;
}) {
  const { season, milestones, next, percent, daysLeft } = view;
  const finished = next === null && milestones.length > 0;
  return (
    <div>
      <div className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <h2 style={{ fontSize: 18 }}>{season.name}</h2>
          <span className="level-pill">
            {season.points} season point{season.points === 1 ? '' : 's'}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {season.theme ? `${season.theme} · ` : ''}
          {endsOn(season.startsAt)} – {endsOn(season.endsAt)} ·{' '}
          {daysLeft === 0 ? 'ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
        </p>
        <div
          className="xp-bar-track"
          role="progressbar"
          aria-label="Season track"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          style={{ marginTop: 10 }}
        >
          <div className="xp-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {finished
            ? 'Track finished — every milestone is yours.'
            : next
              ? `${next.remaining} point${next.remaining === 1 ? '' : 's'} to "${next.label}" (+${next.rewardCredits} tokens)`
              : 'No milestones in this season.'}
        </p>
      </div>

      <div className="section-title">Free track</div>
      {milestones.length === 0 ? (
        <div className="empty-state">
          <p>This season has no milestones yet.</p>
        </div>
      ) : (
        <div className="panel">
          {milestones.map((m, i) => (
            <div
              key={m.index}
              className="toggle-row"
              style={{ borderBottom: i === milestones.length - 1 ? 'none' : undefined }}
            >
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>
                  {m.index}. {m.label}
                </span>
                <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                  {m.points} points · +{m.rewardCredits} token{m.rewardCredits === 1 ? '' : 's'}
                  {m.rewardItemSku ? ` · ${trophyName ?? 'season trophy'}` : ''}
                </span>
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>
                {m.paid ? (
                  <span className="status-pill status-completed">Paid</span>
                ) : m.reached ? (
                  <span className="status-pill">Reached</span>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>
                    {m.remaining} to go
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Season points come from completed <Link href="/world">quests</Link>. Milestone tokens are
        earned tokens: they count towards the daily ceiling, expire after 180 days and are spent
        first. A milestone marked Reached is paid the next time you earn with headroom.
      </p>
    </div>
  );
}
