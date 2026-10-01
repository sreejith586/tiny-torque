// Mini Vault — ai-scan v2 pure helpers (F-03, MV-S3-02).
//
// Everything in this file is network-free and side-effect-free so it can be unit-tested with
// Deno offline (see lib.test.ts). The orchestration (auth, quota, storage, DB writes, the
// Anthropic HTTP call) lives in index.ts and composes these helpers.

export interface ScanCandidate {
  brand: string;
  model: string | null;
  variant: string | null;
  series: string | null;
  scale: string | null;
  confidence: number; // 0-1
  notes: string | null;
}

// ---------- tool_use structured output (D-013: structured, not free-text JSON) ----------
// We force the model through a single tool so the response shape is guaranteed by the API rather
// than parsed out of prose. `cars` is the only input; each item mirrors ScanCandidate.
export const SCAN_TOOL = {
  name: 'record_cars',
  description:
    'Record every distinct diecast model car identified in the photo. Always call this tool exactly once, even if no cars are visible (then pass an empty cars array).',
  input_schema: {
    type: 'object',
    properties: {
      cars: {
        type: 'array',
        description: 'One entry per distinct car visible in the photo.',
        items: {
          type: 'object',
          properties: {
            brand: {
              type: 'string',
              description: 'Manufacturer, e.g. "Hot Wheels". Use "Unknown" if unreadable.',
            },
            model: {
              type: ['string', 'null'],
              description: 'The car\'s model name, e.g. "Skyline GT-R".',
            },
            variant: {
              type: ['string', 'null'],
              description: 'Colour / paint variant, if identifiable.',
            },
            series: {
              type: ['string', 'null'],
              description: 'Named series / collaboration printed on the card.',
            },
            scale: { type: ['string', 'null'], description: 'Scale such as "1:64", if stated.' },
            confidence: {
              type: 'number',
              description: 'Overall confidence 0-1 for this identification.',
            },
            notes: { type: ['string', 'null'], description: 'Short note on anything uncertain.' },
          },
          required: ['brand', 'confidence'],
        },
      },
    },
    required: ['cars'],
  },
} as const;

export const SYSTEM_PROMPT_V2 =
  `You are helping a diecast car collector catalogue their collection from a photo. The photo may ` +
  `show one or several diecast model cars (commonly Hot Wheels, Matchbox, Tomica, Majorette, Mini ` +
  `GT and similar 1:64-1:18 collectibles), on blister packaging or loose. Identify EVERY distinct ` +
  `car you can see and record them by calling the record_cars tool exactly once. Be honest with ` +
  `the confidence score: lower it when packaging text is obscured or the casting is ambiguous. ` +
  `Never invent details you cannot see — use null for anything you cannot determine.`;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Clamp/sanitise one raw car object from the model — never trust its shape blindly. */
export function normalizeCandidate(raw: unknown): ScanCandidate {
  const c = (raw ?? {}) as Record<string, unknown>;
  const conf =
    typeof c.confidence === 'number' && Number.isFinite(c.confidence) ? c.confidence : 0.5;
  return {
    brand: str(c.brand) ?? 'Unknown',
    model: str(c.model),
    variant: str(c.variant),
    series: str(c.series),
    scale: str(c.scale),
    confidence: Math.max(0, Math.min(1, conf)),
    notes: str(c.notes),
  };
}

/**
 * Pull the normalised candidate list out of an Anthropic Messages response. Returns null when the
 * model did not call record_cars (e.g. it emitted prose instead) so the caller can retry once.
 */
export function parseToolUse(data: unknown): ScanCandidate[] | null {
  const content = (data as { content?: unknown })?.content;
  if (!Array.isArray(content)) return null;
  const block = content.find(
    (b) =>
      (b as { type?: string })?.type === 'tool_use' &&
      (b as { name?: string })?.name === SCAN_TOOL.name
  ) as { input?: { cars?: unknown } } | undefined;
  if (!block) return null;
  const cars = block.input?.cars;
  if (!Array.isArray(cars)) return null;
  return cars.map(normalizeCandidate);
}

// ---------- cost metering ----------
// Per-MTok USD pricing. claude-sonnet-5 is the scan model; keep a fallback so an unknown id still
// meters at a sane rate rather than 0 (which would hide spend).
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-opus-5': { in: 15, out: 75 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
};
const FALLBACK_PRICE = { in: 3, out: 15 };

/** USD cost for a scan, rounded to the 5 dp the ai_scan_jobs.cost_usd numeric(8,5) column holds. */
export function estimateCostUsd(inputTokens: number, outputTokens: number, model: string): number {
  const p = PRICING[model] ?? FALLBACK_PRICE;
  const raw =
    (Math.max(0, inputTokens) / 1_000_000) * p.in + (Math.max(0, outputTokens) / 1_000_000) * p.out;
  return Math.round(raw * 1e5) / 1e5;
}

/** Trigram-similarity banding for catalogue match chips. */
export function scoreBand(score: number): 'strong' | 'weak' | null {
  if (score >= 0.6) return 'strong';
  if (score >= 0.3) return 'weak';
  return null;
}

export interface CatalogMatchRow {
  id: string;
  brand_id: string;
  name: string;
  score: number;
}
export interface CatalogMatch {
  model_id: string;
  brand_id: string;
  name: string;
  score: number;
  band: 'strong' | 'weak';
}

/**
 * Pick the best catalogue match from the rows match_catalog_models returned for one candidate.
 * Returns null when nothing clears the `weak` band (score < 0.3) so the UI shows no chip rather
 * than a misleading weak suggestion. Pure — the RPC call lives in index.ts.
 */
export function bestMatch(rows: CatalogMatchRow[] | null | undefined): CatalogMatch | null {
  if (!rows?.length) return null;
  const top = rows.reduce((a, b) => (b.score > a.score ? b : a));
  const band = scoreBand(top.score);
  if (!band) return null;
  return {
    model_id: top.id,
    brand_id: top.brand_id,
    name: top.name,
    score: Math.round(top.score * 1000) / 1000,
    band,
  };
}

// ---------- feature-flag kill switch (mirrors src/domain/flags/evaluate.ts) ----------
export interface FlagAudience {
  user_ids?: string[];
  plans?: string[];
  countries?: string[];
  percent?: number;
}
export interface FlagContext {
  userId?: string;
  plan?: string;
  countryCode?: string;
}

function stableBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}

/** `enabled` is the hard kill switch; audience only narrows an already-enabled flag. */
export function isFlagEnabled(
  flag: { enabled: boolean; audience?: FlagAudience | null } | null | undefined,
  ctx: FlagContext = {}
): boolean {
  if (!flag?.enabled) return false;
  const a = flag.audience ?? {};
  if (a.user_ids?.length && ctx.userId && a.user_ids.includes(ctx.userId)) return true;
  if (a.plans?.length && (!ctx.plan || !a.plans.includes(ctx.plan))) return false;
  if (a.countries?.length && (!ctx.countryCode || !a.countries.includes(ctx.countryCode)))
    return false;
  if (typeof a.percent === 'number') {
    if (!ctx.userId || stableBucket(ctx.userId) >= a.percent) return false;
  }
  return true;
}
