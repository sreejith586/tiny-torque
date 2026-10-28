import Link from 'next/link';
import type { DailyQuestStatus } from '@/domain/gamification';
import { CheckIcon, BoltIcon } from './icons';

// MV-S8-07 (F-13 stretch): today's rotating quest. Same level-card surface as the XP bar; the
// quest and its done-state come from the event log (rules.questStatus), nothing stored.
export default function DailyQuestCard({ quest }: { quest: DailyQuestStatus }) {
  return (
    <div className="level-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="badge-icon" style={{ width: 40, height: 40, flexShrink: 0 }} aria-hidden>
        {quest.done ? <CheckIcon size={20} /> : <BoltIcon size={20} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="muted"
          style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
        >
          Today&apos;s quest · +{quest.xp} XP
        </div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{quest.title}</div>
      </div>
      {quest.done ? (
        <span className="level-pill">Done</span>
      ) : (
        <Link
          href={quest.href}
          className="btn-secondary"
          style={{ width: 'auto', padding: '8px 12px', fontSize: 12, flexShrink: 0 }}
        >
          Go
        </Link>
      )}
    </div>
  );
}
