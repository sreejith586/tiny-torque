// Reusable paywall (MV-S3-06/S7-06, F-11). Shown when a free-plan limit is hit. The CTA now links
// to the token store (S7) instead of a disabled "coming soon" button.
import Link from 'next/link';

type PaywallContext = 'scan' | 'photos' | 'listings' | 'world';

const COPY: Record<PaywallContext, { title: string; body: string; cta: string }> = {
  scan: {
    title: 'Out of scans this month',
    body: 'You’ve used your free AI scans for this 30-day period. Buy a scan pack or upgrade to Pro for a much higher quota.',
    cta: 'Buy a scan pack',
  },
  photos: {
    title: 'More photos is a Pro feature',
    body: 'The free plan includes 1 photo per car. Upgrade to Pro for up to 8 photos each.',
    cta: 'Upgrade to Pro',
  },
  listings: {
    title: 'Listing limit reached',
    body: 'Free members can keep 2 active listings. Buy an extra slot or upgrade to Pro for unlimited listings.',
    cta: 'Get more listing slots',
  },
  world: {
    title: 'Not enough credits',
    body: 'Garage upgrades and items are paid with the same tokens as everything else. Top up and come back.',
    cta: 'Get tokens',
  },
};

export default function Paywall({ context }: { context: PaywallContext }) {
  const c = COPY[context];
  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <h3 style={{ fontSize: 16 }}>{c.title}</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {c.body}
      </p>
      <Link href="/tokens" className="btn-primary" style={{ marginTop: 14, display: 'block' }}>
        {c.cta}
      </Link>
    </div>
  );
}
