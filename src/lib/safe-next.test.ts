import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next';

describe('safeNextPath (MV-S11-04)', () => {
  it('keeps plain in-app paths, with query and hash', () => {
    expect(safeNextPath('/garage')).toBe('/garage');
    expect(safeNextPath('/market/abc?from=share#offers')).toBe('/market/abc?from=share#offers');
    expect(safeNextPath('/tokens/history')).toBe('/tokens/history');
  });

  it('rejects anything that could leave the site', () => {
    for (const bad of [
      'https://evil.example/x',
      '//evil.example/x',
      '/\\evil.example',
      'javascript:alert(1)',
      'garage',
      '/\u0000garage',
      '',
      null,
      undefined,
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it('never sends a signed-in collector back to the auth screens or internals', () => {
    for (const bad of [
      '/login',
      '/login?next=/garage',
      '/onboarding',
      '/api/v1/world/me',
      '/_next/static/x.js',
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it('rejects absurdly long values', () => {
    expect(safeNextPath('/' + 'a'.repeat(600))).toBeNull();
  });
});
