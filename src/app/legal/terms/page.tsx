import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of use',
};

// F-14 legal link. DRAFT pilot terms written to describe how the product actually works today
// (offline settlement, token packs, invite-only pilot); Sreejith / Hypermax FZE counsel review this
// before the public launch — see PROGRESS.md › Blockers. Public route (proxy.ts).
export default function TermsPage() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Terms of use</h1>
      <p className="page-sub">Pilot draft · last updated 20 October 2026</p>
      <div className="panel legal-body">
        <p>
          Tiny Torque (also called Mini Vault) is operated by Hypermax FZE and is currently an
          invite-only pilot for diecast collectors in the UAE and India. By creating an account you
          agree to these terms.
        </p>
        <h2>Your garage and profile</h2>
        <ul>
          <li>You own the photos and details you add. You give us permission to store and display them to run the service, including on your public profile for cars you mark public.</li>
          <li>Keep names, handles, bios and listings respectful and free of offensive language. We may remove content or suspend accounts that break this.</li>
        </ul>
        <h2>Marketplace, offers and trades</h2>
        <ul>
          <li>Tiny Torque connects collectors. Payment and hand-over happen between you and the other collector, offline. We do not hold money, take commission or guarantee any deal.</li>
          <li>Describe cars honestly. Reports of misleading listings are reviewed and may lead to removal or suspension.</li>
        </ul>
        <h2>Tokens</h2>
        <ul>
          <li>Tokens are bought in one-time packs and spent on listing slots, AI scan packs and Pro time. They have no cash value, cannot be transferred, and are refunded only where the law requires or at our discretion.</li>
        </ul>
        <h2>Your account</h2>
        <ul>
          <li>You can export your data and delete your account at any time from Settings. Deleting anonymises your profile and removes your cars and listings; token purchase records are kept for accounting.</li>
          <li>We may change these terms during the pilot; we will tell you in the app when we do.</li>
        </ul>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Questions: hello@tinytorque.hypermaxsolutions.com · <Link href="/legal/privacy">Privacy policy</Link>
        </p>
      </div>
    </main>
  );
}
