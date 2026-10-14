import { describe, it, expect } from 'vitest';
import { notificationText, notificationLink } from './service';

describe('notificationText (MV-S6-06)', () => {
  it('returns the right copy per type', () => {
    expect(notificationText({ type: 'offer_received' })).toMatch(/new offer/);
    expect(notificationText({ type: 'message' })).toMatch(/message/);
    expect(notificationText({ type: 'review_received' })).toMatch(/review/);
  });
});

describe('notificationLink (MV-S6-06)', () => {
  it('sends offer-ish types to /offers', () => {
    expect(notificationLink({ type: 'offer_received', payload: {} })).toBe('/offers');
    expect(notificationLink({ type: 'offer_accepted', payload: {} })).toBe('/offers');
    expect(notificationLink({ type: 'listing_sold', payload: {} })).toBe('/offers');
  });

  it('sends a message notification to its deal thread', () => {
    expect(notificationLink({ type: 'message', payload: { offer_id: 'o1' } })).toBe('/deals/o1');
  });

  it('falls back to /offers for a message with no offer_id', () => {
    expect(notificationLink({ type: 'message', payload: {} })).toBe('/offers');
  });

  it('sends review_received to /profile', () => {
    expect(notificationLink({ type: 'review_received', payload: {} })).toBe('/profile');
  });

  it('has no link for badge/wishlist/system notifications', () => {
    expect(notificationLink({ type: 'badge_unlocked', payload: {} })).toBeNull();
    expect(notificationLink({ type: 'wishlist_match', payload: {} })).toBeNull();
    expect(notificationLink({ type: 'system', payload: {} })).toBeNull();
  });
});
