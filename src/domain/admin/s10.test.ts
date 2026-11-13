import { describe, expect, it } from 'vitest';
import {
  createInvites,
  expireInvite,
  formatRevenue,
  generateInviteCode,
  inviteCohortSummary,
  isInviteOpen,
  overviewCosts,
  pilotKpiRatios,
  revenueByCurrency,
  SMS_OTPS_PER_ACTIVE_USER,
  SMS_UNIT_COST_USD,
} from './service';
import type { AdminOverviewRow, InviteRow, PilotKpiRow } from './types';
import type { Client } from '@/lib/supabase/types';

const NOW = new Date('2026-11-12T10:00:00.000Z');

function invite(over: Partial<InviteRow> = {}): InviteRow {
  return {
    code: 'TT-AAAA-BBBB',
    cohort: 'uae-collectors',
    created_by: 'admin-1',
    created_at: '2026-11-01T00:00:00.000Z',
    expires_at: null,
    max_uses: 1,
    used_count: 0,
    ...over,
  };
}

function kpi(over: Partial<PilotKpiRow> = {}): PilotKpiRow {
  return {
    week_start: '2026-11-09',
    signups: 0,
    activated_7d: 0,
    signups_published: 0,
    retained_w4: 0,
    items_added: 0,
    scans: 0,
    scan_candidates: 0,
    scan_accepted: 0,
    scan_cost_usd: 0,
    listings_published: 0,
    publishers: 0,
    listings_live: 0,
    offers_created: 0,
    deals_completed: 0,
    deals_reviewed: 0,
    wau: 0,
    token_purchases: 0,
    token_buyers: 0,
    token_revenue: {},
    reports_created: 0,
    reports_actioned: 0,
    ...over,
  };
}

/** A client that records inserts / updates on `invites` and every emitted event. */
function mockClient() {
  const inserted: unknown[][] = [];
  const events: Array<{ table: string; row: Record<string, unknown> }> = [];
  const rpcs: Array<[string, Record<string, unknown>]> = [];
  const client = {
    inserted,
    events,
    rpcs,
    rpc(name: string, args: Record<string, unknown>) {
      rpcs.push([name, args]);
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      return {
        insert(rows: unknown) {
          if (table === 'invites') {
            inserted.push(rows as unknown[]);
            return {
              select: () =>
                Promise.resolve({
                  data: (rows as Array<Record<string, unknown>>).map((r) => ({
                    ...r,
                    used_count: 0,
                    created_at: NOW.toISOString(),
                  })),
                  error: null,
                }),
            };
          }
          events.push({ table, row: rows as Record<string, unknown> });
          return Promise.resolve({ data: null, error: null });
        },
        update(patch: Record<string, unknown>) {
          return {
            eq: (_col: string, code: string) => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: invite({ code, used_count: 2, max_uses: 5, ...patch }),
                    error: null,
                  }),
              }),
            }),
          };
        },
      };
    },
  };
  return client as unknown as Client & typeof client;
}

function emitted(c: ReturnType<typeof mockClient>): Array<Record<string, unknown>> {
  // domain/events writes either through the emit_event RPC or a domain_events insert.
  return [
    ...c.rpcs.filter(([name]) => name === 'emit_event').map(([, args]) => args),
    ...c.events.filter((e) => e.table === 'domain_events').map((e) => e.row),
  ];
}

