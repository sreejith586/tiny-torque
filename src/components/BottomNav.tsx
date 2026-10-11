'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_SHELL_HIDDEN_ON } from '@/lib/shell-routes';
import { AddIcon, GarageIcon, MarketIcon, OffersIcon, ProfileIcon } from './icons';

// Mobile-first bottom tab bar, matching the prototype's tab structure and icon set
// (garage-log-147.html, D-044): Garage, Market, Add Car, Deals, Profile. The /offers route and
// domain naming stay as-is (matches the prototype's own data-screen="offers" + F-08's spec
// naming) — only the visible label text follows the prototype's "Deals"/"Add Car" copy.
const TABS: ReadonlyArray<{
  href: string;
  label: string;
  Icon: typeof GarageIcon;
  isAdd?: boolean;
}> = [
  { href: '/garage', label: 'Garage', Icon: GarageIcon },
  { href: '/market', label: 'Market', Icon: MarketIcon },
  { href: '/garage/add', label: 'Add Car', Icon: AddIcon, isAdd: true },
  { href: '/offers', label: 'Deals', Icon: OffersIcon },
  { href: '/profile', label: 'Profile', Icon: ProfileIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname && APP_SHELL_HIDDEN_ON.includes(pathname)) return null;

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
