import { describe, expect, it } from 'vitest';
import { buildCsp, securityHeaders } from './security-headers.mjs';

function directive(csp: string, name: string): string[] {
  const d = csp.split('; ').find((p) => p.startsWith(`${name} `));
  return d ? d.split(' ').slice(1) : [];
}

describe('security headers (MV-S10-01)', () => {
  const csp = buildCsp({
    supabaseUrl: 'https://abcd.supabase.co',
    posthogHost: 'https://eu.i.posthog.com',
  });

  it('locks down framing, plugins, base and form targets', () => {
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'", 'https://checkout.stripe.com']);
  });

  it('allows exactly the backends the app talks to', () => {
    const connect = directive(csp, 'connect-src');
    expect(connect).toContain('https://abcd.supabase.co');
    expect(connect).toContain('wss://abcd.supabase.co');
    expect(connect).toContain('https://eu.i.posthog.com');
    expect(connect).toContain('https://*.sentry.io');
    expect(connect).not.toContain('*');
    expect(directive(csp, 'img-src')).toContain('https://*.supabase.co');
  });

  it('never allows eval or the preview toolbar in production', () => {
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('vercel.live');
    expect(directive(csp, 'script-src')).not.toContain('*');
  });

  it('relaxes only what dev and preview need', () => {
    const dev = buildCsp({ dev: true });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(buildCsp({ preview: true }), 'script-src')).toContain('https://vercel.live');
  });

  it('survives a missing or malformed Supabase URL', () => {
    expect(directive(buildCsp({ supabaseUrl: 'not a url' }), 'connect-src')).toContain(
      'https://*.supabase.co'
    );
  });

  it('ships the full header set', () => {
    const keys = securityHeaders().map((h) => h.key);
    expect(keys).toEqual([
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Cross-Origin-Opener-Policy',
      'Permissions-Policy',
    ]);
  });
});
