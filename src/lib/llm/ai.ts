import type { ZodType } from 'zod'
import { aiProxyUrl, byokProxyUrl, supabase } from '../supabase'
import type { AiModel } from '../types'

export type AiErrorCode =
  | 'missing-key'
  | 'auth'
  | 'model-unavailable'
  | 'rate-limit'
  | 'overloaded'
  | 'network'
  | 'schema'
  | 'refusal'
  | 'aborted'
  | 'unknown'

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: AiErrorCode,
    readonly retryable = false,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'AiError'
  }

  /** Safe reference shown to the student; it contains no prompt or credential data. */
  readonly diagnosticId = `AI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

export interface AiUsage {
  inputTokens: number
  outputTokens: number
}

/** Anything that looks like a credential never reaches a toast or a log. */
export function redactSecrets(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, 'sk-ant-•••')
    .replace(/bk_[a-z]+_[A-Za-z0-9_-]{8,}/g, 'bk_•••')
    .replace(/sb_[a-z]+_[A-Za-z0-9_-]{8,}/g, 'sb_•••')
}


interface TimedSignal {
  signal: AbortSignal
  didTimeout: () => boolean
  cleanup: () => void
}

function createTimedSignal(parent?: AbortSignal, timeoutMs = 90_000): TimedSignal {
  const controller = new AbortController()
  let timedOut = false
  const abortFromParent = () => controller.abort(parent?.reason)

  if (parent?.aborted) controller.abort(parent.reason)
  else parent?.addEventListener('abort', abortFromParent, { once: true })

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException('The AI request timed out.', 'TimeoutError'))
  }, timeoutMs)

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', abortFromParent)
    },
  }
}

export interface StructuredRequest<T> {
  schema: ZodType<T>
  system: string
  prompt: string
  model: AiModel
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  baseUrl?: string
  signal?: AbortSignal
  /** When true, the site provides the model via the Supabase Edge Function
   * and the browser never touches the API key. */
  useProxy?: boolean
}

/**
 * One structured generation call through the server-side proxy.
 *
 * Used when the site provides the model (proxy mode). The browser never sees
 * the brewkeg.dev key; it calls the Supabase Edge Function, which holds the
 * key server-side and forwards to https://brewkeg.dev.
 *
 * The Edge Function returns { content, usage }; the frontend validates the
 * content with the same zod schema as the direct path.
 */
async function generateStructuredViaProxy<T>(
  request: StructuredRequest<T>,
  mode: 'hosted' | 'byok',
): Promise<{ data: T; usage: AiUsage }> {
  // Paid generation is never retried automatically: an ambiguous network
  // failure could mean the provider accepted the request and billed it.
  const attempts = 1
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (request.signal?.aborted) {
      throw new AiError('Generation stopped.', 'aborted')
    }

    const timeout = createTimedSignal(request.signal)
    try {
      // Get the user's JWT so the Edge Function can identify them
      if (!supabase) {
        throw new AiError(
          'Hosted AI is not configured. Add the Supabase URL and anon key, or use your own API key.',
          'unknown',
        )
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw new AiError('Your sign-in session could not be checked. Sign in again.', 'auth')
      }
      const token = sessionData.session?.access_token
      if (!token) {
        throw new AiError('You need to sign in to use the model.', 'auth')
      }
      const publicKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
      if (!publicKey) {
        throw new AiError('Hosted AI is not configured. The Supabase public key is missing.', 'unknown')
      }

      const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod')
      const resp = await fetch(mode === 'hosted' ? aiProxyUrl() : byokProxyUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publicKey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          system: request.system,
          prompt: request.prompt,
          model: request.model,
          max_tokens: request.maxTokens ?? 8000,
          effort: request.effort ?? 'medium',
          ...(mode === 'byok' && request.baseUrl ? { base_url: request.baseUrl } : {}),
          output_config: {
            format: zodOutputFormat(request.schema),
            effort: request.effort ?? 'medium',
          },
        }),
        signal: timeout.signal,
      })

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null)
        const requestId = errBody?.request_id ?? resp.headers.get('x-request-id') ?? undefined
        if (resp.status === 401) {
          throw new AiError('Your sign-in session has expired. Sign in again.', 'auth', false, requestId)
        }
        const code = typeof errBody?.code === 'string' ? errBody.code : ''
        if (code === 'BYOK_NOT_CONFIGURED') throw new AiError('Add your private provider key in Settings first.', 'missing-key', false, requestId)
        if (code === 'BYOK_AUTH_ERROR') throw new AiError('Your saved personal key was rejected. Replace it in Settings.', 'auth', false, requestId)
        if (code === 'INVALID_PROVIDER_URL') throw new AiError('The selected provider URL is not supported. Use Anthropic or BrewKeg HTTPS endpoints.', 'unknown', false, requestId)
        if (code === 'PROVIDER_AUTH_ERROR') throw new AiError('The hosted provider credential is not configured correctly. Contact Study Hub support.', 'auth', false, requestId)
        if (code === 'PROVIDER_EMPTY_RESPONSE') throw new AiError('The provider returned an empty response. No learning output was saved.', 'schema', false, requestId)
        if (code === 'PROVIDER_NETWORK_ERROR') throw new AiError('The provider could not be reached. Check the connection before retrying.', 'network', true, requestId)
        const detail = typeof errBody?.error === 'string' ? errBody.error : `Proxy returned ${resp.status}`
        const mapped = resp.status >= 500
          ? new AiError(`${mode === 'hosted' ? 'Hosted AI' : 'Your provider'} is not ready: ${redactSecrets(detail)}`, 'overloaded', resp.status === 502 || resp.status === 503, requestId)
          : mapError({ status: resp.status, message: detail })
        throw new AiError(mapped.message, mapped.code, mapped.retryable, requestId)
      }

      const payload = await resp.json() as {content?:unknown;output_text?:unknown;request_id?:string;usage?:{input_tokens?:number;output_tokens?:number;prompt_tokens?:number;completion_tokens?:number}}
      const content = extractText(payload.content ?? payload.output_text ?? payload)
      const usage = { input_tokens: Number(payload.usage?.input_tokens ?? payload.usage?.prompt_tokens ?? 0), output_tokens: Number(payload.usage?.output_tokens ?? payload.usage?.completion_tokens ?? 0) }
      let candidate: unknown
      try {
        candidate = parseStructured(content)
      } catch (error) {
        if (error instanceof AiError) {
          throw new AiError(error.message, error.code, error.retryable, payload.request_id)
        }
        throw error
      }
      const parsed = request.schema.safeParse(candidate)
      if (!parsed.success) {
        // Report only schema paths/codes: never include model output or source PDF text.
        const details = parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.length ? issue.path.join('.') : 'root'} (${issue.code})`)
          .join('; ')
        throw new AiError(
          `The response did not match the expected shape. Invalid fields: ${details || 'unknown'}.`,
          'schema',
          false,
          payload.request_id,
        )
      }

      return {
        data: parsed.data,
        usage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
        },
      }
    } catch (error) {
      lastError = error
      const mapped = timeout.didTimeout()
        ? new AiError('The model took too long to respond. Try again.', 'network', true)
        : error instanceof AiError ? error : mapError(error)
      if (mapped.code === 'aborted') throw mapped

      const shouldRetry =
        mapped.retryable && attempt < attempts - 1
      if (!shouldRetry) throw mapped

      await sleep(1500 * (attempt + 1))
    } finally {
      timeout.cleanup()
    }
  }

  const finalError = mapError(lastError)
  if (finalError.code === 'overloaded') {
    throw new AiError(
      'Hosted AI is temporarily overloaded. Your PDF was read successfully; wait a minute and retry generation.',
      'overloaded',
      true,
      finalError.requestId,
    )
  }
  throw finalError
}

