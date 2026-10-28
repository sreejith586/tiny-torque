// Smoke test for the /api/v1/world scaffold (MV-W01-07): auth, flag gate (dark = 404), zod on
// the handle param, rate limiting, and WorldError → status mapping. Supabase and the services are
// mocked — the handlers are thin by design.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getMe } from './me/route';
import { GET as getByHandle } from './garages/[handle]/route';
import { _resetRateLimits } from '@/lib/rate-limit';
import { isFlagEnabled } from '@/domain/flags';
import { getGarageForVisitor, getOwnGarage, WorldError } from '@/domain/world';
import type * as WorldModule from '@/domain/world';

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock('@/domain/flags', () => ({ isFlagEnabled: vi.fn() }));
vi.mock('@/domain/world', async (importOriginal) => {
  const actual = await importOriginal<typeof WorldModule>();
  return { ...actual, getOwnGarage: vi.fn(), getGarageForVisitor: vi.fn() };
});

const USER = { id: '11111111-1111-4111-8111-111111111111' };
const req = (path: string, ip = '10.0.0.1') =>
  new Request(`http://localhost${path}`, { headers: { 'x-forwarded-for': ip } });
const params = (handle: string) => ({ params: Promise.resolve({ handle }) });

beforeEach(() => {
  vi.resetAllMocks();
  _resetRateLimits();
  getUser.mockResolvedValue({ data: { user: null } });
  vi.mocked(isFlagEnabled).mockResolvedValue(true);
});

describe('GET /api/v1/world/me', () => {
  it('401 without a session', async () => {
    const res = await getMe(req('/api/v1/world/me'));
    expect(res.status).toBe(401);
    expect(getOwnGarage).not.toHaveBeenCalled();
  });

  it('404 while the world flag is off — the seam is dark (D-028)', async () => {
    getUser.mockResolvedValue({ data: { user: USER } });
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const res = await getMe(req('/api/v1/world/me'));
    expect(res.status).toBe(404);
    expect(isFlagEnabled).toHaveBeenCalledWith(expect.anything(), 'world', { userId: USER.id });
    expect(getOwnGarage).not.toHaveBeenCalled();
  });

  it('200 with the own-garage payload, no-store', async () => {
    getUser.mockResolvedValue({ data: { user: USER } });
    vi.mocked(getOwnGarage).mockResolvedValue({ garage: { level: 1 } } as never);
    const res = await getMe(req('/api/v1/world/me'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ garage: { level: 1 } });
  });

  it('maps WorldError codes to statuses (402 insufficient_balance, 409 otherwise)', async () => {
    getUser.mockResolvedValue({ data: { user: USER } });
    vi.mocked(getOwnGarage).mockRejectedValue(new WorldError('insufficient_balance'));
    expect((await getMe(req('/api/v1/world/me'))).status).toBe(402);
    vi.mocked(getOwnGarage).mockRejectedValue(new WorldError('max_level'));
    expect((await getMe(req('/api/v1/world/me'))).status).toBe(409);
  });

  it('429 after the per-caller limit, with Retry-After', async () => {
    getUser.mockResolvedValue({ data: { user: USER } });
    vi.mocked(getOwnGarage).mockResolvedValue({} as never);
    let last: Response | undefined;
    for (let i = 0; i < 61; i++) last = await getMe(req('/api/v1/world/me'));
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/world/garages/[handle]', () => {
  it('400 on a malformed handle before any lookup', async () => {
    const res = await getByHandle(req('/api/v1/world/garages/x'), params('not a handle'));
    expect(res.status).toBe(400);
    expect(getGarageForVisitor).not.toHaveBeenCalled();
  });

  it('404 while dark, even for anon on a valid handle', async () => {
    vi.mocked(isFlagEnabled).mockResolvedValue(false);
    const res = await getByHandle(req('/api/v1/world/garages/varun'), params('varun'));
    expect(res.status).toBe(404);
  });

  it('anon can fetch a visible garage; viewer id is null', async () => {
    vi.mocked(getGarageForVisitor).mockResolvedValue({ garage: { name: 'G' } } as never);
    const res = await getByHandle(req('/api/v1/world/garages/varun'), params('Varun'));
    expect(res.status).toBe(200);
    expect(getGarageForVisitor).toHaveBeenCalledWith(expect.anything(), 'varun', null);
  });

  it('404 when the service says the garage is not visible', async () => {
    getUser.mockResolvedValue({ data: { user: USER } });
    vi.mocked(getGarageForVisitor).mockResolvedValue(null);
    const res = await getByHandle(req('/api/v1/world/garages/varun'), params('varun'));
    expect(res.status).toBe(404);
    expect(getGarageForVisitor).toHaveBeenCalledWith(expect.anything(), 'varun', USER.id);
  });
});
