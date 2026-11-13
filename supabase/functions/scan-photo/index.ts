// RETIRED (MV-S11-04). This was the Phase-1 scan endpoint: it took a base64 image, called the
// vision model with the project's Anthropic key and returned candidates — with no check of who
// was calling beyond the gateway's JWT verification (the public anon key passes that), no scan
// quota, no `ai_scan` kill switch and no cost log. The app uses `ai-scan` (F-03) for every scan.
//
// The file stays so a stray `supabase functions deploy scan-photo` ships a dead end rather than
// the old behaviour. The deployed copy should be deleted outright:
//   supabase functions delete scan-photo --project-ref <ref>
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  return new Response(
    JSON.stringify({ error: 'This endpoint has been retired. Use ai-scan.', code: 'gone' }),
    { status: 410, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
});
