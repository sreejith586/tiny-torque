import { describe, expect, it } from 'vitest';
import {
  HANDLE_COOLDOWN_DAYS,
  isHandleCooldownActive,
  slugifyHandle,
  defaultCountryCode,
  anonymisedProfileFields,
  buildExportPayload,
} from '../service';
import type { ProfileRow } from '../types';
import type { CollectionItemRow } from '@/domain/garage/types';

const COUNTRIES = [
  { code: 'AE', dial_code: '+971' },
  { code: 'IN', dial_code: '+91' },
];

describe('identity.slugifyHandle', () => {
  it('lowercases and replaces non-alphanumerics with underscores', () => {
    expect(slugifyHandle('Sree Cars!!')).toBe('sree_cars');
  });
  it('trims leading/trailing underscores', () => {
    expect(slugifyHandle('  @Sree  ')).toBe('sree');
  });
  it('falls back to "collector" when nothing usable is left', () => {
    expect(slugifyHandle('99')).toBe('collector');
    expect(slugifyHandle('!!!')).toBe('collector');
  });
  it('truncates to 19 characters so a numeric suffix still fits under the 24-char limit', () => {
    const long = 'a'.repeat(40);
    expect(slugifyHandle(long).length).toBe(19);
  });
});

describe('identity.isHandleCooldownActive (F-01, 30-day handle change cooldown)', () => {
  it('is inactive when the handle was never changed', () => {
    expect(isHandleCooldownActive(null)).toBe(false);
  });
  it('is active the day after a change', () => {
    const now = new Date('2026-09-29T00:00:00.000Z');
    const changedAt = new Date('2026-09-28T00:00:00.000Z').toISOString();
    expect(isHandleCooldownActive(changedAt, now)).toBe(true);
  });
  it(`is inactive ${HANDLE_COOLDOWN_DAYS} days after a change`, () => {
    const changedAt = new Date('2026-09-01T00:00:00.000Z');
    const now = new Date(changedAt.getTime() + HANDLE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000 + 1000);
    expect(isHandleCooldownActive(changedAt.toISOString(), now)).toBe(false);
  });
});

describe('identity.defaultCountryCode (F-01 onboarding country prefill)', () => {
  it('matches the phone number dial code', () => {
    expect(defaultCountryCode({ phone: '+919999900001' }, COUNTRIES)).toBe('IN');
    expect(defaultCountryCode({ phone: '+971501234567' }, COUNTRIES)).toBe('AE');
  });
  it('defaults to AE for email sign-ins (no phone)', () => {
    expect(defaultCountryCode({ email: 'someone@example.com' }, COUNTRIES)).toBe('AE');
  });
  it('defaults to AE when the phone matches no enabled country', () => {
    expect(defaultCountryCode({ phone: '+15551234567' }, COUNTRIES)).toBe('AE');
  });
});

describe('identity.anonymisedProfileFields (F-14 delete account, MV-S1-08)', () => {
  const fields = anonymisedProfileFields(new Date('2026-09-30T12:00:00.000Z'));

  it('soft-deletes by stamping deleted_at', () => {
    expect(fields.deleted_at).toBe('2026-09-30T12:00:00.000Z');
  });
  it('clears every PII / personal free-text column (rule 15: mobile above all)', () => {
    expect(fields.mobile).toBeNull();
    expect(fields.bio).toBeNull();
    expect(fields.city).toBeNull();
    expect(fields.location).toBeNull();
    expect(fields.store_name).toBeNull();
    expect(fields.photo_url).toBeNull();
  });
  it('replaces display_name with a non-null placeholder (column is NOT NULL)', () => {
    expect(fields.display_name).toBe('Deleted collector');
  });
  it('keeps handle and country_code (NOT NULL + constrained; handle is not PII)', () => {
    expect('handle' in fields).toBe(false);
    expect('country_code' in fields).toBe(false);
  });
});

describe('identity.buildExportPayload (F-14 export, MV-S1-08)', () => {
  const profile = { id: 'u1', handle: 'sree', display_name: 'Sree' } as unknown as ProfileRow;
  const items = [{ id: 'i1' }, { id: 'i2' }] as unknown as CollectionItemRow[];

  it('wraps the caller profile + all items in a versioned envelope', () => {
    const payload = buildExportPayload(profile, items);
    expect(payload.format).toBe('mini-vault-export-v1');
    expect(payload.profile).toBe(profile);
    expect(payload.items).toHaveLength(2);
    expect(typeof payload.exported_at).toBe('string');
  });
});
