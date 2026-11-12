'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { APP_SHELL_HIDDEN_ON } from '@/lib/shell-routes';
import { canOfferInstall, dismissInstall, isIosSafari, isStandalone, recordVisit } from '@/lib/pwa';
import { ShareIcon } from './icons';

// MV-S9-02 (F-17): PWA plumbing for the whole app shell, mounted once in the root layout.
//  1. registers /sw.js (production only — the dev server's HMR and a service worker fight),
//  2. counts this visit (a reload within 30 min is not a new visit),
//  3. shows the install prompt from the 2nd visit on: Chrome/Edge/Android via the deferred
//     `beforeinstallprompt` event; iOS Safari (no such event) gets an "Add to Home Screen" hint.
//     Dismissing hides it for 30 days; running as an installed app never shows it.
// The prompt reuses the badge-unlock toast surface (`.unlock-toast`, D-044 motion) rather than a
// new component — same place above the bottom nav, same panel chrome.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInit() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<'hidden' | 'native' | 'ios'>('hidden');

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failing (private mode, unsupported) just means no offline shell.
      });
    }
    const kv = window.localStorage;
    recordVisit(kv);
    if (isStandalone(window)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      if (canOfferInstall(kv)) setMode('native');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    // iOS has no event to wait for: offer the hint on the next tick (not synchronously inside the
    // effect, react-hooks/set-state-in-effect).
    const iosHint =
      isIosSafari(navigator.userAgent) && canOfferInstall(kv)
        ? window.setTimeout(() => setMode('ios'), 0)
        : null;
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (iosHint !== null) window.clearTimeout(iosHint);
    };
  }, []);

  if (mode === 'hidden') return null;
  if (pathname && APP_SHELL_HIDDEN_ON.includes(pathname)) return null;

  const dismiss = () => {
    dismissInstall(window.localStorage);
    setMode('hidden');
  };

  const install = async () => {
    if (!installEvent) return dismiss();
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setMode('hidden');
      dismissInstall(window.localStorage);
    }
  };

  return (
    <div
      className="unlock-toast"
      role="dialog"
      aria-label="Install Tiny Torque"
      data-install-prompt=""
    >
      <div className="badge-icon" style={{ width: 40, height: 40 }}>
        <ShareIcon size={20} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Add Tiny Torque to your home screen</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {mode === 'ios'
            ? 'Tap Share, then "Add to Home Screen" for the full-screen app.'
            : 'Opens full screen, loads faster, and your garage works offline.'}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {mode === 'native' && (
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }}
              onClick={install}
            >
              Install
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            style={{ width: 'auto', padding: '6px 14px', fontSize: 13 }}
            onClick={dismiss}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
