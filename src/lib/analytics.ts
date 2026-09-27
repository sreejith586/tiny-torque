// Product analytics wrapper (D-015). The ONLY place PostHog is touched.
// Event names mirror the domain event catalogue (domain/events, S1) — keep them
// dot.namespaced and lower-case. Never pass phone numbers or PII in props.
'use client';

import posthog from 'posthog-js';

let ready = false;

export function initAnalytics() {
  if (ready || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // analytics is optional in dev/preview
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: false, // explicit events only
    mask_all_text: true,
  });
  ready = true;
}

export function identify(userId: string, traits: { country_code?: string; plan?: string; account_type?: string } = {}) {
  if (!ready) return;
  posthog.identify(userId, traits);
}

export function track(event: string, props: Record<string, string | number | boolean | null> = {}) {
  if (!ready) return;
  posthog.capture(event, props);
}

export function resetAnalytics() {
  if (!ready) return;
  posthog.reset();
}
