'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  sendOtp,
  verifyOtp,
  sendEmailOtp,
  verifyEmailOtp,
  getProfile,
  listEnabledCountries,
  type CountryRow,
} from '@/domain/identity';
import { Spinner, StatusRow } from '@/components/Loaders';
import OtpInput from '@/components/OtpInput';

// Two-step OTP login: choose phone or email -> send code -> enter code -> verify.
// On first login (no profiles row yet) we send the person to /onboarding;
// otherwise straight to /garage.
//
// Email OTP is the primary path until the SMS provider is configured (D-037);
// phone stays available. Country list = the pilot's enabled countries (D-001: AE/IN).

const DEFAULT_COUNTRY = 'IN';
type Method = 'email' | 'phone';

// Matches the `countries` seed (D-001 pilot). Renders immediately so the select is never
// blank while the live fetch is in flight, and the form still works if it fails outright.
const FALLBACK_COUNTRIES: CountryRow[] = [
  { code: 'AE', name: 'United Arab Emirates', dial_code: '+971', currency: 'AED', enabled: true },
  { code: 'IN', name: 'India', dial_code: '+91', currency: 'INR', enabled: true },
];

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [method, setMethod] = useState<Method>('email');
  const [step, setStep] = useState<'identify' | 'otp'>('identify');
  const [countries, setCountries] = useState<CountryRow[]>(FALLBACK_COUNTRIES);
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const [mobileDigits, setMobileDigits] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEnabledCountries(supabase)
      .then((rows) => {
        const first = rows[0];
        if (!first) return;
        setCountries(rows);
        if (!rows.some((c) => c.code === DEFAULT_COUNTRY)) {
          setCountryCode(first.code);
        }
      })
      .catch(() => {
        // Country list is a progressive enhancement over the default; sign-in still works.
      });
  }, [supabase]);

  const dialCode = countries.find((c) => c.code === countryCode)?.dial_code ?? '+91';
  const fullMobile = `${dialCode}${mobileDigits.replace(/\D/g, '')}`;
  const cleanEmail = email.trim().toLowerCase();
  const destination = method === 'email' ? cleanEmail : fullMobile;

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (method === 'phone' && mobileDigits.replace(/\D/g, '').length < 7) {
      setError('Enter a valid mobile number.');
      return;
    }
    if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      if (method === 'email') await sendEmailOtp(supabase, cleanEmail);
      else await sendOtp(supabase, fullMobile);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    void verify();
  }

  // Accepts the code explicitly so OtpInput's onComplete can verify with the freshly
  // completed value without waiting for the `code` state update to flush.
  async function verify(submitted?: string) {
    const c = (submitted ?? code).trim();
    setError(null);
    if (c.length < 4) {
      setError('Enter the code we sent you.');
      return;
    }
    setLoading(true);
    try {
      const user =
        method === 'email'
          ? await verifyEmailOtp(supabase, cleanEmail, c)
          : await verifyOtp(supabase, fullMobile, c);
      if (!user) throw new Error('Verification did not return a user.');

      // Signed in. Profile lookup is a separate concern — never report it as a bad code.
      let hasProfile = false;
      try {
        hasProfile = !!(await getProfile(supabase, user.id));
      } catch (err) {
        setError(
          `Signed in, but your profile could not be loaded (${err instanceof Error ? err.message : 'unknown error'}). Try refreshing.`
        );
        return;
      }
      router.push(hasProfile ? '/garage' : '/onboarding');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMethod() {
    setMethod(method === 'email' ? 'phone' : 'email');
    setError(null);
  }

  return (
    <main style={{ padding: '48px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ fontSize: 26 }}>Sign in to Tiny Torque</h1>
      <p className="muted">
        {method === 'email'
          ? 'No password needed — just your email.'
          : 'No password needed — just your mobile number.'}
      </p>

      {step === 'identify' && (
        <form onSubmit={handleSendOtp} style={{ marginTop: 12 }}>
          {method === 'email' ? (
            <>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </>
          ) : (
            <>
              <label htmlFor="mobile">Mobile number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  id="mobileCountry"
                  aria-label="Country"
                  title="Country"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{ width: 'auto', flex: '0 0 auto' }}
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code} title={c.name}>
                      {c.code} {c.dial_code}
                    </option>
                  ))}
                </select>
                <input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  value={mobileDigits}
                  onChange={(e) => setMobileDigits(e.target.value)}
                  autoFocus
                />
              </div>
            </>
          )}
          {error && <p className="field-error">{error}</p>}
          <button className="btn-primary" style={{ marginTop: 20 }} disabled={loading}>
            {loading ? 'Sending code…' : 'Send code'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 10 }}
            onClick={switchMethod}
          >
            {method === 'email' ? 'Use mobile number instead' : 'Use email instead'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} style={{ marginTop: 12 }}>
          <label id="code-label">Enter the code sent to {destination}</label>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(full) => void verify(full)}
            length={6}
            disabled={loading}
            autoFocus
            ariaLabel="One-time code"
          />
          {loading && (
            <StatusRow>
              <Spinner />
              <span>Verifying your code…</span>
            </StatusRow>
          )}
          {error && <p className="field-error">{error}</p>}
          <button className="btn-primary" style={{ marginTop: 20 }} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 10 }}
            onClick={() => {
              setStep('identify');
              setCode('');
              setError(null);
            }}
          >
            {method === 'email' ? 'Use a different email' : 'Use a different number'}
          </button>
        </form>
      )}
    </main>
  );
}
