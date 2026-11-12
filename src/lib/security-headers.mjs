// Security response headers (MV-S10-01, F-19) — plain ESM so next.config.mjs can import it and
// Vitest can test it. The policy is an allow-list of the origins the app really talks to:
//   Supabase (REST, auth, storage images, realtime websocket) · PostHog (events + its lazy
//   assets) · Sentry ingest · Stripe Checkout (a redirect out of a Server Action).
// script-src keeps 'unsafe-inline': the App Router's bootstrap and the theme script are inline,
// and nonces would force every page dynamic (D-101 budgets). What the policy does buy: no
// third-party script origin, no plugins, no framing, no <base> hijack, no form posts elsewhere.

/** @param {string | undefined} url */
function origin(url) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ supabaseUrl?: string, posthogHost?: string, dev?: boolean, preview?: boolean }} [opts]
 * @returns {string}
 */
export function buildCsp(opts = {}) {
  const supabase = origin(opts.supabaseUrl);
  const posthog = origin(opts.posthogHost);
  const supabaseHttp = ['https://*.supabase.co', ...(supabase ? [supabase] : [])];
  const supabaseWs = ['wss://*.supabase.co', ...(supabase ? [supabase.replace(/^http/, 'ws')] : [])];
  const posthogAll = ['https://*.posthog.com', ...(posthog ? [posthog] : [])];
  // Vercel's preview toolbar is injected on preview deployments only.
  const vercelLive = opts.preview ? ['https://vercel.live'] : [];

  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(opts.dev ? ["'unsafe-eval'"] : []), ...posthogAll, ...vercelLive],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...supabaseHttp, ...vercelLive],
    'font-src': ["'self'", 'data:'],
    'media-src': ["'self'", 'blob:'],
    'connect-src': [
      "'self'",
      ...supabaseHttp,
      ...supabaseWs,
      ...posthogAll,
      'https://*.sentry.io',
      ...(opts.dev ? ['ws:', 'http://127.0.0.1:*', 'http://localhost:*'] : []),
      ...vercelLive,
      ...(opts.preview ? ['wss://ws-us3.pusher.com'] : []),
    ],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'frame-src': ["'self'", ...vercelLive],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", 'https://checkout.stripe.com'],
  };
  // No upgrade-insecure-requests: HSTS already pins https on the real hosts, and the directive
  // breaks `next start` on http://127.0.0.1 (CI's Lighthouse + Playwright runs) in some browsers.
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${[...new Set(v)].join(' ')}`)
    .join('; ');
}

/**
 * @param {{ supabaseUrl?: string, posthogHost?: string, dev?: boolean, preview?: boolean }} [opts]
 * @returns {Array<{ key: string, value: string }>}
 */
export function securityHeaders(opts = {}) {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(opts) },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(), microphone=(), payment=(), usb=()' },
  ];
}
