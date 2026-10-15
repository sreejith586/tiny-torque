import type { Metadata, Viewport } from 'next';
import { THEMES } from '@/lib/theme';
import { APP_DEFAULT_THEME } from '@/lib/theme-default';
import localFont from 'next/font/local';
import './globals.css';
import './nav-rail.css';
import shell from './layout.module.css';
import ThemeInit from '@/components/ThemeInit';
import ThemeStyles, { THEME_BOOT_SCRIPT } from '@/components/ThemeStyles';
import AnalyticsInit from '@/components/AnalyticsInit';
import AppHeader from '@/components/AppHeader';
import BottomNav from '@/components/BottomNav';
import Providers from '@/components/Providers';
import Splash from '@/components/Splash';

// Self-hosted (same faces/weights as Varun's Google Fonts setup — D-027):
// no third-party request at build or runtime, works behind proxies/offline.
const oswald = localFont({
  src: [
    { path: '../fonts/oswald-latin-500-normal.woff2', weight: '500' },
    { path: '../fonts/oswald-latin-600-normal.woff2', weight: '600' },
    { path: '../fonts/oswald-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--font-oswald',
  display: 'swap',
});

const workSans = localFont({
  src: [
    { path: '../fonts/work-sans-latin-400-normal.woff2', weight: '400' },
    { path: '../fonts/work-sans-latin-500-normal.woff2', weight: '500' },
    { path: '../fonts/work-sans-latin-600-normal.woff2', weight: '600' },
  ],
  variable: '--font-work-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Tiny Torque — Diecast Collection Tracker',
    template: '%s · Tiny Torque',
  },
  description:
    'Track your diecast car collection, avoid buying duplicates, and connect with other collectors — Tiny Torque is the home for your garage.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    // iOS doesn't read the web manifest's `display: standalone` — these are the tags that
    // actually drop Safari's chrome when launched from the home screen there.
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tiny Torque',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Covers the notch/home-indicator safe areas (env(safe-area-inset-*), already used
  // throughout globals.css) instead of letterboxing behind them.
  viewportFit: 'cover',
  // Browser-chrome colour can't read a CSS variable (it's painted before any stylesheet
  // runs), so this pulls the literal value from the same source of truth as the theme itself
  // instead of a second hardcoded hex — the default theme's orange (D-054).
  themeColor: THEMES[APP_DEFAULT_THEME].vars['--orange'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${workSans.variable} theme-3d`}
      data-theme="aurora-glass"
      suppressHydrationWarning
    >
      <head>
        {/* Next's `appleWebApp.capable` metadata only emits the newer unprefixed
            mobile-web-app-capable tag; older iOS versions still need this exact
            apple-prefixed one to drop Safari's chrome when launched from the home screen. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <ThemeStyles />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Splash />
        <ThemeInit />
        <AnalyticsInit />
        <Providers>
          <div className={`page ${shell.shell}`}>
            <AppHeader />
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
