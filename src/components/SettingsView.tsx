'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { patchProfile, signOut } from '@/domain/identity';
import { unblockUser, type BlockedUser } from '@/domain/trust';
import { submitFeedback, FEEDBACK_KINDS, type FeedbackKind } from '@/domain/gamification';
import { deleteAccountAction } from '@/app/profile/actions';
import type { AccountType, ProfileRow } from '@/types/database';
import ThemeSwitcher from './ThemeSwitcher';

// MV-S8-05 (F-14 Settings): switch account type, blocked users, theme, export, tokens history,
// legal links, feedback form, delete account, sign out — composed only from panel / toggle-row /
// native select / btn-* (D-027: a screen the prototype lacks). Everything here used to live on
// /profile; /profile now links here.
export default function SettingsView({
  profile,
  blocked,
}: {
  profile: ProfileRow;
  blocked: BlockedUser[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [accountType, setAccountType] = useState<AccountType>(profile.account_type);
  const [storeName, setStoreName] = useState(profile.store_name ?? '');
  const [savingType, setSavingType] = useState(false);
  const [typeMsg, setTypeMsg] = useState<string | null>(null);

  const [blockedList, setBlockedList] = useState(blocked);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const [fbKind, setFbKind] = useState<FeedbackKind>('idea');
  const [fbMessage, setFbMessage] = useState('');
  const [fbState, setFbState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [fbError, setFbError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeChanged =
    accountType !== profile.account_type ||
    (accountType === 'shop' && storeName.trim() !== (profile.store_name ?? ''));

  async function saveAccountType(e: FormEvent) {
    e.preventDefault();
    setSavingType(true);
    setTypeMsg(null);
    try {
      await patchProfile(supabase, profile.id, {
        accountType,
        storeName: accountType === 'shop' ? storeName.trim() : null,
      });
      setTypeMsg('Saved.');
      router.refresh();
    } catch (err) {
      setTypeMsg(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSavingType(false);
    }
  }

  async function handleUnblock(b: BlockedUser) {
    setUnblocking(b.blocked_id);
    try {
      await unblockUser(supabase, profile.id, b.blocked_id);
      setBlockedList((l) => l.filter((x) => x.blocked_id !== b.blocked_id));
    } catch {
      setError('Could not unblock this user.');
    } finally {
      setUnblocking(null);
    }
  }

  async function handleFeedback(e: FormEvent) {
    e.preventDefault();
    setFbState('sending');
    setFbError(null);
    try {
      await submitFeedback(supabase, profile.id, {
        kind: fbKind,
        message: fbMessage,
        page: typeof window !== 'undefined' ? window.location.pathname : null,
      });
      setFbState('sent');
      setFbMessage('');
    } catch (err) {
      setFbState('error');
      setFbError(err instanceof Error ? err.message : 'Could not send your feedback.');
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
        'Delete your account? Your profile is anonymised, your cars and listings are removed, open offers are withdrawn, and your token history is kept for accounting. This cannot be undone.'
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteAccountAction();
    } catch {
      setError('Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Profile</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Name, photo, banner, bio and location are edited on your profile.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Link href="/profile" className="btn-secondary">
            Edit profile
          </Link>
          <Link href={`/u/${profile.handle}`} className="btn-secondary">
            View public page
          </Link>
        </div>
      </div>

      <form className="panel" style={{ marginBottom: 16 }} onSubmit={saveAccountType}>
        <h2 style={{ fontSize: 16 }}>Account type</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Shops get a store name and a Shop badge on the Market.
        </p>
        <label htmlFor="settingsAccountType" style={{ marginTop: 10 }}>
          I am a
        </label>
        <select
          id="settingsAccountType"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountType)}
        >
          <option value="individual">Collector (personal use)</option>
          <option value="shop">Shop / store</option>
        </select>
        {accountType === 'shop' && (
          <>
            <label htmlFor="settingsStoreName">Store name</label>
            <input
              id="settingsStoreName"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
            />
          </>
        )}
        {typeMsg && (
          <p className={typeMsg === 'Saved.' ? 'muted' : 'field-error'} style={{ fontSize: 12 }}>
            {typeMsg}
          </p>
        )}
        <button
          className="btn-secondary"
          style={{ marginTop: 12 }}
          disabled={savingType || !typeChanged}
        >
          {savingType ? 'Saving…' : 'Save account type'}
        </button>
      </form>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Appearance</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Theme choice is saved on this device only.
        </p>
        <ThemeSwitcher />
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Blocked users</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          You and a blocked collector can&apos;t see each other&apos;s listings, profile, offers or
          messages.
        </p>
        {blockedList.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            You haven&apos;t blocked anyone.
          </p>
        ) : (
          blockedList.map((b) => (
            <div className="toggle-row" key={b.blocked_id}>
              <span>
                {b.display_name} <span className="muted">@{b.handle}</span>
              </span>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
                onClick={() => handleUnblock(b)}
                disabled={unblocking === b.blocked_id}
              >
                {unblocking === b.blocked_id ? '…' : 'Unblock'}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Tokens</h2>
        <div className="toggle-row">
          <span className="muted">Balance</span>
          <span>{profile.tokens} tokens</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Link href="/tokens" className="btn-secondary">
            Get tokens
          </Link>
          <Link href="/tokens/history" className="btn-secondary">
            Token history
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Your data</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Download a JSON copy of your profile and every car in your garage.
        </p>
        <a className="btn-secondary" href="/api/export" style={{ marginTop: 14 }}>
          Export my data
        </a>
      </div>

      <form className="panel" style={{ marginBottom: 16 }} onSubmit={handleFeedback}>
        <h2 style={{ fontSize: 16 }}>Feedback &amp; bug reports</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Found something broken, or have an idea? It goes straight to the team.
        </p>
        <label htmlFor="feedbackKind" style={{ marginTop: 10 }}>
          Type
        </label>
        <select
          id="feedbackKind"
          value={fbKind}
          onChange={(e) => setFbKind(e.target.value as FeedbackKind)}
        >
          {FEEDBACK_KINDS.map((k) => (
            <option key={k} value={k}>
              {k === 'bug' ? 'Bug report' : k === 'idea' ? 'Idea / request' : 'Something else'}
            </option>
          ))}
        </select>
        <label htmlFor="feedbackMessage">Message</label>
        <textarea
          id="feedbackMessage"
          rows={4}
          maxLength={2000}
          value={fbMessage}
          onChange={(e) => {
            setFbMessage(e.target.value);
            if (fbState !== 'idle') setFbState('idle');
          }}
          placeholder="What happened, or what would you like to see?"
          required
        />
        {fbError && <p className="field-error">{fbError}</p>}
        {fbState === 'sent' && (
          <p className="muted" style={{ fontSize: 12 }}>
            Thanks — sent.
          </p>
        )}
        <button
          className="btn-secondary"
          style={{ marginTop: 12 }}
          disabled={fbState === 'sending' || fbMessage.trim().length < 3}
        >
          {fbState === 'sending' ? 'Sending…' : 'Send feedback'}
        </button>
      </form>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Legal</h2>
        <div className="toggle-row">
          <span>Terms of use</span>
          <Link href="/legal/terms" className="muted" style={{ fontSize: 13 }}>
            Read
          </Link>
        </div>
        <div className="toggle-row">
          <span>Privacy policy</span>
          <Link href="/legal/privacy" className="muted" style={{ fontSize: 13 }}>
            Read
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Delete account</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Anonymises your profile, removes your cars and listings and withdraws open offers. Token
          history is kept for accounting. This cannot be undone.
        </p>
        <button
          className="btn-danger"
          style={{ marginTop: 14 }}
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
        {error && (
          <p className="field-error" style={{ marginTop: 10 }}>
            {error}
          </p>
        )}
      </div>

      <button className="btn-secondary" onClick={handleSignOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
