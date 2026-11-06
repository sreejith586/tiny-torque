import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Community guidelines',
};

// MV-W03-08 (F-28): community guidelines v2 (07 §9), the version counsel reviews — written to
// what exists today (garages, guestbooks, visits, kudos, invites; the marketplace). Sections for
// meetups, racing and clubs stay in docs/legal/community-guidelines-v2.md until those ship.
// Public route (proxy.ts /legal/*).
export default function GuidelinesPage() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Community guidelines</h1>
      <p className="page-sub">Pilot draft v2 · last updated 3 November 2026</p>
      <div className="panel legal-body">
        <p>
          Be the collector you&apos;d want to visit. Garages, guestbooks and the marketplace are
          shared spaces — treat them like a friend&apos;s garage.
        </p>
        <h2>Respect</h2>
        <ul>
          <li>
            No harassment, threats, hate speech, sexual content or doxxing (sharing anyone&apos;s
            phone, address, workplace or exact location).
          </li>
          <li>
            Blocks work everywhere: a blocked collector cannot see your garage, visit it, give
            kudos, sign your guestbook or message you — and vice versa.
          </li>
          <li>
            Hosts moderate their own guestbook and can hide any line. Tiny Torque can override any
            host.
          </li>
        </ul>
        <h2>Honesty about cars</h2>
        <ul>
          <li>No promoting counterfeits, or customs passed off as originals.</li>
          <li>
            Describe condition and packaging truthfully. Reviews are for completed deals only.
          </li>
        </ul>
        <h2>Marketplace talk</h2>
        <ul>
          <li>
            Use listings and offers to trade. Deals settle between collectors, off-platform. No
            price talk in guestbooks — link the listing instead.
          </li>
        </ul>
        <h2>Brands and names</h2>
        <ul>
          <li>
            Use brand and series names to describe a car, never to imply sponsorship. No brand logos
            in garage names or signage.
          </li>
          <li>Garage names and guestbook lines pass a clean-language check. Keep it friendly.</li>
        </ul>
        <h2>Tokens fair play</h2>
        <ul>
          <li>
            Tokens are yours to spend in the app, not to trade, gift, sell or farm. No bots,
            multi-accounts, exploits or buying/selling accounts. Exploits are reversed and may cost
            you the account.
          </li>
        </ul>
        <h2>Reporting and what happens next</h2>
        <ul>
          <li>Report any garage, guestbook line, listing or profile from its Report button.</li>
          <li>
            First action within 24 hours, resolution within 72 hours, with an appeal path. Serious
            cases (threats, illegal content) are escalated immediately.
          </li>
          <li>The audit trail is kept so decisions can be reviewed.</li>
        </ul>
        <h2>Adults only</h2>
        <p>
          Tiny Torque and Collectors World are for adults 18+. Accounts found to belong to minors
          are closed.
        </p>
        <p>
          See also the <Link href="/legal/terms">terms of use</Link> and{' '}
          <Link href="/legal/privacy">privacy policy</Link>.
        </p>
      </div>
    </main>
  );
}