/**
 * One structured generation call, with one retry.
 *
 * The retry exists because a model occasionally returns a shape that misses
 * the schema by a hair; it is not for rate limits, which are surfaced to the
 * student so they can decide whether to wait or switch models.
 */
export async function generateStructured<T>(
  request: StructuredRequest<T>,
): Promise<{ data: T; usage: AiUsage }> {
  // Both modes run server-side: hosted uses the site's provider key; BYOK retrieves the student's Vault-encrypted key.
  return generateStructuredViaProxy(request, request.useProxy ? 'hosted' : 'byok')


}


export interface TextRequest { system:string; prompt:string; model:AiModel; maxTokens?:number; baseUrl?:string; signal?:AbortSignal; useProxy?:boolean }
function extractText(value:unknown):string {
 if(typeof value==='string')return value.trim()
 if(Array.isArray(value))return value.map((x)=>typeof x?.text==='string'?x.text:'').filter(Boolean).join('\\n').trim()
 if(!value||typeof value!=='object')return ''
 const x=value as Record<string,any>
 if(typeof x.output_text==='string')return x.output_text.trim()
 if(x.content!==undefined)return extractText(x.content)
 if(Array.isArray(x.choices)&&x.choices[0])return extractText(x.choices[0].message?.content??x.choices[0].text)
 if(x.message?.content!==undefined)return extractText(x.message.content)
 return ''
}
function parseStructured(value:unknown):unknown {
 if(typeof value!=='string')return value
 const cleaned=value.trim().replace(/^\\uFEFF/,'').replace(/^\\s*```(?:json)?\\s*/i,'').replace(/\\s*```\\s*$/,'')
 try{return JSON.parse(cleaned)}catch{
  const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}')
  if(start>=0&&end>start){try{return JSON.parse(cleaned.slice(start,end+1))}catch{/* invalid */}}
  throw new AiError('The provider returned invalid structured data. No duplicate retry was sent.','schema')
 }
}
export async function generateText(request:TextRequest):Promise<{text:string;usage:AiUsage}> {
 const timeout=createTimedSignal(request.signal)
 try{
  if(!supabase)throw new AiError('Account-backed AI needs a signed-in Study Hub account.','auth')
  const {data:sessionData,error:sessionError}=await supabase.auth.getSession()
  if(sessionError)throw new AiError('Your sign-in session could not be checked. Sign in again.','auth')
  const token=sessionData.session?.access_token
  if(!token)throw new AiError('Sign in to use this AI connection.','auth')
  const publicKey=(import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined)?.trim()
  if(!publicKey)throw new AiError('The Supabase public key is missing.','unknown')
  const mode=request.useProxy?'hosted':'byok'
  const response=await fetch(mode==='hosted'?aiProxyUrl():byokProxyUrl(),{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:`Bearer ${token}`},
   body:JSON.stringify({system:request.system,prompt:request.prompt,model:request.model,max_tokens:request.maxTokens??32,...(mode==='byok'&&request.baseUrl?{base_url:request.baseUrl}:{})}),
   signal:timeout.signal,
  })
  const payload=await response.json().catch(()=>null)
  if(!response.ok){
   const requestId=payload?.request_id??response.headers.get('x-request-id')??undefined
   if(response.status===401)throw new AiError('Your sign-in session has expired. Sign in again.','auth',false,requestId)
   if(payload?.code==='BYOK_NOT_CONFIGURED')throw new AiError('Add your private provider key in Settings first.','missing-key',false,requestId)
   if(payload?.code==='BYOK_AUTH_ERROR')throw new AiError('Your saved personal key was rejected. Replace it in Settings.','auth',false,requestId)
   const detail=typeof payload?.error==='string'?payload.error:`Proxy returned ${response.status}`
   const mapped=mapError({status:response.status,message:detail})
   throw new AiError(mapped.message,mapped.code,mapped.retryable,requestId)
  }
  const text=extractText(payload?.content??payload?.output_text??payload)
  if(!text)throw new AiError('The provider returned an empty response.','schema',false,payload?.request_id)
  return {text,usage:{inputTokens:Number(payload?.usage?.input_tokens??payload?.usage?.prompt_tokens??0),outputTokens:Number(payload?.usage?.output_tokens??payload?.usage?.completion_tokens??0)}}
 }catch(error){if(timeout.didTimeout())throw new AiError('The model took too long to respond.','network',true);throw mapError(error)}
 finally{timeout.cleanup()}
}

