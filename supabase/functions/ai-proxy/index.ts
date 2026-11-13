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
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
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
  const declaredLength = Number(req.headers.get('content-length') ?? 0)
  if (declaredLength > 300_000) {
    return new Response(JSON.stringify({ error: 'request too large' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: {
    system?: string
    prompt?: string
    model?: string
    max_tokens?: number
    effort?: string
    output_config?: Record<string, unknown>
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const allowedModels = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'])
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || typeof body.model !== 'string') {
    return new Response(JSON.stringify({ error: 'prompt and model required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!allowedModels.has(body.model)) {
    return new Response(JSON.stringify({ error: 'selected model is not allowed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const maxTokens = Number(body.max_tokens ?? 8000)
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 12_000) {
    return new Response(JSON.stringify({ error: 'max_tokens must be between 1 and 12000' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if ((body.system !== undefined && typeof body.system !== 'string') || body.prompt.length > 250_000 || (body.system?.length ?? 0) > 30_000) {
    return new Response(JSON.stringify({ error: 'prompt exceeds the allowed size' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Per-user request limits ──────────────────────────────────────────
  // Keep the shared provider usable for students while preventing one account
  // from exhausting the project's pooled API balance.
  const minuteAgo = new Date(Date.now() - 60_000).toISOString()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const [minuteUsage, dailyUsage] = await Promise.all([
    supabaseClient
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', minuteAgo),
    supabaseClient
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dayAgo),
  ])
  if (minuteUsage.error || dailyUsage.error) {
    console.error('AI quota check failed')
    return new Response(JSON.stringify({ error: 'Usage limits are temporarily unavailable. Please try again shortly.' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if ((minuteUsage.count ?? 0) >= 60) {
    return new Response(JSON.stringify({ error: 'You have reached the short-term AI request limit. Please wait a minute and try again.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    })
  }
  if ((dailyUsage.count ?? 0) >= 500) {
    return new Response(JSON.stringify({ error: 'You have reached today’s hosted AI allowance. Please try again tomorrow.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' },
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
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model,
        max_tokens: maxTokens,
        system: body.system ?? '',
        messages: [{ role: 'user', content: body.prompt }],
        ...(body.output_config ? { output_config: body.output_config } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    })
  } catch {
    return new Response(JSON.stringify({ error: 'could not reach model provider' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Parse response ──────────────────────────────────────────────────
  const responseJson = await brewkegResp.json().catch(() => null)
  if (!brewkegResp.ok) {
    const upstreamAuthFailure = brewkegResp.status === 401 || brewkegResp.status === 403
    const providerMessage = upstreamAuthFailure
      ? 'The hosted AI provider rejected its server-side credential. The site administrator needs to check the proxy secret.'
      : responseJson?.error?.message ?? responseJson?.message ?? 'The model provider rejected the request.'
    return new Response(JSON.stringify({ error: String(providerMessage).slice(0, 300) }), {
      // Reserve 401 for the user's Supabase session; provider-key failures are
      // gateway failures and must not tell the student to sign in again.
      status: upstreamAuthFailure ? 502 : brewkegResp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const rawContent =
    responseJson?.content?.[0]?.type === 'text'
      ? responseJson.content[0].text
      : responseJson?.content
  const content = typeof rawContent === 'string'
    ? rawContent
    : JSON.stringify(rawContent ?? responseJson ?? {})

  const inputTokens = Number(responseJson?.usage?.input_tokens ?? 0)
  const outputTokens = Number(responseJson?.usage?.output_tokens ?? 0)
  const usage = {
    input_tokens: Number.isFinite(inputTokens) ? Math.max(0, Math.floor(inputTokens)) : 0,
    output_tokens: Number.isFinite(outputTokens) ? Math.max(0, Math.floor(outputTokens)) : 0,
  }

  // ── Record usage for the logged-in user ─────────────────────────────
  try {
    const { error: usageError } = await supabaseClient.from('ai_usage').insert({
      user_id: user.id,
      model: body.model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      status_code: brewkegResp.status,
      created_at: new Date().toISOString(),
    })
    if (usageError) console.warn('AI usage tracking failed:', usageError.code)
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
