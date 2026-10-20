// F-13 replay script (MV-S8-02): recompute every collector's XP / level / badges from the event
// log with the SAME pure rules the app uses (src/domain/gamification/rules.ts) and write the result
// through apply_gamification. Idempotent — running it on an already-correct profile changes
// nothing and emits nothing. It is the backstop for the pull-based in-app consumer (D-066) and the
// "dropping xp and replaying yields the same values" proof (F-13 AC) against real data.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/gamification-replay.ts [--dry-run] [--user <uuid>]
//
// Service role only (gamification_events / apply_gamification accept any p_user for it); this is a
// CLI, never Next.js runtime (D-014). Node ≥ 22.6 strips the types natively.
import { createClient } from '@supabase/supabase-js';
import {
  computeGamification,
  type AchievementDef,
  type GamificationEvent,
} from '../src/domain/gamification/rules.ts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userArg = args.includes('--user') ? args[args.indexOf('--user') + 1] : undefined;

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

// Untyped client on purpose: this script lives outside the app's generated-types boundary and
// only touches the three RPC/table shapes spelled out below.
const supabase = createClient(url, key, { auth: { persistSession: false } });

interface StatRow {
  qty: number;
  price_paid: number;
  rarity: string | null;
}
const COMMON = /^(common|regular|mainline|basic|standard|normal)$/i;

async function statsFor(userId: string) {
  const { data, error } = await supabase
    .from('collection_items')
    .select('qty, price_paid, rarity')
    .eq('owner_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
  const rows = (data ?? []) as StatRow[];
  return {
    totalItems: rows.length,
    totalValue: rows.reduce((a, r) => a + (r.price_paid ?? 0), 0),
    rareItems: rows.filter((r) => (r.rarity ?? '').trim() && !COMMON.test(r.rarity!.trim())).length,
  };
}

async function main() {
  const { data: achievements, error: aErr } = await supabase
    .from('achievements')
    .select('key, rule')
    .order('sort_order');
  if (aErr) throw aErr;

  let q = supabase.from('profiles').select('id, handle, xp, level').is('deleted_at', null);
  if (userArg) q = q.eq('id', userArg);
  const { data: profiles, error: pErr } = await q;
  if (pErr) throw pErr;

  let changed = 0;
  for (const p of profiles ?? []) {
    const { data: events, error: eErr } = await supabase.rpc('gamification_events', {
      p_user: p.id,
    });
    if (eErr) throw eErr;
    const stats = await statsFor(p.id);
    const state = computeGamification(
      p.id,
      (events ?? []) as GamificationEvent[],
      stats,
      (achievements ?? []) as AchievementDef[]
    );
    const drift = state.xp !== p.xp || state.level !== p.level;
    const mark = drift ? 'CHANGE' : 'same  ';
    console.log(
      `${mark} @${p.handle}: xp ${p.xp} → ${state.xp}, level ${p.level} → ${state.level}, badges ${state.badges.filter((b) => b.unlocked).length}/${state.badges.length}`
    );
    if (drift) changed += 1;
    if (dryRun) continue;
    const { error: wErr } = await supabase.rpc('apply_gamification', {
      p_user: p.id,
      p_xp: state.xp,
      p_level: state.level,
      p_badges: state.badges.map((b) => ({
        key: b.key,
        progress: b.progress,
        unlocked: b.unlocked,
      })),
    });
    if (wErr) throw wErr;
  }
  console.log(
    `${profiles?.length ?? 0} profile(s) replayed, ${changed} with drift${dryRun ? ' (dry run, nothing written)' : ''}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
