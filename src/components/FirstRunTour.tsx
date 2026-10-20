'use client';

import { useState } from 'react';
import { AddIcon, GarageIcon, MarketIcon, TrophyIcon } from './icons';

// MV-S8-06 (F-01): the 4-step skippable first-run tour, shown over the garage the first time a
// collector lands there after onboarding. Same progress-bar fill + Back/Next shape as the
// onboarding wizard (D-042/D-045); dismissing (Skip or Done) stamps tutorial_dismissed_at through
// the server action so it never shows again on any device.

const STEPS = [
  {
    Icon: GarageIcon,
    title: 'This is your garage',
    body: 'Every car you own lives here. Search, filter and sort it, flip between grid and list, and tap any car for its details and photos.',
  },
  {
    Icon: AddIcon,
    title: 'Add cars three ways',
    body: 'Snap a photo and let the scan fill in the details, add one by hand, or import a whole spreadsheet at once from the Add Car tab.',
  },
  {
    Icon: MarketIcon,
    title: 'Trade with collectors',
    body: 'List a car for sale or trade on the Market, make and receive offers, and settle the deal in person — Deals keeps the chat in one place.',
  },
  {
    Icon: TrophyIcon,
    title: 'Level up',
    body: 'Adding cars, publishing listings and completing deals earn XP and unlock badges. Your profile shows your level, stats and badges — share it when you are proud of it.',
  },
] as const;

export default function FirstRunTour({ onDismiss }: { onDismiss: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  async function dismiss() {
    setOpen(false); // hide immediately; the stamp is best-effort
    try {
      await onDismiss();
    } catch {
      // if the stamp fails the tour will show once more next time — harmless
    }
  }

  if (!open) return null;

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-card">
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }} aria-label="Progress">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: 'var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: i <= step ? '100%' : '0%',
                  background: 'var(--orange)',
                  transition: 'width 0.35s ease',
                }}
              />
            </div>
          ))}
        </div>

        <div className="tour-icon">
          <current.Icon size={28} />
        </div>
        <h2 id="tour-title" style={{ fontSize: 20, marginBottom: 6 }}>
          {current.title}
        </h2>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
          {current.body}
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {step > 0 ? (
            <button type="button" className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={dismiss}>
              Skip
            </button>
          )}
          {last ? (
            <button type="button" className="btn-primary" onClick={dismiss}>
              Done
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          )}
        </div>
        {step > 0 && !last && (
          <button
            type="button"
            className="muted"
            onClick={dismiss}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 12,
              marginTop: 10,
              width: '100%',
              cursor: 'pointer',
            }}
          >
            Skip the tour
          </button>
        )}
      </div>
    </div>
  );
}
