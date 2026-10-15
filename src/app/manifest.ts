import type { MetadataRoute } from 'next';
import { THEMES } from '@/lib/theme';
import { APP_DEFAULT_THEME } from '@/lib/theme-default';

// PWA manifest (Next.js file convention — served at /manifest.webmanifest). `display: standalone`
// is what drops the browser chrome (address bar, nav buttons) once installed/launched from the
// home screen; iOS needs its own apple-mobile-web-app-* meta tags for the same effect, set in
// layout.tsx, since Safari doesn't read this file for that part.
export default function manifest(): MetadataRoute.Manifest {
  const theme = THEMES[APP_DEFAULT_THEME].vars;
  return {
    name: 'Tiny Torque — Diecast Collector',
    short_name: 'Tiny Torque',
    description:
      'Track your diecast car collection, avoid buying duplicates, and connect with other collectors.',
    start_url: '/garage',
    display: 'standalone',
    background_color: theme['--bg'],
    theme_color: theme['--orange'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
