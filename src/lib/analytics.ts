// Product analytics wrapper (D-015). The ONLY place PostHog is touched.
// Event names mirror the domain event catalogue (domain/events, S1) — keep them
// dot.namespaced and lower-case. Never pass phone numbers or PII in props.
'use client';

import type { PostHog } from 'posthog-js';
import type { EventType } from '@/domain/events/types';

// MV-S9-03: posthog-js is loaded on demand (dynamic import, after the first paint) instead of
// riding in every route's first-load bundle. Calls made before it is ready are queued and replayed.
let client: PostHog | null = null;
let loading: Promise<void> | null = null;
const queue: Array<(p: PostHog) => void> = [];

function withClient(fn: (p: PostHog) => void) {
  if (client) fn(client);
  else if (loading) queue.push(fn);
}

export function initAnalytics() {
  if (client || loading || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // analytics is optional in dev/preview
  const start = () => {
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
          capture_pageview: true,
          capture_pageleave: true,
          persistence: 'localStorage+cookie',
          autocapture: false, // explicit events only
          mask_all_text: true,
        });
        client = posthog;
        for (const fn of queue.splice(0)) fn(posthog);
      })
      .catch(() => {
        loading = null; // blocked / offline — analytics simply stays off this session
      });
  };
  // Yield to the main thread first so the import never competes with hydration.
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(start, { timeout: 3000 });
  else window.setTimeout(start, 1500);
  // Mark "loading" synchronously so early track()/identify() calls queue instead of dropping.
  loading = loading ?? Promise.resolve();
}

export function identify(
  userId: string,
  traits: { country_code?: string; plan?: string; account_type?: string } = {}
) {
  withClient((p) => p.identify(userId, traits));
}

export function track(event: string, props: Record<string, string | number | boolean | null> = {}) {
  withClient((p) => p.capture(event, props));
}

/**
 * Collectors World PostHog names (MV-W01-09, F-18) — the client-side mirror of the world.* /
 * meetup.* / race.* / club.* / quest.* domain events, so funnels use the same vocabulary as the
 * event log (07 §11 KPIs). Typed against the catalogue: a name that isn't a domain event can't
 * be captured here. Props stay PII-free (ids, levels, prices, counts only).
 */
export const WORLD_ANALYTICS_EVENTS = [
  'world.garage_created',
  'world.garage_updated',
  'world.layout_saved',
  'world.level_up',
  'world.item_bought',
  'world.visited',
  'world.kudos_given',
  'world.guestbook_posted',
  'meetup.created',
  'meetup.rsvp',
  'meetup.checked_in',
  'race.entered',
  'race.completed',
  'club.created',
  'club.joined',
  'quest.completed',
] as const satisfies readonly EventType[];

export type WorldAnalyticsEvent = (typeof WORLD_ANALYTICS_EVENTS)[number];

export function trackWorld(
  event: WorldAnalyticsEvent,
  props: Record<string, string | number | boolean | null> = {}
) {
  track(event, props);
}

export function resetAnalytics() {
  withClient((p) => p.reset());
}
