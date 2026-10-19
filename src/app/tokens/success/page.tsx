import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPurchaseBySessionId } from '@/domain/tokens';
import TokensSuccessView from '@/components/TokensSuccessView';

export const metadata: Metadata = {
  title: 'Purchase successful',
};

export default async function TokensSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/tokens');
  if (!sessionId) redirect('/tokens');

  const purchase = await getPurchaseBySessionId(supabase, sessionId);

  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <h1 className="page-heading">Purchase</h1>
      <TokensSuccessView sessionId={sessionId} initialPurchase={purchase} />
    </main>
  );
}
