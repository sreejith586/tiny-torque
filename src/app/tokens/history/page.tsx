import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listLedgerForUser } from '@/domain/tokens';
import TokenHistoryView from '@/components/TokenHistoryView';
import { FIXTURE_LEDGER, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Token history',
};

export default async function TokenHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const header = (
    <>
      <h1 className="page-heading">Token history</h1>
      <p className="page-sub">Every credit and debit to your balance.</p>
    </>
  );

  if (isVisualHarness(await searchParams)) {
    return (
      <main style={{ padding: '20px 16px', flex: 1 }}>
        {header}
        <TokenHistoryView ledger={FIXTURE_LEDGER} />
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/tokens/history');

  const ledger = await listLedgerForUser(supabase, user.id);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      {header}
      <TokenHistoryView ledger={ledger} />
    </main>
  );
}
