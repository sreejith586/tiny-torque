import type { Metadata } from 'next';
import { Oswald, Work_Sans } from 'next/font/google';
import './globals.css';
import ThemeInit from '@/components/ThemeInit';
import BottomNav from '@/components/BottomNav';

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
    <html lang="en" className={`${oswald.variable} ${workSans.variable}`}>
      <body>
        <ThemeInit />
        <div className="page">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
