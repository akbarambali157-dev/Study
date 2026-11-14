import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const allowedModels = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'])

function json(data: unknown, status = 200, requestId?: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', ...(requestId ? { 'x-request-id': requestId } : {}) },
  })
}
function extractText(value: any): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map((part) => typeof part?.text === 'string' ? part.text : '').filter(Boolean).join('\n').trim()
  if (!value || typeof value !== 'object') return ''
  if (typeof value.output_text === 'string') return value.output_text.trim()
  if (value.content !== undefined) return extractText(value.content)
  if (Array.isArray(value.choices) && value.choices[0]) return extractText(value.choices[0].message?.content ?? value.choices[0].text)
  if (value.message?.content !== undefined) return extractText(value.message.content)
  return ''
}
function safeProviderError(status: number): { message: string; code: string; http: number } {
  if (status === 401 || status === 403) return { message: 'The provider rejected your saved key. Replace it in Settings.', code: 'BYOK_AUTH_ERROR', http: 502 }
  if (status === 404) return { message: 'The selected model or provider endpoint was not found.', code: 'MODEL_UNAVAILABLE', http: 400 }
  if (status === 429) return { message: 'Your provider rate limit was reached. Wait before trying again.', code: 'RATE_LIMIT', http: 429 }
  if (status === 529 || status === 503 || status >= 500) return { message: 'The provider is temporarily unavailable. Try again later.', code: 'PROVIDER_OVERLOADED', http: 503 }
  return { message: 'The provider rejected this request. Check the model and request settings.', code: 'PROVIDER_REQUEST_ERROR', http: 400 }
}
function providerEndpoint(raw?: string): string {
  if (!raw?.trim()) return 'https://api.anthropic.com/v1/messages'
  const url = new URL(raw.trim())
  if (url.protocol !== 'https:') throw new Error('Provider endpoints must use HTTPS.')
  const host = url.hostname.toLowerCase()
  const allowed = host === 'api.anthropic.com' || host === 'brewkeg.dev'
  if (!allowed || url.pathname !== '/' && url.pathname !== '/v1') throw new Error('Use the official Anthropic or BrewKeg HTTPS endpoint.')
  const path = url.pathname.replace(/\/+$/, '').replace(/\/v1$/, '')
  return `${url.origin}${path}/v1/messages`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const requestId = crypto.randomUUID()
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authorization = req.headers.get('Authorization') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization.startsWith('Bearer ')) {
    return json({ error: 'authentication required', code: 'AUTH_REQUIRED' }, 401, requestId)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Your session is invalid. Sign in again.', code: 'AUTH_INVALID' }, 401, requestId)
  const userId = authData.user.id

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > 300_000) return json({ error: 'request too large' }, 413, requestId)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid json body' }, 400, requestId) }

  const action = typeof body.action === 'string' ? body.action : 'generate'
  if (action === 'status') {
    const { data, error } = await admin.from('user_provider_credentials').select('provider,base_url,updated_at').eq('user_id', userId).maybeSingle()
    if (error) return json({ error: 'Credential status is temporarily unavailable.', code: 'VAULT_STATUS_ERROR' }, 503, requestId)
    return json({ configured: Boolean(data), provider: data?.provider ?? null, base_url: data?.base_url ?? null, updated_at: data?.updated_at ?? null }, 200, requestId)
  }
  if (action === 'save') {
    const key = typeof body.api_key === 'string' ? body.api_key.trim() : ''
    if (key.length < 24 || key.length > 500 || /\s/.test(key) || !/^[A-Za-z0-9._~+/=-]+$/.test(key)) {
      return json({ error: 'That key format is not recognised. Paste the complete provider key without spaces.', code: 'INVALID_KEY_FORMAT' }, 400, requestId)
    }
    const isAnthropicKey = key.startsWith('sk-ant-')
    const isBrewKegKey = key.startsWith('bk_live_')
    if (!isAnthropicKey && !isBrewKegKey) {
      return json({ error: 'Use a key beginning with sk-ant- or bk_live_.', code: 'INVALID_KEY_FORMAT' }, 400, requestId)
    }
    const baseUrl = typeof body.base_url === 'string' && body.base_url.trim()
      ? body.base_url.trim().replace(/\/+$/, '')
      : isAnthropicKey ? 'https://api.anthropic.com' : 'https://brewkeg.dev'
    try {
      const endpoint = new URL(baseUrl)
      const expectedHost = isAnthropicKey ? 'api.anthropic.com' : 'brewkeg.dev'
      if (endpoint.protocol !== 'https:' || endpoint.hostname !== expectedHost || (endpoint.pathname !== '/' && endpoint.pathname !== '/v1')) {
        throw new Error('The selected provider endpoint does not match this credential type.')
      }
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Invalid provider endpoint.', code: 'INVALID_PROVIDER_URL' }, 400, requestId)
    }
    const { error } = await admin.rpc('store_user_provider_credential', {
      p_user_id: userId, p_secret: key, p_base_url: baseUrl,
    })
    if (error) {
      console.error('BYOK vault save failed', { requestId, code: error.code })
      return json({ error: 'The secure credential vault could not save your key. Your previous key was not replaced.', code: 'VAULT_SAVE_ERROR' }, 503, requestId)
    }
    return json({ configured: true, saved: true }, 200, requestId)
  }
  if (action === 'delete') {
    const { error } = await admin.rpc('delete_user_provider_credential', { p_user_id: userId })
    if (error) {
      console.error('BYOK vault delete failed', { requestId, code: error.code })
      return json({ error: 'The saved key could not be removed from the secure vault.', code: 'VAULT_DELETE_ERROR' }, 503, requestId)
    }
    return json({ configured: false, deleted: true }, 200, requestId)
  }

  const [{ data: key, error: keyError }, { data: credential, error: credentialError }] = await Promise.all([
    admin.rpc('get_user_provider_credential', { p_user_id: userId }),
    admin.from('user_provider_credentials').select('base_url').eq('user_id', userId).maybeSingle(),
  ])
  if (keyError || credentialError || typeof key !== 'string' || !key || !credential?.base_url) {
    return json({ error: 'Add your private API key in Settings before using personal-key mode.', code: 'BYOK_NOT_CONFIGURED' }, 400, requestId)
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt : ''
  const system = typeof body.system === 'string' ? body.system : ''
  const model = typeof body.model === 'string' ? body.model : ''
  const maxTokens = Number(body.max_tokens ?? 8000)
  if (!prompt.trim() || prompt.length > 250_000 || system.length > 30_000 || !allowedModels.has(model)) {
    return json({ error: 'The prompt or selected model is invalid.', code: 'INVALID_REQUEST' }, 400, requestId)
  }
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 12_000) return json({ error: 'max_tokens must be between 1 and 12000.', code: 'INVALID_TOKEN_LIMIT' }, 400, requestId)

  let endpoint: string
  try {
    const savedBaseUrl = credential.base_url as string
    if (!key.startsWith('sk-ant-') && !key.startsWith('bk_live_')) throw new Error('The saved credential format is not supported.')
    const expectedHost = key.startsWith('sk-ant-') ? 'api.anthropic.com' : 'brewkeg.dev'
    if (new URL(savedBaseUrl).hostname !== expectedHost) throw new Error('Saved provider endpoint does not match the credential type.')
    endpoint = providerEndpoint(savedBaseUrl)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid saved provider URL.', code: 'INVALID_PROVIDER_URL' }, 400, requestId)
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' }
  if (key.startsWith('sk-ant-')) headers['x-api-key'] = key
  else headers.Authorization = `Bearer ${key}`

  let upstream: Response
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model, max_tokens: maxTokens, system,
        messages: [{ role: 'user', content: prompt }],
        ...(body.output_config && typeof body.output_config === 'object' ? { output_config: body.output_config } : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    })
  } catch (error) {
    console.error('BYOK provider transport failed', { requestId, name: error instanceof Error ? error.name : 'unknown' })
    return json({ error: 'Could not reach the selected provider. Check your connection and endpoint.', code: 'PROVIDER_NETWORK_ERROR' }, 502, requestId)
  }

  const raw = await upstream.text()
  let payload: any
  try { payload = JSON.parse(raw) } catch { payload = { content: raw } }
  if (!upstream.ok) {
    const mapped = safeProviderError(upstream.status)
    console.warn('BYOK provider rejected request', { requestId, status: upstream.status, code: mapped.code })
    return json({ error: mapped.message, code: mapped.code }, mapped.http, requestId)
  }
  const content = extractText(payload)
  if (!content) {
    console.warn('BYOK provider returned empty content', { requestId, status: upstream.status })
    return json({ error: 'The provider returned an empty or unsupported response.', code: 'PROVIDER_EMPTY_RESPONSE' }, 502, requestId)
  }
  const usage = {
    input_tokens: Math.max(0, Math.floor(Number(payload?.usage?.input_tokens ?? payload?.usage?.prompt_tokens ?? 0) || 0)),
    output_tokens: Math.max(0, Math.floor(Number(payload?.usage?.output_tokens ?? payload?.usage?.completion_tokens ?? 0) || 0)),
  }
  return json({ content, usage, request_id: requestId }, 200, requestId)
})
