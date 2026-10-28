import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy policy',
};

// F-14 legal link. DRAFT written from what the app actually stores and shares (03-data-model.md,
// rule 15 / D-015); counsel review before public launch — see PROGRESS.md › Blockers.
export default function PrivacyPage() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Privacy policy</h1>
      <p className="page-sub">Pilot draft · last updated 20 October 2026</p>
      <div className="panel legal-body">
        <h2>What we store</h2>
        <ul>
          <li>Your sign-in email or mobile number, display name, handle, country and city, optional bio, profile photo and banner.</li>
          <li>The cars in your garage, their photos and notes, your listings, offers, deal messages, reviews and wishlist.</li>
          <li>Token purchases (through Stripe — we never see your card number), your token balance and what tokens were spent on.</li>
          <li>Activity events (for example &quot;item added&quot;, &quot;deal completed&quot;) that power your XP, levels and badges, plus basic product analytics.</li>
        </ul>
        <h2>What other collectors see</h2>
        <ul>
          <li>Your public profile: name, handle, photo, banner, bio, country/city, level, rating, member-since date, the cars you mark public, your active listings and your reviews.</li>
          <li>Your mobile number and email are never shown to other collectors. Deal chat happens inside the app.</li>
        </ul>
        <h2>Where it lives</h2>
        <ul>
          <li>Data is hosted on Supabase (Mumbai region) and Vercel. Photos are stored in private buckets and served through short-lived signed links.</li>
          <li>AI photo scans send the photo you choose to Anthropic to read the card; it is not used to train models.</li>
        </ul>
        <h2>Your choices</h2>
        <ul>
          <li>Export everything from Settings › Your data. Delete your account from Settings; this anonymises your profile and removes your cars and listings. Purchase records are kept for accounting as the law requires.</li>
          <li>Block or report any collector from their profile or listing.</li>
        </ul>
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Questions: hello@tinytorque.hypermaxsolutions.com · <Link href="/legal/terms">Terms of use</Link>
        </p>
      </div>
    </main>
  );
}
