// Mini Vault — batch photo scan Edge Function.
//
// Deploy with: supabase functions deploy scan-photo
// Requires a secret set once via:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Called from the client via supabase.functions.invoke('scan-photo', { body: { image: base64Jpeg } })
// — see scanPhotoForCars() in src/lib/api.ts and src/app/garage/scan/page.tsx.
//
// Takes ONE photo that may contain several diecast cars (e.g. a table full
// of cars, or a shelf), asks Claude's vision model to identify each car it
// can see, and returns a list of candidates with a confidence score so the
// user can review/edit before anything is saved to their garage. Nothing is
// written to the database here — this function only returns candidates.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScanCandidate {
  brand: string;
  model: string | null;
  variant: string | null;
  series: string | null;
  scale: string | null;
  confidence: number; // 0-1
  notes: string | null; // anything the model wasn't sure about
}

const SYSTEM_PROMPT = `You are helping a diecast car collector catalog their collection from a photo.
The photo may show one or several diecast model cars (commonly Hot Wheels, Matchbox, Tomica, Majorette, or similar 1:64-1:18 scale toy/collectible cars), possibly still on their blister packaging or loose on a table/shelf.

Identify EVERY distinct car you can see in the photo. For each one, do your best to determine:
- brand (e.g. "Hot Wheels", "Matchbox", "Tomica") — required, use "Unknown" if truly unreadable
- model (the car's model name, e.g. "Skyline GT-R", "'67 Camaro")
- variant (color/paint variant if identifiable)
- series (a named series/collaboration printed on the card, if visible)
- scale (e.g. "1:64") if stated on packaging
- confidence: a number from 0 to 1 for how sure you are about this identification overall
- notes: short free text on anything uncertain (e.g. "card text partially obscured")

Respond with ONLY a JSON array (no markdown fences, no prose) of objects with exactly these keys: brand, model, variant, series, scale, confidence, notes. Use null for any field you can't determine. If you see no cars at all, return an empty array [].`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { image, mediaType } = await req.json();
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing "image" (base64-encoded photo) in request body.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/jpeg',
                  data: image,
                },
              },
              {
                type: 'text',
                text: 'Identify every diecast car in this photo and return the JSON array as instructed.',
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(JSON.stringify({ error: `Vision model request failed: ${errText}` }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const anthropicData = await anthropicRes.json();
    const rawText: string = anthropicData?.content?.[0]?.text ?? '[]';

    let candidates: ScanCandidate[];
    try {
      // Model is instructed to return raw JSON, but strip code fences defensively
      // in case it wraps the array anyway.
      const cleaned = rawText.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      candidates = JSON.parse(cleaned);
      if (!Array.isArray(candidates)) throw new Error('Model did not return an array.');
    } catch (parseErr) {
      return new Response(
        JSON.stringify({ error: 'Could not parse the model response as JSON.', raw: rawText }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize/sanitize each candidate defensively — never trust model output shape blindly.
    const normalized = candidates.map((c) => ({
      brand: typeof c.brand === 'string' && c.brand.trim() ? c.brand.trim() : 'Unknown',
      model: typeof c.model === 'string' && c.model.trim() ? c.model.trim() : null,
      variant: typeof c.variant === 'string' && c.variant.trim() ? c.variant.trim() : null,
      series: typeof c.series === 'string' && c.series.trim() ? c.series.trim() : null,
      scale: typeof c.scale === 'string' && c.scale.trim() ? c.scale.trim() : null,
      confidence: typeof c.confidence === 'number' ? Math.max(0, Math.min(1, c.confidence)) : 0.5,
      notes: typeof c.notes === 'string' && c.notes.trim() ? c.notes.trim() : null,
    }));

    return new Response(JSON.stringify({ candidates: normalized }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
