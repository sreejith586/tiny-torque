// Product analytics wrapper (D-015). The ONLY place PostHog is touched.
// Event names mirror the domain event catalogue (domain/events, S1) — keep them
// dot.namespaced and lower-case. Never pass phone numbers or PII in props.
'use client';

import posthog from 'posthog-js';
import type { EventType } from '@/domain/events/types';

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

export function identify(
  userId: string,
  traits: { country_code?: string; plan?: string; account_type?: string } = {}
) {
  if (!ready) return;
  posthog.identify(userId, traits);
}

export function track(event: string, props: Record<string, string | number | boolean | null> = {}) {
  if (!ready) return;
  posthog.capture(event, props);
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
  if (!ready) return;
  posthog.reset();
}
