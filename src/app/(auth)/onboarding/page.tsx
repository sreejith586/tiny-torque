import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listEnabledCountries, defaultCountryCode, hasRedeemedInvite } from '@/domain/identity';
import { isFlagEnabled } from '@/domain/flags';
import OnboardingWizard from '@/components/OnboardingWizard';
import { FIXTURE_COUNTRIES, isVisualHarness } from '@/lib/visual-fixtures';

export const metadata: Metadata = {
  title: 'Set up your profile',
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isVisualHarness(await searchParams)) {
    return (
      <main style={{ padding: '48px 20px', flex: 1 }}>
        <OnboardingWizard
          userId="00000000-0000-4000-8000-000000000001"
          countries={FIXTURE_COUNTRIES}
          inviteOnly={false}
          defaultCountry="AE"
        />
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [countries, inviteFlag, redeemed] = await Promise.all([
    listEnabledCountries(supabase),
    isFlagEnabled(supabase, 'invite_only', { userId: user.id }),
    // MV-S11: a collector who already redeemed (then closed the tab) is not asked again.
    hasRedeemedInvite(supabase, user.id).catch(() => false),
  ]);
  const inviteOnly = inviteFlag && !redeemed;

  return (
    <main style={{ padding: '48px 20px', flex: 1 }}>
      <OnboardingWizard
        userId={user.id}
        userPhone={user.phone ?? null}
        countries={countries}
        inviteOnly={inviteOnly}
        defaultCountry={defaultCountryCode({ phone: user.phone, email: user.email }, countries)}
      />
    </main>
  );
}
