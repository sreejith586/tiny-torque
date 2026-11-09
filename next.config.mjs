import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/**' },
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/render/image/**' },
    ],
  },
  headers: async () => [
    {
      // MV-S9-02: the browser must re-check the service worker on every load so a new deploy's
      // worker (and its VERSION bump) takes over instead of a day-old cached copy.
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache, max-age=0, must-revalidate' }],
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(), microphone=()' },
      ],
    },
  ],
};

// Sentry wrapping is a no-op without SENTRY_AUTH_TOKEN (no source-map upload); safe in CI/preview.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  disableLogger: true,
  // MV-S9-03: Session Replay is never enabled (replaysOnErrorSampleRate: 0) and debug statements
  // are dev-only, so tree-shake both out of every route's first-load JS.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