function mapError(error: unknown): AiError {
  if (error instanceof AiError) return error

  const record = error as { status?: number; message?: string; name?: string }
  const status = record?.status
  const message = redactSecrets(record?.message ?? 'Something went wrong talking to the model.')

  if (record?.name === 'AbortError') {
    return new AiError('Generation stopped.', 'aborted')
  }
  if (status === 401 || status === 403) {
    return new AiError(
      'That API key was rejected. Check it in Settings — keys are case-sensitive.',
      'auth',
    )
  }
  if (status === 429) {
    return new AiError(
      'Rate limit reached. Wait a minute, or switch to a smaller model in Settings.',
      'rate-limit',
    )
  }
  if (status === 529 || status === 503) {
    return new AiError(
      'The model is busy right now. Try again in a minute.',
      'overloaded',
      true,
    )
  }
  if (status && status >= 500) {
    return new AiError('The model service had a problem. Try again shortly.', 'overloaded', true)
  }
  if ((status === 400 || status === 404) && /model.{0,30}(not found|unknown|unsupported|unavailable)|(?:not found|unknown|unsupported).{0,30}model/i.test(message)) {
    return new AiError('The selected model is not available on this provider.', 'model-unavailable')
  }
  if (status === 400) {
    return new AiError(
      `The request was rejected: ${message.slice(0, 200)}`,
      'unknown',
    )
  }
  if (
    record?.name === 'APIConnectionError' ||
    /fetch|network|Failed to fetch/i.test(message)
  ) {
    return new AiError(
      'Could not reach the model. Check your connection, and the base URL if you set one.',
      'network',
      true,
    )
  }
  return new AiError(message.slice(0, 300), 'unknown')
}

/** Width of the map stage — the browser is not the bottleneck, the rate limit is. */
export const MAP_CONCURRENCY = 2
