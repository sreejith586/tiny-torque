'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_SHELL_HIDDEN_ON } from '@/lib/shell-routes';
import { AddIcon, GarageIcon, MarketIcon, OffersIcon, ProfileIcon, WorldIcon } from './icons';

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

const WORLD_TAB = { href: '/world', label: 'World', Icon: WorldIcon } as const;

/** `worldEnabled` (MV-W02-01, D-084 proposed): the Collectors World tab appears only for users the
 *  `world` flag is on for — the bar is the prototype's five tabs otherwise (D-027). */
export default function BottomNav({ worldEnabled = false }: { worldEnabled?: boolean }) {
  const pathname = usePathname();

  if (pathname && APP_SHELL_HIDDEN_ON.includes(pathname)) return null;

  const tabs = worldEnabled ? [...TABS.slice(0, 2), WORLD_TAB, ...TABS.slice(2)] : TABS;

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href !== '/garage/add' && pathname?.startsWith(tab.href + '/'));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`nav-item ${'isAdd' in tab && tab.isAdd ? 'nav-add' : ''} ${active ? 'active' : ''}`}
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
