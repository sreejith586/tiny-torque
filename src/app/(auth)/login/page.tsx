'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sendOtp, verifyOtp, getProfile } from '@/lib/api';

// Two-step phone login: enter mobile number -> send OTP -> enter code ->
// verify. On first login (no profiles row yet) we send the person to
// /onboarding; otherwise straight to /garage.
//
// Note (infra, not code): whether OTP SMS goes out via Supabase's default
// Twilio-based phone provider or a provider like MSG91 is configured in
// the Supabase dashboard (Authentication > Providers > Phone), not here.

const COUNTRY_CODE = '+91';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobileDigits, setMobileDigits] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullMobile = `${COUNTRY_CODE}${mobileDigits.replace(/\D/g, '')}`;

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mobileDigits.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(supabase, fullMobile);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length < 4) {
      setError('Enter the code we sent you.');
      return;
    }
    setLoading(true);
    try {
      const user = await verifyOtp(supabase, fullMobile, code.trim());
      if (!user) throw new Error('Verification did not return a user.');

      const profile = await getProfile(supabase, user.id);
      router.push(profile ? '/garage' : '/onboarding');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: '48px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ fontSize: 26 }}>Sign in to Mini Vault</h1>
      <p className="muted">No password needed — just your mobile number.</p>

      {step === 'mobile' && (
        <form onSubmit={handleSendOtp} style={{ marginTop: 12 }}>
          <label htmlFor="mobile">Mobile number</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <span
              className="panel"
              style={{ padding: '12px 14px', width: 'auto', flex: '0 0 auto' }}
            >
              {COUNTRY_CODE}
            </span>
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
          {error && <p className="field-error">{error}</p>}
          <button className="btn-primary" style={{ marginTop: 20 }} disabled={loading}>
            {loading ? 'Sending code…' : 'Send code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} style={{ marginTop: 12 }}>
          <label htmlFor="code">Enter the code sent to {fullMobile}</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            placeholder="1234"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
          {error && <p className="field-error">{error}</p>}
          <button className="btn-primary" style={{ marginTop: 20 }} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 10 }}
            onClick={() => {
              setStep('mobile');
              setCode('');
              setError(null);
            }}
          >
            Use a different number
          </button>
        </form>
      )}
    </main>
  );
}
