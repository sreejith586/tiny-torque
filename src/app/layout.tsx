import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import ThemeInit from '@/components/ThemeInit';
import ThemeStyles, { THEME_BOOT_SCRIPT } from '@/components/ThemeStyles';
import BottomNav from '@/components/BottomNav';

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
    default: 'Mini Vault — Diecast Collection Tracker',
    template: '%s · Mini Vault',
  },
  description:
    'Track your diecast car collection, avoid buying duplicates, and connect with other collectors — Mini Vault is the home for your garage.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${workSans.variable}`} data-theme="workshop-light" suppressHydrationWarning>
      <head>
        <ThemeStyles />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ThemeInit />
        <div className="page">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
