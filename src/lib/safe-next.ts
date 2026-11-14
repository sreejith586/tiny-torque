// Post-sign-in redirect target (MV-S11-04). `/login?next=…` is set by the proxy and by pages; it is
// attacker-controllable, so only a plain same-origin path is ever honoured — never a scheme,
// a protocol-relative `//host`, a backslash trick, or the auth screens themselves.

const BLOCKED_PREFIXES = ['/login', '/onboarding', '/api/', '/_next/'];

/** Returns `raw` when it is a safe in-app path, otherwise null. Pure. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\u0000-\u001f]/.test(value)) return null;
  // Parse against a dummy origin: anything that escapes it is not a path.
  let url: URL;
  try {
    url = new URL(value, 'https://app.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'https://app.invalid') return null;
  if (
    BLOCKED_PREFIXES.some(
      (p) => url.pathname === p.replace(/\/$/, '') || url.pathname.startsWith(p)
    )
  ) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
