'use client';

// Visitor garage view (MV-W03-03, F-21, D-087): the same scene the owner sees, read-only, with the
// social layer around it — visits/kudos counts, Kudos, Follow, Report, Block, a host-moderated
// guestbook, and the marketplace bridge ("For sale" under a displayed car → its listing, where the
// existing offer flow lives). Prototype pieces only: panel / status-pill / btn-* / field-error.
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { GarageItem } from '@/domain/garage';
import type { GuestbookEntry, VisitorGarage } from '@/domain/world';
import FollowButton from '@/components/FollowButton';
import ReportPrompt from '@/components/ReportPrompt';
import BlockUserButton from '@/components/BlockUserButton';
import { giveKudosAction, hideGuestbookAction, postGuestbookAction } from '@/app/world/actions';
import GarageScene from './GarageScene';
import styles from './World.module.css';

const BODY_MAX = 140;

export default function VisitorGarageView({
  garage,
  items,
  listingByItem,
  guestbook: initialGuestbook,
  viewerId,
  viewerHandle,
  viewerFollows,
  followerCount: initialFollowers,
}: {
  garage: VisitorGarage;
  items: GarageItem[];
  /** collection item id → active listing id (marketplace bridge). */
  listingByItem: Record<string, string>;
  guestbook: GuestbookEntry[];
  viewerId: string | null;
  viewerHandle: string | null;
  viewerFollows: boolean;
  followerCount: number;
}) {
  const isOwner = viewerId !== null && viewerId === garage.owner.id;
  const [kudos, setKudos] = useState(garage.garage.kudos_count);
  const [kudosGiven, setKudosGiven] = useState(false);
  const [followers, setFollowers] = useState(initialFollowers);
  const [entries, setEntries] = useState(initialGuestbook);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function giveKudos() {
    setError(null);
    startTransition(async () => {
      const r = await giveKudosAction(garage.owner.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (!kudosGiven) setKudos((k) => k + 1);
      setKudosGiven(true);
      setNotice('Kudos sent.');
    });
  }

  function post() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const r = await postGuestbookAction(garage.owner.id, body);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEntries((list) => [
        {
          id: r.data.id,
          body,
          createdAt: new Date().toISOString(),
          hidden: false,
          author: {
            id: viewerId ?? '',
            handle: viewerHandle ?? 'you',
            displayName: 'You',
          },
        },
        ...list,
      ]);
      setDraft('');
      setNotice('Added to the guestbook.');
    });
  }

  function toggleHidden(entry: GuestbookEntry) {
    setError(null);
    startTransition(async () => {
      const r = await hideGuestbookAction(entry.id, !entry.hidden);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, hidden: !e.hidden } : e)));
    });
  }

  return (
    <div>
      <GarageScene
        name={garage.garage.name}
        level={garage.level}
        score={garage.garage.score}
        capacity={garage.level.display_slots + garage.layout.slots.length}
        layout={garage.layout}
        items={items}
        featuredItemId={garage.garage.featured_item_id}
        themeSku={null}
        subtitle={
          <>
            <Link href={`/u/${garage.owner.handle}`}>@{garage.owner.handle}</Link> ·{' '}
            {garage.garage.visit_count} visit{garage.garage.visit_count === 1 ? '' : 's'} · {kudos}{' '}
            kudos · {followers} follower{followers === 1 ? '' : 's'}
          </>
        }
        slotFooter={(item) =>
          listingByItem[item.id] ? (
            <Link
              href={`/market/${listingByItem[item.id]}`}
              className="status-pill status-pending"
              style={{ marginTop: 6, textAlign: 'center' }}
            >
              For sale · make an offer
            </Link>
          ) : null
        }
      />

      {error && (
        <p className="field-error" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
          {notice}
        </p>
      )}

      {isOwner ? (
        <div className="panel" style={{ marginTop: 14, textAlign: 'center' }}>
          <p className="muted" style={{ fontSize: 13 }}>
            This is how visitors see your garage.
          </p>
          <Link href="/world/garage" className="btn-secondary" style={{ marginTop: 10 }}>
            Arrange garage
          </Link>
        </div>
      ) : viewerId ? (
        <div
          className="panel"
          style={{
            marginTop: 14,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className={kudosGiven ? 'btn-secondary' : 'btn-primary'}
            style={{ width: 'auto', padding: '8px 14px', fontSize: 12 }}
            disabled={pending || kudosGiven}
            onClick={giveKudos}
          >
            {kudosGiven ? 'Kudos given today' : 'Give kudos'}
          </button>
          <FollowButton
            viewerId={viewerId}
            targetId={garage.owner.id}
            initialFollowing={viewerFollows}
            onCountChange={(d) => setFollowers((n) => n + d)}
          />
          <span style={{ flex: 1 }} />
          <ReportPrompt
            targetType="garage"
            targetId={garage.owner.id}
            targetName={garage.garage.name}
            label="Report garage"
          />
          <BlockUserButton
            viewerId={viewerId}
            targetId={garage.owner.id}
            targetName={garage.owner.displayName}
          />
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 14, textAlign: 'center' }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Sign in to give kudos, follow or sign the guestbook.
          </p>
          <Link
            href={`/login?next=/world/g/${garage.owner.handle}`}
            className="btn-secondary"
            style={{ marginTop: 10 }}
          >
            Sign in
          </Link>
        </div>
      )}

      <div className="section-title">Guestbook</div>
      <div className="panel">
        {viewerId && !isOwner && (
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="guestbook-body">Leave a line</label>
            <textarea
              id="guestbook-body"
              rows={2}
              maxLength={BODY_MAX}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nice Skyline — that R34 is the one I'm after."
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {draft.length}/{BODY_MAX}
              </span>
              <button
                type="button"
                className="btn-primary"
                style={{ width: 'auto', padding: '8px 14px', fontSize: 12 }}
                disabled={pending || !draft.trim()}
                onClick={post}
              >
                Post
              </button>
            </div>
          </div>
        )}
        {entries.length === 0 ? (
          <div className="empty-state" style={{ padding: 14 }}>
            <p>No lines yet. Be the first to sign.</p>
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className={styles.shopRow}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, opacity: e.hidden ? 0.5 : 1 }}>
                  {e.body}
                  {e.hidden && (
                    <span className="status-pill status-declined" style={{ marginLeft: 8 }}>
                      Hidden
                    </span>
                  )}
                </div>
                <div className={styles.shopMeta}>
                  <Link href={`/u/${e.author.handle}`}>@{e.author.handle}</Link> ·{' '}
                  {new Date(e.createdAt).toLocaleDateString()}
                </div>
              </div>
              {isOwner && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
                  disabled={pending}
                  onClick={() => toggleHidden(e)}
                >
                  {e.hidden ? 'Unhide' : 'Hide'}
                </button>
              )}
              {!isOwner && viewerId && e.author.id !== viewerId && (
                <ReportPrompt
                  targetType="guestbook"
                  targetId={e.id}
                  targetName={e.body}
                  label="Report"
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
