// Events service — thin passthrough, matching the identity module's pattern.
import * as repo from './repo';

export const emitEvent = repo.emitEvent;
export const claimAnalyticsEvents = repo.claimAnalyticsEvents;

export type { EmitEventInput, EventEntity, EventType } from './types';
export { EVENT_TYPES } from './types';
