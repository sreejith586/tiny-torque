import { describe, expect, it } from 'vitest';
import { inviteErrorMessage } from '../service';

describe('inviteErrorMessage (MV-S11)', () => {
  it('maps each database answer to plain words', () => {
    expect(inviteErrorMessage({ message: 'Invalid invite code' })).toMatch(/isn’t one of ours/);
    expect(inviteErrorMessage({ message: 'Invite code has expired' })).toMatch(/expired/);
    expect(inviteErrorMessage({ message: 'Invite code already used' })).toMatch(
      /already been used/
    );
    expect(inviteErrorMessage({ message: 'invite_required' })).toMatch(/invite-only/);
    expect(inviteErrorMessage(new Error('Sign in required'))).toMatch(/Sign in again/);
  });

  it('falls back without leaking raw errors', () => {
    expect(inviteErrorMessage({ message: 'PGRST301 JWT expired at …' })).toMatch(/expired/);
    expect(inviteErrorMessage(null)).toMatch(/Could not verify/);
    expect(inviteErrorMessage('boom')).toMatch(/Could not verify/);
  });
});
