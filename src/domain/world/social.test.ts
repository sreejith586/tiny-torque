import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPublicProfilesByIds } from '@/domain/identity';
import { WorldError } from './errors';
import {
  acceptInvite,
  createInvite,
  listGuestbook,
  listOpenGarages,
  listRecentVisitors,
  postGuestbook,
  recordVisit,
} from './service';
import type { Client } from '@/lib/supabase/types';

const repo = vi.hoisted(() => ({
  recordVisit: vi.fn(),
  giveKudos: vi.fn(),
  postGuestbook: vi.fn(),
  hideGuestbook: vi.fn(),
  listGuestbook: vi.fn(),
  listRecentVisits: vi.fn(),
  createInvite: vi.fn(),
  acceptInvite: vi.fn(),
  revokeInvite: vi.fn(),
  listInvites: vi.fn(),
  listOpenGarages: vi.fn(),
  // module-level aliases in service.ts read these at import time
  listLevels: vi.fn(),
}));
vi.mock('./repo', () => repo);
vi.mock('@/domain/identity', () => ({
  listPublicProfilesByIds: vi.fn(),
  getPublicProfile: vi.fn(),
}));
vi.mock('@/domain/garage', () => ({ listPublicCollectionItems: vi.fn() }));
vi.mock('@/domain/events', () => ({ emitEvent: vi.fn() }));

const supabase = {} as Client;
const GARAGE = '11111111-1111-4111-8111-111111111111';
const VISITOR = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listPublicProfilesByIds).mockResolvedValue([
    { id: VISITOR, handle: 'varun', display_name: 'Varun' },
  ] as never);
});

describe('world social (MV-W03-02)', () => {
  it('recordVisit passes through, including the owner null', async () => {
    repo.recordVisit.mockResolvedValue(null);
    expect(await recordVisit(supabase, GARAGE)).toBeNull();
    repo.recordVisit.mockRejectedValue({ message: 'garage_not_found' });
    await expect(recordVisit(supabase, GARAGE)).rejects.toThrow(new WorldError('garage_not_found'));
  });

  it('postGuestbook validates, runs the clean-language check before any RPC, and maps the rate limit', async () => {
    await expect(postGuestbook(supabase, { garageUserId: GARAGE, body: '' })).rejects.toThrow();
    await expect(
      postGuestbook(supabase, { garageUserId: GARAGE, body: 'sh1t garage' })
    ).rejects.toThrow(new WorldError('language_not_allowed'));
    expect(repo.postGuestbook).not.toHaveBeenCalled();

    repo.postGuestbook.mockResolvedValue({ id: 'g1', body: 'Lovely Skylines!' } as never);
    await postGuestbook(supabase, { garageUserId: GARAGE, body: '  Lovely Skylines!  ' });
    expect(repo.postGuestbook).toHaveBeenCalledWith(supabase, GARAGE, 'Lovely Skylines!');

    repo.postGuestbook.mockRejectedValue({ message: 'guestbook_rate_limit' });
    await expect(postGuestbook(supabase, { garageUserId: GARAGE, body: 'again' })).rejects.toThrow(
      new WorldError('guestbook_rate_limit')
    );
  });

  it('listGuestbook joins public identities and falls back without leaking ids as names', async () => {
    repo.listGuestbook.mockResolvedValue([
      { id: 'g1', body: 'hi', created_at: 't', hidden_by_host: false, author_id: VISITOR },
      {
        id: 'g2',
        body: 'yo',
        created_at: 't',
        hidden_by_host: true,
        author_id: '33333333-3333-4333-8333-333333333333',
      },
    ] as never);
    const out = await listGuestbook(supabase, GARAGE);
    expect(out[0]?.author).toEqual({ id: VISITOR, handle: 'varun', displayName: 'Varun' });
    expect(out[1]?.author.handle).toBe('collector');
    expect(out[1]?.hidden).toBe(true);
    expect(listPublicProfilesByIds).toHaveBeenCalledTimes(1);
  });

  it('listRecentVisitors returns handles only', async () => {
    repo.listRecentVisits.mockResolvedValue([
      { visitor_id: VISITOR, visited_on: '2026-11-03' },
      { visitor_id: '44444444-4444-4444-8444-444444444444', visited_on: '2026-11-02' },
    ] as never);
    const out = await listRecentVisitors(supabase, GARAGE);
    expect(out).toEqual([
      { visitorId: VISITOR, handle: 'varun', displayName: 'Varun', visitedOn: '2026-11-03' },
    ]);
    expect(JSON.stringify(out)).not.toContain('mobile');
  });

  it('createInvite applies defaults and bounds; a direct invite lower-cases the handle', async () => {
    repo.createInvite.mockResolvedValue({ id: 'i1' } as never);
    await createInvite(supabase, {});
    expect(repo.createInvite).toHaveBeenCalledWith(supabase, {
      inviteeHandle: undefined,
      hours: 168,
      maxUses: 1,
    });
    await createInvite(supabase, { inviteeHandle: 'Varun', hours: 24 });
    expect(repo.createInvite).toHaveBeenLastCalledWith(supabase, {
      inviteeHandle: 'varun',
      hours: 24,
      maxUses: 1,
    });
    await expect(createInvite(supabase, { hours: 10_000 })).rejects.toThrow();
    repo.createInvite.mockRejectedValue({ message: 'invite_limit' });
    await expect(createInvite(supabase, {})).rejects.toThrow(new WorldError('invite_limit'));
  });

  it('acceptInvite refuses a malformed token locally and maps invite_invalid from the RPC', async () => {
    await expect(acceptInvite(supabase, 'not-a-token')).rejects.toThrow(
      new WorldError('invite_invalid')
    );
    expect(repo.acceptInvite).not.toHaveBeenCalled();
    const token = 'a'.repeat(64);
    repo.acceptInvite.mockRejectedValue({ message: 'invite_invalid' });
    await expect(acceptInvite(supabase, token)).rejects.toThrow(new WorldError('invite_invalid'));
    expect(repo.acceptInvite).toHaveBeenCalledWith(supabase, token);
  });

  it('listOpenGarages defaults to the viewer country, "all" widens, and the code is normalised', async () => {
    repo.listOpenGarages.mockResolvedValue([]);
    await listOpenGarages(supabase, {}, 'AE');
    expect(repo.listOpenGarages).toHaveBeenCalledWith(supabase, { country: 'AE', limit: 20 });
    await listOpenGarages(supabase, { country: 'all' }, 'AE');
    expect(repo.listOpenGarages).toHaveBeenLastCalledWith(supabase, {
      country: undefined,
      limit: 20,
    });
    await listOpenGarages(supabase, { country: 'in', limit: 5 }, 'AE');
    expect(repo.listOpenGarages).toHaveBeenLastCalledWith(supabase, { country: 'IN', limit: 5 });
    await expect(listOpenGarages(supabase, { country: 'India' })).rejects.toThrow();
  });
});
