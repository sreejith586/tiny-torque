'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AddIcon, GarageIcon, MarketIcon, OffersIcon, ProfileIcon } from './icons';

// Mobile-first bottom tab bar, matching the prototype's tab structure and icon set
// (garage-log-147.html, D-044): Garage, Market, Add, Offers, Profile.
const TABS: ReadonlyArray<{
  href: string;
  label: string;
  Icon: typeof GarageIcon;
  isAdd?: boolean;
}> = [
  { href: '/garage', label: 'Garage', Icon: GarageIcon },
  { href: '/market', label: 'Market', Icon: MarketIcon },
  { href: '/garage/add', label: 'Add', Icon: AddIcon, isAdd: true },
  { href: '/offers', label: 'Offers', Icon: OffersIcon },
  { href: '/profile', label: 'Profile', Icon: ProfileIcon },
];

const HIDDEN_ON = ['/', '/login', '/onboarding'];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname && HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href !== '/garage/add' && pathname?.startsWith(tab.href + '/'));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`nav-item ${tab.isAdd ? 'nav-add' : ''} ${active ? 'active' : ''}`}
          >
            <span className="nav-icon">
              <tab.Icon size={20} />
            </span>
            <span className="nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
