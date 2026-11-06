// Smoke test for the W03 social routes: open-garages list (anon-capable, country default) and a
// garage's guestbook (visibility via the service). Dark = 404 while the `world` flag is off.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getOpen } from './open/route';
import { GET as getGuestbook } from './garages/[handle]/guestbook/route';
import { _resetRateLimits } from '@/lib/rate-limit';
import { isFlagEnabled } from '@/domain/flags';
import { getGarageForVisitor, listGuestbook, listOpenGarages } from '@/domain/world';
import type * as WorldModule from '@/domain/world';

const getUser = vi.fn();
const profileCountry = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: profileCountry() }) }),
      }),
    }),
  }),
}));
vi.mock('@/domain/flags', () => ({ isFlagEnabled: vi.fn() }));
vi.mock('@/domain/world', async (importOriginal) => {
  const actual = await importOriginal<typeof WorldModule>();
  return {
    ...actual,
    listOpenGarages: vi.fn(),
    getGarageForVisitor: vi.fn(),
    listGuestbook: vi.fn(),
  };
});

const USER = { id: '11111111-1111-4111-8111-111111111111' };
const req = (path: string) =>
  new Request(`http://localhost${path}`, { headers: { 'x-forwarded-for': '10.0.0.9' } });

beforeEach(() => {
  vi.resetAllMocks();
  _resetRateLimits();
  getUser.mockResolvedValue({ data: { user: null } });
  profileCountry.mockReturnValue({ country_code: 'AE' });
  vi.mocked(isFlagEnabled).mockResolvedValue(true);
});

describe('GET /api/v1/world/open', () => {
  it('404 while dark, even for anon', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    expect((await getOpen(req('/api/v1/world/open'))).status).toBe(404);
    expect(listOpenGarages).not.toHaveBeenCalled();
  });

  it('anon lists with no country default; a signed-in caller defaults to their own country', async () => {
    vi.mocked(listOpenGarages).mockResolvedValue([]);
    await getOpen(req('/api/v1/world/open?limit=5'));
    expect(listOpenGarages).toHaveBeenCalledWith(
      expect.anything(),
      { country: undefined, limit: 5 },
      null
    );
    getUser.mockResolvedValue({ data: { user: USER } });
    await getOpen(req('/api/v1/world/open?country=all'));
    expect(listOpenGarages).toHaveBeenLastCalledWith(
      expect.anything(),
      { country: 'all', limit: undefined },
      'AE'
    );
  });

  it('400 on a malformed country', async () => {
    vi.mocked(listOpenGarages).mockRejectedValue({ issues: [] });
    expect((await getOpen(req('/api/v1/world/open?country=India'))).status).toBe(400);
  });
});

describe('GET /api/v1/world/garages/[handle]/guestbook', () => {
  const params = (handle: string) => ({ params: Promise.resolve({ handle }) });

  it('404 when the garage is not visible to the caller', async () => {
    vi.mocked(getGarageForVisitor).mockResolvedValue(null);
    const res = await getGuestbook(req('/x'), params('varun'));
    expect(res.status).toBe(404);
    expect(listGuestbook).not.toHaveBeenCalled();
  });

  it('returns the entries for a visible garage', async () => {
    vi.mocked(getGarageForVisitor).mockResolvedValue({ garage: { user_id: USER.id } } as never);
    vi.mocked(listGuestbook).mockResolvedValue([{ id: 'g1' }] as never);
    const res = await getGuestbook(req('/x'), params('varun'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [{ id: 'g1' }] });
    expect(listGuestbook).toHaveBeenCalledWith(expect.anything(), USER.id);
  });
});
