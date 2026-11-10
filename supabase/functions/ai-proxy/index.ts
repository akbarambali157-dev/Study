import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * ai-proxy — server-side proxy for the OOU Study Hub AI pipeline.
 *
 * Holds the brewkeg.dev API key in Supabase secrets (never in the browser bundle).
 * Students never paste their own key; the site provides the model.
 *
 * Request body:
 *   { system, prompt, model, max_tokens, effort? }
 *
 * Response:
 *   { content: string, usage: { input_tokens, output_tokens } }
 */

const BREWKEG_BASE_URL = 'https://brewkeg.dev'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Auth: require a logged-in Supabase user ──────────────────────────
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Server-side brewkeg.dev key (never reaches the browser) ─────────
  const brewkegKey = Deno.env.get('BREWKEG_API_KEY')
  if (!brewkegKey) {
    return new Response(JSON.stringify({ error: 'server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Parse request ───────────────────────────────────────────────────
  let body: { system?: string; prompt?: string; model?: string; max_tokens?: number; effort?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!body.prompt || !body.model) {
    return new Response(JSON.stringify({ error: 'prompt and model required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Forward to brewkeg.dev ──────────────────────────────────────────
  let brewkegResp: Response
  try {
    brewkegResp = await fetch(`${BREWKEG_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${brewkegKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model,
        max_tokens: body.max_tokens ?? 8000,
        system: body.system ?? '',
        messages: [{ role: 'user', content: body.prompt }],
      }),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'could not reach model provider' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Parse response ──────────────────────────────────────────────────
  const responseJson = await brewkegResp.json().catch(() => null)
  const content =
    responseJson?.content?.[0]?.type === 'text'
      ? responseJson.content[0].text
      : responseJson?.content ?? JSON.stringify(responseJson)

  const usage = {
    input_tokens: responseJson?.usage?.input_tokens ?? 0,
    output_tokens: responseJson?.usage?.output_tokens ?? 0,
  }

  // ── Record usage for the logged-in user ─────────────────────────────
  try {
    await supabaseClient.from('ai_usage').insert({
      user_id: user.id,
      model: body.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      status_code: brewkegResp.status,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Usage tracking must never break a generation
  }

  // ── Return ──────────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({ content, usage }),
    {
      status: brewkegResp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
