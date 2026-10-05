'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { verifyModel, rejectModel } from '@/domain/catalog';
import type { CatalogModelRow } from '@/domain/catalog';

export default function CatalogueProposals({
  models,
  brandNames,
  adminId,
}: {
  models: CatalogModelRow[];
  brandNames: Record<string, string>;
  adminId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: 'verify' | 'reject') {
    setBusy(id);
    try {
      if (action === 'verify') await verifyModel(supabase, id, adminId);
      else await rejectModel(supabase, id);
      router.refresh();
    } catch {
      setBusy(null);
    }
  }

  if (models.length === 0) {
    return <p className="muted">No proposed models awaiting review.</p>;
  }

  return (
    <div>
      {models.map((m) => (
        <div key={m.id} className="toggle-row">
          <span>
            <strong>{brandNames[m.brand_id] ?? '—'}</strong> · {m.name}
            {m.series ? ` · ${m.series}` : ''}
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-secondary"
              style={{ width: 'auto' }}
              disabled={busy === m.id}
              onClick={() => act(m.id, 'verify')}
            >
              Verify
            </button>
            <button
              className="btn-danger"
              style={{ width: 'auto' }}
              disabled={busy === m.id}
              onClick={() => act(m.id, 'reject')}
            >
              Reject
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
