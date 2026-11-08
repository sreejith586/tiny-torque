import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getQuestBoard, getSeasonTrack } from './service';
import type { Client } from '@/lib/supabase/types';
import type { CurrentQuestRow } from './types';

const repo = vi.hoisted(() => ({
  listCurrentQuests: vi.fn(),
  listProgress: vi.fn(),
  getActiveSeason: vi.fn(),
  getSeasonPoints: vi.fn(),
  getLoginStreak: vi.fn(),
  // W05 (season page): module-level alias + the track reads
  listSeasons: vi.fn(),
  listOwnLedgerKeys: vi.fn(),
}));
vi.mock('./repo', () => repo);

const supabase = {} as Client;
const ME = '00000000-0000-4000-8000-00000000000a';
const NOW = new Date('2026-11-06T10:00:00.000Z');

const row = (
  key: string,
  cadence: CurrentQuestRow['cadence'],
  rule: unknown,
  reward_credits = 2,
  reward_xp = 10
): CurrentQuestRow =>
  ({
    key,
    cadence,
    title: key,
    description: null,
    rule,
    reward_credits,
    reward_xp,
    reward_item_id: null,
    sort_order: 1,
    period_start: cadence === 'daily' ? '2026-11-06' : '2026-11-02',
    period_end: cadence === 'daily' ? '2026-11-07' : '2026-11-09',
  }) as unknown as CurrentQuestRow;

beforeEach(() => {
  vi.resetAllMocks();
  repo.listProgress.mockResolvedValue([]);
  repo.getActiveSeason.mockResolvedValue(null);
  repo.getSeasonPoints.mockResolvedValue(0);
  repo.getLoginStreak.mockResolvedValue(0);
});

describe('getQuestBoard (MV-W04-02)', () => {
  it('shapes the board: progress clamped, completion from completed_at, rewards, season, streak', async () => {
    repo.listCurrentQuests.mockResolvedValue([
      row('visit_three', 'daily', { kind: 'event_count', event: 'world.visited', threshold: 3 }),
      row('give_kudos', 'daily', { kind: 'event_count', event: 'world.kudos_given', threshold: 1 }),
      row('weekly_visits', 'weekly', { event: 'world.visited', threshold: 10 }, 8, 40),
    ]);
    repo.listProgress.mockResolvedValue([
      {
        user_id: ME,
        quest_key: 'visit_three',
        period_start: '2026-11-06',
        progress: 3,
        completed_at: '2026-11-06T09:00:00.000Z',
        updated_at: 't',
      },
      {
        user_id: ME,
        quest_key: 'weekly_visits',
        period_start: '2026-11-02',
        progress: 4,
        completed_at: null,
        updated_at: 't',
      },
      // a stale row from another period must not count
      {
        user_id: ME,
        quest_key: 'give_kudos',
        period_start: '2026-11-05',
        progress: 1,
        completed_at: '2026-11-05T09:00:00.000Z',
        updated_at: 't',
      },
    ]);
    repo.getActiveSeason.mockResolvedValue({
      id: 's1',
      name: "Founders' Season",
      theme: 'founders',
      starts_at: '2026-11-01T00:00:00.000Z',
      ends_at: '2027-01-05T00:00:00.000Z',
      created_at: 't',
    });
    repo.getSeasonPoints.mockResolvedValue(120);
    repo.getLoginStreak.mockResolvedValue(7);

    const board = await getQuestBoard(supabase, ME, NOW);

    expect(repo.listCurrentQuests).toHaveBeenCalledWith(supabase, NOW);
    expect(repo.listProgress).toHaveBeenCalledWith(supabase, ME, '2026-11-02'); // earliest period on offer
    expect(board.daily.map((q) => [q.key, q.progress, q.percent, q.completed])).toEqual([
      ['visit_three', 3, 100, true],
      ['give_kudos', 0, 0, false],
    ]);
    expect(board.daily[0]).toMatchObject({
      event: 'world.visited',
      threshold: 3,
      completedAt: '2026-11-06T09:00:00.000Z',
      rewardCredits: 2,
      rewardXp: 10,
      periodStart: '2026-11-06',
      periodEnd: '2026-11-07',
    });
    expect(board.weekly).toHaveLength(1);
    expect(board.weekly[0]).toMatchObject({
      progress: 4,
      percent: 40,
      completed: false,
      threshold: 10,
    });
    expect(board.streak).toBe(7);
    expect(board.season).toEqual({
      id: 's1',
      name: "Founders' Season",
      theme: 'founders',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2027-01-05T00:00:00.000Z',
      points: 120,
    });
    expect(repo.getSeasonPoints).toHaveBeenCalledWith(supabase, 's1', ME);
  });

  it('skips a quest whose rule does not parse instead of failing the panel (zod at the boundary)', async () => {
    repo.listCurrentQuests.mockResolvedValue([
      row('broken', 'daily', { kind: 'nope' }),
      row('fine', 'daily', { event: 'world.visited', threshold: 1 }),
    ]);
    const board = await getQuestBoard(supabase, ME, NOW);
    expect(board.daily.map((q) => q.key)).toEqual(['fine']);
  });

  it('an empty offer reads no progress; a streak failure degrades to 0; no season → null', async () => {
    repo.listCurrentQuests.mockResolvedValue([]);
    repo.getLoginStreak.mockRejectedValue(new Error('rpc down'));
    const board = await getQuestBoard(supabase, ME, NOW);
    expect(repo.listProgress).not.toHaveBeenCalled();
    expect(repo.getSeasonPoints).not.toHaveBeenCalled();
    expect(board).toEqual({ daily: [], weekly: [], streak: 0, season: null });
  });
});

describe('quests.getSeasonTrack (MV-W05-03)', () => {
  const SEASON = '00000000-0000-4000-8000-00000000f001';
  it('returns null when no season is running', async () => {
    repo.getActiveSeason.mockResolvedValue(null);
    expect(await getSeasonTrack(supabase, ME, new Date('2026-11-06T00:00:00Z'))).toBeNull();
  });

  it('derives milestone statuses from points + the ledger keys that exist', async () => {
    repo.getActiveSeason.mockResolvedValue({
      id: SEASON,
      name: "Founders' Season",
      theme: 'founders',
      starts_at: '2026-11-10T00:00:00.000Z',
      ends_at: '2027-01-05T00:00:00.000Z',
      track: [
        { points: 50, reward_credits: 5, label: 'Warm-up' },
        { points: 150, reward_credits: 10, label: 'On the road' },
        {
          points: 300,
          reward_credits: 25,
          label: 'Season finisher',
          reward_item_sku: 'trophy_season_finisher',
        },
      ],
    });
    repo.getSeasonPoints.mockResolvedValue(120);
    repo.listOwnLedgerKeys.mockResolvedValue(new Set([`season:${SEASON}:1:${ME}`]));
    const view = await getSeasonTrack(supabase, ME, new Date('2026-12-30T12:00:00Z'));
    expect(view?.season.points).toBe(120);
    expect(view?.milestones.map((m) => [m.reached, m.paid])).toEqual([
      [true, true],
      [false, false],
      [false, false],
    ]);
    expect(view?.next?.index).toBe(2);
    expect(view?.percent).toBe(70);
    expect(view?.daysLeft).toBe(6);
    expect(view?.finisherItemSku).toBe('trophy_season_finisher');
    expect(repo.listOwnLedgerKeys).toHaveBeenCalledWith(supabase, ME, [
      `season:${SEASON}:1:${ME}`,
      `season:${SEASON}:2:${ME}`,
      `season:${SEASON}:3:${ME}`,
    ]);
  });
});
