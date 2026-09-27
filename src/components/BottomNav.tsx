'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Mobile-first bottom tab bar, matching the prototype's tab structure:
// Garage, Market, Add, Offers, Profile. Kept simple/real rather than
// pixel-perfect to the prototype (a later polish pass).
const TABS: ReadonlyArray<{ href: string; label: string; icon: string; isAdd?: boolean }> = [
  { href: '/garage', label: 'Garage', icon: '\u{1F3E0}' },
  { href: '/market', label: 'Market', icon: '\u{1F6D2}' },
  { href: '/garage/add', label: 'Add', icon: '+', isAdd: true },
  { href: '/offers', label: 'Offers', icon: '\u{1F4E9}' },
  { href: '/profile', label: 'Profile', icon: '\u{1F464}' },
];

const HIDDEN_ON = ['/', '/login', '/onboarding'];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname && HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const active = pathname === tab.href || (tab.href !== '/garage/add' && pathname?.startsWith(tab.href + '/'));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`nav-item ${tab.isAdd ? 'nav-add' : ''} ${active ? 'active' : ''}`}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
