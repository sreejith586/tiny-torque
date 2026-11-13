import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Abuse and reporting',
};

// MV-S10-05 (F-15): abuse policy — what gets actioned, how to report, what the moderation queue
// does with it (dismiss / remove listing / warn / suspend). Pilot DRAFT for counsel (D-080).
// The rules themselves live in /legal/guidelines; this page is the enforcement side.
export default function AbusePolicyPage() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Abuse and reporting</h1>
      <p className="page-sub">Pilot draft · last updated 12 November 2026</p>
      <div className="panel legal-body">
        <p>
          The <Link href="/legal/guidelines">community guidelines</Link> say what is welcome here.
          This page says what we act on and how.
        </p>
        <h2>What we act on</h2>
        <ul>
          <li>
            Harassment, threats, hate speech, sexual content, or sharing someone&apos;s private
            details.
          </li>
          <li>Fake, misleading or stolen listings; photos that are not of the car being sold.</li>
          <li>
            Scams: taking payment and not delivering, asking for deposits, impersonating another
            collector or shop.
          </li>
          <li>Spam, repeated unwanted offers or messages, and attempts to get around a block.</li>
          <li>
            Counterfeit items sold as genuine, or anything illegal to sell where you or the buyer
            live.
          </li>
          <li>Abusing tokens, scans, invites or reports — including false reports.</li>
        </ul>
        <h2>How to report</h2>
        <ul>
          <li>
            Use Report on a listing, a collector&apos;s profile or a chat message. Pick a reason and
            add a note.
          </li>
          <li>
            Block the collector if you do not want to hear from them: it hides you from each other
            and stops offers and chat both ways.
          </li>
          <li>
            You can send up to 10 reports a day. For anything else, use Settings › Send feedback.
          </li>
        </ul>
        <h2>What happens next</h2>
        <ul>
          <li>
            Every report goes to a moderator, who sees what was reported and your note — not your
            phone number.
          </li>
          <li>
            The outcome is one of: no action, listing removed, a warning, or a suspension. Suspended
            accounts cannot list, offer or chat until it ends.
          </li>
          <li>
            Serious or repeated abuse ends the account. Tokens on a closed account are not refunded
            unless the law requires it.
          </li>
          <li>We do not tell the reported collector who reported them.</li>
        </ul>
        <h2>If you were actioned</h2>
        <ul>
          <li>
            You can ask for a second look by writing to the address below from your account email,
            within 14 days.
          </li>
        </ul>
        <h2>Emergencies</h2>
        <ul>
          <li>
            We are not an emergency service. If you are in danger or have been defrauded, contact
            your local police first.
          </li>
        </ul>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Contact: hello@tinytorque.hypermaxsolutions.com ·{' '}
          <Link href="/legal/offline-deals">Offline deals</Link>
        </p>
      </div>
    </main>
  );
}
