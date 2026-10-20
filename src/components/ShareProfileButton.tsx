'use client';

import { useState } from 'react';
import { ShareIcon } from './icons';

// F-14 share sheet: the Web Share API where it exists (mobile), clipboard copy where it doesn't.
// The shared URL carries the OG image route (/u/{handle}/opengraph-image) via the page metadata.
export default function ShareProfileButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled the share sheet, or clipboard is unavailable — nothing to report
    }
  }

  return (
    <button
      type="button"
      className="btn-secondary"
      style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}
      onClick={share}
      aria-label="Share this profile"
    >
      <ShareIcon size={14} />
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
