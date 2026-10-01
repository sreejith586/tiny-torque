// Mini Vault — ai-scan v2 Edge Function (F-03, MV-S3-02).
//
// Deploy:  supabase functions deploy ai-scan
// Secrets (set once):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
//
// Flow (single-photo scan): verify the caller's JWT -> check the `ai_scan` kill switch ->
// check the rolling scan quota (402 + paywall payload when exhausted) -> load the caller's stored
// media row + download the image from its private bucket -> ask Claude via a forced tool_use so
// the candidate shape is API-guaranteed (one retry if it answers in prose) -> meter tokens/cost/
// latency into ai_scan_jobs -> return the normalised candidates + remaining quota.
//
// Unlike the S0 scan-photo function, nothing here trusts client-supplied image bytes: the photo is
// fetched server-side by media_id, which also lets us attribute the scan to a media row and owner.
// The scored catalogue match (trigram) is additive and lands with the starter-casting catalogue
// (Varun's CSV) — candidates are returned unmatched until then.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://esm.sh/zod@3.23.8';
import {
  SCAN_TOOL,
  SYSTEM_PROMPT_V2,
  parseToolUse,
  estimateCostUsd,
  isFlagEnabled,
  bestMatch,
  type CatalogMatchRow,
  type ScanCandidate,
} from './lib.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 2048;

// D-013: validate the Edge body. kind maps to the scan feature flag we gate on.
const BodySchema = z.object({
  media_id: z.string().uuid(),
  kind: z.enum(['single', 'group']).default('single'),
});

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY)
    return json({ error: 'Server is misconfigured (missing Supabase env).' }, 500);
  if (!ANTHROPIC_KEY) return json({ error: 'Server is missing ANTHROPIC_API_KEY.' }, 500);

  // ---------- 1. auth: resolve the caller from their JWT ----------
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer '))
    return json({ error: 'Not signed in.' }, 401);
  const userClient: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: 'Not signed in.' }, 401);

  // service-role client for quota/flag/media/job reads+writes (bypasses RLS; never exposed to the browser)
  const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ---------- 2. validate body ----------
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return json(
      { error: 'Invalid request.', detail: err instanceof Error ? err.message : String(err) },
      400
    );
  }
  const flagKey = body.kind === 'group' ? 'ai_scan_group' : 'ai_scan';

  // ---------- 3. kill switch (D-018) ----------
  const { data: profile } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle();
  const { data: flag } = await admin
    .from('feature_flags')
    .select('enabled, audience')
    .eq('key', flagKey)
    .maybeSingle();
  if (!isFlagEnabled(flag, { userId: user.id, plan: profile?.plan })) {
    return json(
      { error: 'AI scan is currently unavailable.', code: 'feature_disabled', flag: flagKey },
      503
    );
  }

  // ---------- 4. quota (402 + paywall payload when exhausted) ----------
  const { data: quota, error: quotaErr } = await admin.rpc('entitlement_scan_quota', {
    p_user: user.id,
  });
  if (quotaErr) return json({ error: 'Could not check your scan quota.' }, 500);
  const remaining = Number(quota ?? 0);
  if (remaining <= 0) {
    return json(
      {
        error: 'You have used all your scans for this period.',
        code: 'scan_quota_exhausted',
        quota: 0,
        plan: profile?.plan ?? 'free',
      },
      402
    );
  }

  // ---------- 5. load the caller's media + download the image server-side ----------
  const { data: media, error: mediaErr } = await admin
    .from('media')
    .select('id, owner_id, bucket, path')
    .eq('id', body.media_id)
    .maybeSingle();
  if (mediaErr || !media) return json({ error: 'Photo not found.' }, 404);
  if (media.owner_id !== user.id) return json({ error: 'Not your photo.' }, 403);

  const { data: blob, error: dlErr } = await admin.storage.from(media.bucket).download(media.path);
  if (dlErr || !blob) return json({ error: 'Could not read the photo from storage.' }, 502);
  const base64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
  // The media table stores no mime; Storage returns the object's content-type on the Blob.
  const mediaType = blob.type || 'image/jpeg';

  // ---------- 6. scan (forced tool_use, one retry) ----------
  const started = Date.now();
  let candidates: ScanCandidate[] | null = null;
  let usage = { input_tokens: 0, output_tokens: 0 };
  let lastError = '';
  for (let attempt = 0; attempt < 2 && candidates === null; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT_V2,
          tools: [SCAN_TOOL],
          tool_choice: { type: 'tool', name: SCAN_TOOL.name },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                {
                  type: 'text',
                  text: 'Identify every diecast car in this photo and record them with the record_cars tool.',
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        lastError = `vision request failed (${res.status}): ${await res.text()}`;
        continue;
      }
      const data = await res.json();
      if (data?.usage) {
        usage = {
          input_tokens: data.usage.input_tokens ?? 0,
          output_tokens: data.usage.output_tokens ?? 0,
        };
      }
      candidates = parseToolUse(data); // null -> model answered in prose -> retry once
      if (candidates === null) lastError = 'model did not call record_cars';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const latency_ms = Date.now() - started;
  const cost_usd = estimateCostUsd(usage.input_tokens, usage.output_tokens, MODEL);

  // ---------- 7. enrich with a verified-catalogue match (trigram; empty until the catalogue has data) ----------
  let enriched = candidates;
  if (candidates && candidates.length) {
    enriched = await Promise.all(
      candidates.map(async (c) => {
        const term = c.model ?? c.brand;
        if (!term || term === 'Unknown') return c;
        const { data: rows } = await admin.rpc('match_catalog_models', {
          p_name: term,
          p_limit: 3,
        });
        const match = bestMatch((rows ?? []) as CatalogMatchRow[]);
        return match ? { ...c, match } : c;
      })
    );
  }

  // ---------- 8. meter into ai_scan_jobs ----------
  if (candidates === null) {
    await admin.from('ai_scan_jobs').insert({
      user_id: user.id,
      kind: body.kind,
      media_id: body.media_id,
      status: 'failed',
      model: MODEL,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd,
      latency_ms,
      error: lastError.slice(0, 500),
    });
    return json({ error: 'The scan could not be completed. Please try another photo.' }, 502);
  }

  const { data: job } = await admin
    .from('ai_scan_jobs')
    .insert({
      user_id: user.id,
      kind: body.kind,
      media_id: body.media_id,
      status: 'done',
      candidates: enriched,
      model: MODEL,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd,
      latency_ms,
    })
    .select('id')
    .maybeSingle();

  return json({
    candidates: enriched,
    quota_remaining: Math.max(0, remaining - 1),
    job_id: job?.id ?? null,
  });
});

// Chunked base64 so a multi-MB photo never blows the call-stack of btoa(String.fromCharCode(...all)).
function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
