import Link from 'next/link';
import type { QuestBoard, QuestStatus } from '@/domain/quests';

// /world "Today's quests" (MV-W04-05, F-26, D-090 proposed). Composed from the prototype's pieces
// only (D-027 rule 12 / D-086): `panel`, `section-title`, `level-pill`, `status-pill`, `muted`,
// and the F-13 `xp-bar-track` / `xp-bar-fill` progress bar (D-045 fill transition). Server-rendered;
// the page decides whether to show it (`world_earn` flag) and hands it the caller's board.

function QuestRow({ q, last }: { q: QuestStatus; last: boolean }) {
  return (
    <div
      style={{
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <span style={{ fontWeight: 600 }}>{q.title}</span>
        <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {q.completed ? (
            <span className="status-pill status-completed">Done</span>
          ) : (
            `${q.progress}/${q.threshold}`
          )}
          {` · +${q.rewardCredits} token${q.rewardCredits === 1 ? '' : 's'}`}
        </span>
      </div>
      <div
        className="xp-bar-track"
        role="progressbar"
        aria-label={q.title}
        aria-valuemin={0}
        aria-valuemax={q.threshold}
        aria-valuenow={q.progress}
        style={{ marginTop: 6 }}
      >
        <div className="xp-bar-fill" style={{ width: `${q.percent}%` }} />
      </div>
    </div>
  );
}

function endsOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function WorldQuestsPanel({ board }: { board: QuestBoard }) {
  if (board.daily.length === 0 && board.weekly.length === 0) {
    return (
      <div className="empty-state">
        <p>No quests on offer right now. Check back tomorrow.</p>
      </div>
    );
  }
  return (
    <div className="panel">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
      >
        <span className="muted" style={{ fontSize: 12 }}>
          Daily · resets at midnight UTC
        </span>
        {board.streak > 0 && <span className="level-pill">{board.streak}-day streak</span>}
      </div>
      {board.daily.map((q, i) => (
        <QuestRow key={q.key} q={q} last={i === board.daily.length - 1} />
      ))}

      {board.weekly.length > 0 && (
        <>
          <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            This week · resets Monday
          </div>
          {board.weekly.map((q, i) => (
            <QuestRow key={q.key} q={q} last={i === board.weekly.length - 1} />
          ))}
        </>
      )}

      {board.season && (
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          <Link href="/world/season">
            {board.season.name} · ends {endsOn(board.season.endsAt)} · {board.season.points} season
            point{board.season.points === 1 ? '' : 's'}
          </Link>
        </p>
      )}
    </div>
  );
}
