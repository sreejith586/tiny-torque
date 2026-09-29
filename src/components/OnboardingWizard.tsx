'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  createProfile,
  redeemInvite,
  suggestAvailableHandle,
  isHandleAvailable,
  CITIES_BY_COUNTRY,
} from '@/domain/identity';
import type { AccountType, CountryRow } from '@/types/database';

// D-042: garage-log-147.html's stepped onboarding (progress bar, back button) is the reference
// for this screen, mapped onto what F-01 actually asks it to collect — the mockup's phone/OTP
// step is dropped (already done at /login, MV-S1-03) and its photo step is dropped (F-01 still
// says no avatar until S2's media pipeline exists).

type Step = 'invite' | 'account' | 'name' | 'location';
type HandleStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

export default function OnboardingWizard({
  userId,
  userPhone = null,
  countries,
  inviteOnly,
  defaultCountry,
}: {
  userId: string;
  userPhone?: string | null;
  countries: CountryRow[];
  inviteOnly: boolean;
  defaultCountry: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const steps: Step[] = [
    ...(inviteOnly ? (['invite'] as const) : []),
    'account',
    'name',
    'location',
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const [inviteCode, setInviteCode] = useState('');
  const [inviteRedeemed, setInviteRedeemed] = useState(false);

  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [storeName, setStoreName] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>('idle');

  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [city, setCity] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityOptions = CITIES_BY_COUNTRY[countryCode] ?? [];

  async function suggestHandleFor(name: string) {
    if (handleEdited || !name.trim()) return;
    try {
      setHandle(await suggestAvailableHandle(supabase, name.trim()));
      setHandleStatus('available');
    } catch {
      // Auto-suggestion is a convenience; the blur check below still catches a bad manual entry.
    }
  }

  async function checkHandle() {
    const candidate = handle.trim().toLowerCase();
    if (!candidate) {
      // Blank is valid: createProfile auto-suggests one from displayName.
      setHandleStatus('idle');
      return;
    }
    if (!HANDLE_RE.test(candidate)) {
      setHandleStatus('invalid');
      return;
    }
    setHandleStatus('checking');
    try {
      setHandleStatus((await isHandleAvailable(supabase, candidate)) ? 'available' : 'taken');
    } catch {
      setHandleStatus('idle');
    }
  }

  function goNext(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (step === 'account' && accountType === 'shop' && !storeName.trim()) {
      setError('Enter your store name.');
      return;
    }
    if (step === 'name') {
      if (!displayName.trim()) {
        setError('Tell us what to call you.');
        return;
      }
      if (handleStatus === 'checking') {
        setError('Still checking that handle — one moment.');
        return;
      }
      if (handleStatus === 'invalid') {
        setError('Handle must be 3-24 characters: lowercase letters, numbers, underscores only.');
        return;
      }
      if (handleStatus === 'taken') {
        setError('That handle is already taken.');
        return;
      }
    }

    setStepIndex((i) => i + 1);
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function handleRedeemInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!inviteCode.trim()) {
      setError('Enter your invite code.');
      return;
    }
    if (inviteRedeemed) {
      setStepIndex((i) => i + 1);
      return;
    }
    setLoading(true);
    try {
      await redeemInvite(supabase, inviteCode.trim());
      setInviteRedeemed(true);
      setStepIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify that invite code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createProfile(supabase, userId, {
        displayName: displayName.trim(),
        accountType,
        storeName: accountType === 'shop' ? storeName.trim() : null,
        mobile: userPhone,
        handle: handle.trim() || null,
        countryCode,
        city: city.trim() || null,
      });
      router.push('/garage');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: 26 }}>Set up your profile</h1>
      <p className="muted">Just a couple of details to get you into your garage.</p>

      <div style={{ display: 'flex', gap: 6, margin: '18px 0' }} aria-label="Progress">
        {steps.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= stepIndex ? 'var(--orange)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      {step === 'invite' && (
        <form onSubmit={handleRedeemInvite}>
          <label htmlFor="inviteCode">Invite code</label>
          <input
            id="inviteCode"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="e.g. FOUNDERS2026"
            autoFocus
          />
          {error && <p className="field-error">{error}</p>}
          <button className="btn-primary" style={{ marginTop: 20 }} disabled={loading}>
            {loading ? 'Checking…' : 'Next'}
          </button>
        </form>
      )}

      {step === 'account' && (
        <form onSubmit={goNext}>
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
                placeholder="e.g. Speed Shop Diecast"
              />
            </>
          )}

          {error && <p className="field-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {stepIndex > 0 && (
              <button type="button" className="btn-secondary" onClick={goBack}>
                Back
              </button>
            )}
            <button className="btn-primary">Next</button>
          </div>
        </form>
      )}

      {step === 'name' && (
        <form onSubmit={goNext}>
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={(e) => suggestHandleFor(e.target.value)}
            placeholder="e.g. Varun"
            autoFocus
          />

          <label htmlFor="handle">Handle</label>
          <input
            id="handle"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setHandleEdited(true);
              setHandleStatus('idle');
            }}
            onBlur={checkHandle}
            placeholder="e.g. varun"
          />
          {handleStatus === 'checking' && <p className="muted">Checking availability…</p>}
          {handleStatus === 'taken' && <p className="field-error">That handle is already taken.</p>}
          {handleStatus === 'invalid' && (
            <p className="field-error">
              3-24 characters: lowercase letters, numbers, underscores only.
            </p>
          )}
          {handleStatus === 'available' && handle && (
            <p className="muted">mini-vault.app/u/{handle}</p>
          )}

          {error && <p className="field-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-secondary" onClick={goBack}>
              Back
            </button>
            <button className="btn-primary">Next</button>
          </div>
        </form>
      )}

      {step === 'location' && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="countryCode">Country</label>
          <select
            id="countryCode"
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              setCity('');
            }}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>

          <label htmlFor="city">City (optional)</label>
          <input
            id="city"
            list="city-options"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Bengaluru"
          />
          <datalist id="city-options">
            {cityOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {error && <p className="field-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-secondary" onClick={goBack}>
              Back
            </button>
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Enter my garage'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
