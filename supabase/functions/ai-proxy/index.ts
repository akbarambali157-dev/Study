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

function extractProviderText(payload:any):string{if(typeof payload==='string')return payload.trim();if(Array.isArray(payload))return payload.map((b)=>typeof b?.text==='string'?b.text:'').filter(Boolean).join('\\n').trim();if(!payload||typeof payload!=='object')return '';if(typeof payload.output_text==='string')return payload.output_text.trim();if(payload.content!==undefined)return extractProviderText(payload.content);if(Array.isArray(payload.choices)&&payload.choices[0])return extractProviderText(payload.choices[0].message?.content??payload.choices[0].text);if(payload.message?.content!==undefined)return extractProviderText(payload.message.content);return ''}
function tokenCount(a:unknown,b:unknown):number{const n=Number(a??b??0);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0}

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
    credential_mode?: 'hosted' | 'byok'
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

  const credentialMode = body.credential_mode ?? 'hosted'
  if (credentialMode !== 'hosted' && credentialMode !== 'byok') {
    return new Response(JSON.stringify({ error: 'unsupported credential mode' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Atomic pooled quota reservation and server-side usage ledger ────
  // Client users cannot insert or modify usage rows. Only this trusted
  // function can reserve a request and later record its real provider usage.
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) {
    console.error('AI usage ledger is not configured')
    return new Response(JSON.stringify({ error: 'Hosted AI usage controls are temporarily unavailable.' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const adminClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // BYOK credentials are encrypted in Supabase Vault and are never returned
  // to the browser. This branch is account-scoped and does not consume the
  // site's shared hosted-AI quota.
  if (credentialMode === 'byok') {
    const [{ data: savedSecret, error: secretError }, { data: credential, error: credentialError }] = await Promise.all([
      adminClient.rpc('get_user_provider_credential', { p_user_id: user.id }),
      adminClient.from('user_provider_credentials').select('base_url').eq('user_id', user.id).maybeSingle(),
    ])
    const providerKey = typeof savedSecret === 'string' ? savedSecret : ''
    const baseUrl = credential?.base_url
    if (secretError || credentialError || !providerKey || !baseUrl) {
      return new Response(JSON.stringify({ error: 'No secure personal provider credential is saved for this account.', code: 'BYOK_NOT_CONFIGURED', request_id: requestId }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
      })
    }
    const anthropicKey = providerKey.startsWith('sk-ant-')
    const allowedBase = anthropicKey ? 'https://api.anthropic.com' : 'https://brewkeg.dev'
    if (baseUrl !== allowedBase) {
      console.error('Stored BYOK endpoint rejected by allowlist', { requestId, userId: user.id })
      return new Response(JSON.stringify({ error: 'The saved provider endpoint is not supported. Update it in Settings.', code: 'BYOK_ENDPOINT_INVALID', request_id: requestId }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
      })
    }

    let upstream: Response
    try {
      upstream = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          ...(anthropicKey ? { 'x-api-key': providerKey } : { Authorization: `Bearer ${providerKey}` }),
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
    } catch (error) {
      console.error('BYOK provider transport failed', { requestId, userId: user.id, name: error instanceof Error ? error.name : 'unknown' })
      return new Response(JSON.stringify({ error: 'Could not reach your configured provider. Check the connection and try again.', code: 'BYOK_NETWORK_ERROR', request_id: requestId }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
      })
    }

    const raw = await upstream.text()
    let providerPayload: any
    try { providerPayload = JSON.parse(raw) } catch { providerPayload = { content: raw } }
    if (!upstream.ok) {
      const status = upstream.status === 401 || upstream.status === 403 ? 401 : upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : upstream.status
      const message = status === 401
        ? 'Your saved provider credential was rejected. Check it in Settings.'
        : status === 429
          ? 'Your provider rate limit was reached. Wait before trying again.'
          : status === 502
            ? 'Your provider is temporarily unavailable. Try again shortly.'
            : 'Your provider rejected this request. Check the selected model and provider settings.'
      return new Response(JSON.stringify({ error: message, code: status === 401 ? 'BYOK_AUTH_ERROR' : status === 429 ? 'BYOK_RATE_LIMIT' : 'BYOK_PROVIDER_ERROR', request_id: requestId }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
      })
    }
    const content = extractProviderText(providerPayload)
    if (!content) {
      return new Response(JSON.stringify({ error: 'Your provider returned an empty or unsupported response.', code: 'BYOK_EMPTY_RESPONSE', request_id: requestId }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
      })
    }
    const usage = {
      input_tokens: tokenCount(providerPayload?.usage?.input_tokens, providerPayload?.usage?.prompt_tokens),
      output_tokens: tokenCount(providerPayload?.usage?.output_tokens, providerPayload?.usage?.completion_tokens),
    }
    return new Response(JSON.stringify({ content, usage, request_id: requestId, credential_mode: 'byok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId, 'Cache-Control': 'no-store' },
    })
  }

  const brewkegKey = Deno.env.get('BREWKEG_API_KEY')
  if (!brewkegKey) {
    return new Response(JSON.stringify({ error: 'Hosted AI is not configured on the server.', code: 'HOSTED_NOT_CONFIGURED', request_id: requestId }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
    })
  }
  const { data: reservationRows, error: reservationError } = await adminClient.rpc('reserve_ai_request', {
    p_user_id: user.id,
    p_model: body.model,
    p_request_id: requestId,
    p_user_daily_limit: 120,
    p_global_daily_limit: 6000,
  })
  const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows
  if (reservationError || !reservation) {
    console.error('AI quota reservation failed', { requestId, code: reservationError?.code })
    return new Response(JSON.stringify({ error: 'Usage limits are temporarily unavailable. Please try again shortly.' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!reservation.allowed) {
    const globalLimit = reservation.reason === 'global_daily_limit'
    const suspended = reservation.reason === 'user_suspended'
    return new Response(JSON.stringify({
      error: suspended
        ? 'Hosted AI access for this account has been paused. Contact Study Hub support.'
        : globalLimit
          ? 'The Study Hub shared AI allowance has been reached for today. Please try again tomorrow.'
          : 'You have reached today’s hosted AI allowance. Please try again tomorrow.',
      code: suspended ? 'USER_AI_SUSPENDED' : globalLimit ? 'GLOBAL_DAILY_LIMIT' : 'USER_DAILY_LIMIT',
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '3600' },
    })
  }
  const usageId = reservation.usage_id

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
  } catch (error) {
    await adminClient.from('ai_usage').update({ status_code: 502, duration_ms: Date.now() - startedAt }).eq('id', usageId)
    console.error('AI provider transport failed', { requestId, name: error instanceof Error ? error.name : 'unknown' })
    return new Response(JSON.stringify({ error: 'could not reach model provider', code: 'PROVIDER_NETWORK_ERROR', request_id: requestId }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
    })
  }

  // ── Parse response ──────────────────────────────────────────────────
  const rawBody = await brewkegResp.text()
  let responseJson:any
  try{responseJson=JSON.parse(rawBody)}catch{responseJson={content:rawBody}}
  if (!brewkegResp.ok) {
    const upstreamAuthFailure = brewkegResp.status === 401 || brewkegResp.status === 403
    const providerMessage = upstreamAuthFailure
      ? 'The hosted AI provider rejected its server-side credential. The site administrator needs to check the proxy secret.'
      : responseJson?.error?.message ?? responseJson?.message ?? 'The model provider rejected the request.'
    const providerCode = upstreamAuthFailure ? 'PROVIDER_AUTH_ERROR' : `PROVIDER_HTTP_${brewkegResp.status}`
    await adminClient.from('ai_usage').update({ status_code: upstreamAuthFailure ? 502 : brewkegResp.status, duration_ms: Date.now() - startedAt }).eq('id', usageId)
    console.error('AI provider rejected request', {
      requestId,
      status: brewkegResp.status,
      code: providerCode,
      upstreamType: typeof responseJson?.error?.type === 'string' ? responseJson.error.type : undefined,
    })
    return new Response(JSON.stringify({
      error: String(providerMessage).slice(0, 300),
      code: providerCode,
      request_id: requestId,
    }), {
      // Reserve 401 for the user's Supabase session; provider-key failures are
      // gateway failures and must not tell the student to sign in again.
      status: upstreamAuthFailure ? 502 : brewkegResp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
    })
  }
  const content=extractProviderText(responseJson)
  if(!content){
    await adminClient.from('ai_usage').update({ status_code: 502, duration_ms: Date.now() - startedAt }).eq('id', usageId)
    console.error('AI provider returned no text content', { requestId, status: brewkegResp.status, contentType: typeof responseJson?.content })
    return new Response(JSON.stringify({error:'The provider returned an empty or unsupported response.',code:'PROVIDER_EMPTY_RESPONSE',request_id:requestId}),{status:502,headers:{...corsHeaders,'Content-Type':'application/json','x-request-id':requestId}})
  }
  const usage={input_tokens:tokenCount(responseJson?.usage?.input_tokens,responseJson?.usage?.prompt_tokens),output_tokens:tokenCount(responseJson?.usage?.output_tokens,responseJson?.usage?.completion_tokens)}

  // ── Finalize the reserved usage row with actual provider metrics ────
  const { error: usageError } = await adminClient.from('ai_usage').update({
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    status_code: brewkegResp.status,
    duration_ms: Date.now() - startedAt,
  }).eq('id', usageId)
  if (usageError) console.warn('AI usage tracking failed:', usageError.code)

  // ── Return ──────────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({ content, usage, request_id: requestId }),
    {
      status: brewkegResp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-request-id': requestId },
    },
  )
})