describe('invite codes (MV-S10-04)', () => {
  it('generates TT-XXXX-XXXX codes from the unambiguous alphabet', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^TT-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(generateInviteCode(() => 0)).toBe('TT-AAAA-AAAA');
  });

  it('knows when a code can still be redeemed', () => {
    expect(isInviteOpen(invite(), NOW)).toBe(true);
    expect(isInviteOpen(invite({ used_count: 1 }), NOW)).toBe(false);
    expect(isInviteOpen(invite({ expires_at: '2026-11-12T09:59:59.000Z' }), NOW)).toBe(false);
    expect(isInviteOpen(invite({ expires_at: '2026-11-13T00:00:00.000Z' }), NOW)).toBe(true);
  });

  it('summarises codes per cohort, biggest first', () => {
    const rows = [
      invite({ cohort: 'india-shops', max_uses: 10, used_count: 4 }),
      invite({ cohort: 'uae-collectors' }),
      invite({ cohort: 'uae-collectors', used_count: 1 }),
      invite({ cohort: null, expires_at: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(inviteCohortSummary(rows, NOW)).toEqual([
      { cohort: 'india-shops', codes: 1, seats: 10, used: 4, open: 1 },
      { cohort: 'uae-collectors', codes: 2, seats: 2, used: 1, open: 1 },
      { cohort: '—', codes: 1, seats: 1, used: 0, open: 0 },
    ]);
  });

  it('mints a batch for one cohort and logs invite.created without the codes', async () => {
    const c = mockClient();
    const rows = await createInvites(
      c,
      'admin-1',
      { cohort: 'uae-shops', count: '3', maxUses: '5', expiresInDays: '30' },
      NOW
    );
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.code)).size).toBe(3);
    expect(c.inserted[0]).toHaveLength(3);
    expect(c.inserted[0]![0]).toMatchObject({
      cohort: 'uae-shops',
      max_uses: 5,
      created_by: 'admin-1',
      expires_at: '2026-12-12T10:00:00.000Z',
    });
    const events = emitted(c);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).toContain('invite.created');
    expect(JSON.stringify(events[0])).not.toContain(rows[0]!.code);
  });

  it('rejects a malformed batch before touching the database', async () => {
    const c = mockClient();
    await expect(
      createInvites(c, 'admin-1', { cohort: 'UAE Shops!', count: 3, maxUses: 1 })
    ).rejects.toThrow();
    await expect(
      createInvites(c, 'admin-1', { cohort: 'uae-shops', count: 1000, maxUses: 1 })
    ).rejects.toThrow();
    expect(c.inserted).toHaveLength(0);
  });

  it('no expiry when the days field is empty or 0', async () => {
    const c = mockClient();
    const rows = await createInvites(
      c,
      'admin-1',
      { cohort: 'founders', count: 1, maxUses: 1, expiresInDays: 0 },
      NOW
    );
    expect(rows[0]!.expires_at).toBeNull();
  });

  it('expires a code and logs invite.expired', async () => {
    const c = mockClient();
    const row = await expireInvite(c, 'admin-1', 'TT-AAAA-BBBB');
    expect(row.expires_at).not.toBeNull();
    expect(JSON.stringify(emitted(c)[0])).toContain('invite.expired');
  });
});

describe('Overview costs (MV-S10-04)', () => {
  const row: AdminOverviewRow = {
    users: 40,
    users_new_7d: 6,
    items: 900,
    listings_active: 55,
    offers_total: 30,
    offers_pending: 4,
    deals_completed: 7,
    scans_month: 120,
    scan_cost_usd_month: 1.2345,
    token_purchases_month: 3,
    token_revenue_month: { AED: 57, 'INR ': '499' },
    phone_users_active_month: 12,
    open_reports: 1,
    feedback_7d: 2,
  };

  it('derives the scan, revenue and SMS tiles', () => {
    const costs = overviewCosts(row);
    expect(costs.scanCostUsd).toBeCloseTo(1.2345);
    expect(costs.tokenRevenue).toEqual({ AED: 57, INR: 499 });
    expect(costs.smsEstimateUsd).toBe(1.2);
    expect(SMS_OTPS_PER_ACTIVE_USER * SMS_UNIT_COST_USD).toBeCloseTo(0.1);
  });

  it('formats revenue per currency and never sums across them', () => {
    expect(formatRevenue({ INR: 499, AED: 57 })).toBe('AED 57.00 · INR 499.00');
    expect(formatRevenue({})).toBe('—');
    expect(revenueByCurrency(null)).toEqual({});
    expect(revenueByCurrency({ AED: 'x' })).toEqual({});
  });
});

describe('pilot KPI ratios (MV-S10-03, 01 §6)', () => {
  it('computes each ratio against its own denominator', () => {
    const r = pilotKpiRatios(
      kpi({
        signups: 10,
        activated_7d: 6,
        signups_published: 4,
        retained_w4: 5,
        items_added: 50,
        scan_accepted: 20,
        scan_candidates: 25,
        listings_live: 40,
        offers_created: 8,
        wau: 25,
        token_buyers: 2,
        reports_actioned: 1,
      })
    );
    expect(r).toEqual({
      activation: 0.6,
      scanShare: 0.4,
      scanAcceptance: 0.8,
      publisherShare: 0.4,
      offersPerListing: 0.2,
      tokenConversion: 0.08,
      retentionW4: 0.5,
      reportsActionedShare: 0.03,
    });
  });

  it('is null, not 0 or ∞, for an empty week', () => {
    const r = pilotKpiRatios(kpi());
    expect(Object.values(r).every((v) => v === null)).toBe(true);
  });
});
