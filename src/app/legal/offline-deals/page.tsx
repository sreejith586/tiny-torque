import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Offline deals',
};

// MV-S10-05 (F-15): the offline-deal disclaimer (D-003 — deals settle offline; no escrow, no
// commission). Pilot DRAFT for Hypermax FZE counsel, like the other /legal pages (D-080).
// Public route (proxy.ts /legal/*).
export default function OfflineDealsPage() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Offline deals</h1>
      <p className="page-sub">Pilot draft · last updated 12 November 2026</p>
      <div className="panel legal-body">
        <p>
          Tiny Torque helps collectors find each other. The deal itself — paying, handing over,
          shipping — happens between the two of you, outside the app.
        </p>
        <h2>What Tiny Torque does</h2>
        <ul>
          <li>
            Shows listings, carries offers and trade proposals, and opens a chat once an offer is
            accepted.
          </li>
          <li>Lets the seller mark a car sold and the buyer leave a review afterwards.</li>
          <li>Reviews reports and can remove listings or suspend accounts.</li>
        </ul>
        <h2>What Tiny Torque does not do</h2>
        <ul>
          <li>
            We never take, hold or pass on payment for a car. There is no escrow and no commission.
          </li>
          <li>
            We do not inspect, authenticate, grade or value any car, and we do not verify who a
            collector is.
          </li>
          <li>We do not ship anything and are not a party to your sale or trade.</li>
          <li>
            We cannot refund money you paid another collector or recover a car you handed over.
          </li>
        </ul>
        <h2>Deal safely</h2>
        <ul>
          <li>
            Meet in a public place, or use a payment and courier you both trust and can trace.
          </li>
          <li>
            Ask for extra photos in the chat before you pay. Check card, blister and wheels against
            the listing.
          </li>
          <li>
            Be wary of anyone who wants to move off the chat immediately, asks for a deposit, or
            rushes you.
          </li>
          <li>Keep the chat: it is your record of what was agreed.</li>
          <li>
            Cross-border deals are allowed, but customs, duties and courier rules are yours to
            check.
          </li>
        </ul>
        <h2>If something goes wrong</h2>
        <ul>
          <li>
            Report the listing or the collector from their page — see{' '}
            <Link href="/legal/abuse">Abuse and reporting</Link>.
          </li>
          <li>
            For theft, fraud or threats, contact your local police; we will cooperate with a lawful
            request.
          </li>
        </ul>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Questions: hello@tinytorque.hypermaxsolutions.com ·{' '}
          <Link href="/legal/terms">Terms of use</Link>
        </p>
      </div>
    </main>
  );
}
