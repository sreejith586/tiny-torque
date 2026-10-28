import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { getPublicProfile } from '@/domain/identity';
import { levelForXp } from '@/domain/gamification';
import { initials } from '@/lib/initials';
import { THEMES } from '@/lib/theme';
import { APP_DEFAULT_THEME } from '@/lib/theme-default';

// F-14 share sheet (MV-S8-04): the Open Graph card for /u/{handle}. Colours come from the default
// theme's token set (D-054) — never a second hardcoded palette (rule 13). Only `public_profiles`
// fields are read (rule 15). Text-only on purpose: no remote image fetch can fail the card.

export const alt = 'Collector profile on Tiny Torque';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const t = THEMES[APP_DEFAULT_THEME].vars;

  let name = 'Collector';
  let sub = `@${handle}`;
  let tier = '';
  let level = 1;
  let shop = false;
  try {
    const profile = await getPublicProfile(await createClient(), handle);
    if (profile) {
      name = profile.display_name ?? name;
      sub =
        `@${profile.handle}` +
        (profile.city || profile.country_code
          ? ` · ${[profile.city, profile.country_code].filter(Boolean).join(', ')}`
          : '');
      const lvl = levelForXp(profile.xp ?? 0);
      tier = lvl.tier;
      level = lvl.level;
      shop = profile.account_type === 'shop';
    }
  } catch {
    // fall back to the handle-only card
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 64,
        background: `linear-gradient(135deg, ${t['--bg']} 0%, ${t['--panel']} 100%)`,
        color: t['--cream'],
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 90,
            background: t['--panel-alt'],
            border: `6px solid ${t['--orange']}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 72,
            fontWeight: 700,
            color: t['--orange'],
          }}
        >
          {initials(name)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
          <div style={{ fontSize: 30, color: t['--muted'] }}>{sub}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            {tier && (
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  padding: '8px 22px',
                  borderRadius: 999,
                  background: t['--teal'],
                  color: t['--bg'],
                }}
              >
                Level {level} · {tier}
              </div>
            )}
            {shop && (
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  padding: '8px 22px',
                  borderRadius: 999,
                  border: `3px solid ${t['--border']}`,
                  color: t['--cream'],
                }}
              >
                Shop
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: 28, color: t['--muted'] }}>
          Diecast collection · offers · trades
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: t['--orange'], letterSpacing: 2 }}>
          TINY TORQUE
        </div>
      </div>
    </div>,
    size
  );
}
