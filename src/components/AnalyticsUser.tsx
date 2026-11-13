'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { claimAnalyticsEvents } from '@/domain/events';
import { identify, track } from '@/lib/analytics';

// MV-S10-03 (F-18): the signed-in half of product analytics. Until S10 PostHog only saw page
// views. This (1) identifies the collector — id, country, plan, account type; never name, handle
// or phone — and (2) mirrors their own new KPI events from the event log: most of them are written
// by database triggers / RPCs the browser never sees, so the browser asks for them
// (claim_analytics_events hands each event out exactly once, across tabs and devices) and
// forwards id + type + time. Renders nothing; a no-op without NEXT_PUBLIC_POSTHOG_KEY.

const THROTTLE_KEY = 'mv_analytics_claimed_at';
const THROTTLE_MS = 2 * 60_000;

export default function AnalyticsUser({
  userId,
  countryCode,
  plan,
  accountType,
}: {
  userId: string;
  countryCode: string | null;
  plan: string | null;
  accountType: string | null;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    identify(userId, {
      country_code: countryCode ?? undefined,
      plan: plan ?? undefined,
      account_type: accountType ?? undefined,
    });

    let last = 0;
    try {
      last = Number(window.sessionStorage.getItem(THROTTLE_KEY)) || 0;
    } catch {
      // storage blocked — claim once per mount instead
    }
    if (Date.now() - last < THROTTLE_MS) return;
    try {
      window.sessionStorage.setItem(THROTTLE_KEY, String(Date.now()));
    } catch {
      // ignore
    }

    let cancelled = false;
    claimAnalyticsEvents(createClient())
      .then((events) => {
        if (cancelled) return;
        for (const e of events) {
          track(e.type, { event_id: e.id, occurred_at: e.occurred_at, mirrored: true });
        }
      })
      .catch(() => {
        // analytics must never surface an error to the collector
      });
    return () => {
      cancelled = true;
    };
  }, [userId, countryCode, plan, accountType]);

  return null;
}
