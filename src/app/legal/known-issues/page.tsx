import type { Metadata } from 'next';
import Link from 'next/link';
import { KNOWN_ISSUES, KNOWN_ISSUES_UPDATED } from '@/lib/known-issues';

export const metadata: Metadata = {
  title: 'Known issues',
};

// MV-S10-08 (F-19 pilot ops kit): the known-issues page pilot collectors are pointed at before
// they report something. The list is data in src/lib/known-issues.ts — edit it there (and the
// date) as issues are fixed or found. Public route (proxy.ts /legal/*).
export default function KnownIssuesPage() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Known issues</h1>
      <p className="page-sub">Pilot · last updated {KNOWN_ISSUES_UPDATED}</p>
      <div className="panel legal-body">
        <p>
          Things we already know about, so you do not have to report them. Anything else: Settings ›
          Send feedback.
        </p>
        {KNOWN_ISSUES.map((group) => (
          <section key={group.area}>
            <h2>{group.area}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong> — {item.detail}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          Service status:{' '}
          <a href="https://www.vercel-status.com" target="_blank" rel="noopener noreferrer">
            app hosting
          </a>{' '}
          ·{' '}
          <a href="https://status.supabase.com" target="_blank" rel="noopener noreferrer">
            database and sign-in
          </a>{' '}
          · <Link href="/settings">Send feedback</Link>
        </p>
      </div>
    </main>
  );
}
