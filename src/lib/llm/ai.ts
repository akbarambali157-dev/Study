import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ZodType } from 'zod'
import { getApiKey } from '../apiKey'
import { aiProxyUrl, supabase } from '../supabase'
import type { AiModel } from '../types'
import { sleep } from '../utils'

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
  ) {
    super(message)
    this.name = 'AiError'
  }
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

export function createClient(baseUrl?: string): Anthropic {
  const key = getApiKey()
  if (!key) {
    throw new AiError(
      'No API key yet. Add one in Settings — it stays in this browser.',
      'missing-key',
    )
  }

  // Anthropic keys go in x-api-key. Gateway keys are usually Bearer tokens, so
  // anything that isn't an sk-ant- key is sent as an auth token instead.
  const isAnthropicKey = key.startsWith('sk-ant-')
  const trimmedBase = baseUrl?.trim()
  // Vercel may have the hosted BrewKeg endpoint configured as the app default.
  // A personal Anthropic key must go to Anthropic itself, not be sent to the
  // unrelated gateway. Keep a separately entered non-BrewKeg compatible URL
  // available for users who intentionally use an Anthropic-compatible proxy.
  let isHostedGatewayDefault = false
  if (trimmedBase) {
    try {
      isHostedGatewayDefault = new URL(trimmedBase).hostname === 'brewkeg.dev' ||
        new URL(trimmedBase).hostname.endsWith('.brewkeg.dev')
    } catch {
      // Let the SDK return the normal, actionable invalid-URL error below.
    }
  }
  const resolvedBaseUrl = isAnthropicKey && isHostedGatewayDefault ? undefined : trimmedBase?.replace(/\/v1\/?$/, '').replace(/\/$/, '')

  return new Anthropic({
    apiKey: isAnthropicKey ? key : undefined,
    authToken: isAnthropicKey ? undefined : key,
    baseURL: resolvedBaseUrl ? resolvedBaseUrl.replace(/\/$/, '') : undefined,
    // This app holds only the student's own key, on the student's own device.
    // That is the one context where this flag is defensible.
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
  })
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
): Promise<{ data: T; usage: AiUsage }> {
  const attempts = 2
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

      const resp = await fetch(aiProxyUrl(), {
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
          output_config: {
            format: zodOutputFormat(request.schema),
            effort: request.effort ?? 'medium',
          },
        }),
        signal: timeout.signal,
      })

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null)
        if (resp.status === 401) {
          throw new AiError('Your session has expired. Sign in again to use hosted AI.', 'auth')
        }
        const detail = typeof errBody?.error === 'string' ? errBody.error : `Proxy returned ${resp.status}`
        if (resp.status >= 500) {
          throw new AiError(`Hosted AI is not ready: ${redactSecrets(detail)}`, 'overloaded', resp.status === 502 || resp.status === 503)
        }
        throw mapError({
          status: resp.status,
          message: detail,
        })
      }

      const payload = await resp.json() as {content?:unknown;output_text?:unknown}
      const content = extractText(payload.content ?? payload.output_text ?? payload)
      const parsed = request.schema.safeParse(parseStructured(content))
      if (!parsed.success) {
        throw new AiError(
          'The response did not match the expected shape.',
          'schema',
          true,
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

      await sleep(900 * (attempt + 1))
    } finally {
      timeout.cleanup()
    }
  }

  throw mapError(lastError)
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
  // Proxy mode: the site provides the model, key is held server-side.
  if (request.useProxy) {
    return generateStructuredViaProxy(request)
  }

  const client = createClient(request.baseUrl)
  const attempts = 2
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (request.signal?.aborted) {
      throw new AiError('Generation stopped.', 'aborted')
    }

    const timeout = createTimedSignal(request.signal)
    try {
      const message = await client.messages.parse(
        {
          model: request.model,
          max_tokens: request.maxTokens ?? 8000,
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
          output_config: {
            format: zodOutputFormat(request.schema),
            effort: request.effort ?? 'medium',
          },
        },
        { signal: timeout.signal },
      )

      if (message.stop_reason === 'refusal') {
        throw new AiError(
          'The model declined to work with this document. Try a different PDF.',
          'refusal',
        )
      }

      const candidate = message.parsed_output ?? parseStructured(extractText(message.content))
      const validation = request.schema.safeParse(candidate)
      if (!validation.success) throw new AiError('The provider response did not match the required data shape.','schema')
      return {
        data: validation.data,
        usage: {
          inputTokens: message.usage?.input_tokens ?? 0,
          outputTokens: message.usage?.output_tokens ?? 0,
        },
      }
    } catch (error) {
      lastError = error
      const mapped = timeout.didTimeout()
        ? new AiError('The model took too long to respond. Try again.', 'network', true)
        : mapError(error)
      if (mapped.code === 'aborted') throw mapped

      const shouldRetry =
        mapped.retryable && attempt < attempts - 1
      if (!shouldRetry) throw mapped

      await sleep(900 * (attempt + 1))
    } finally {
      timeout.cleanup()
    }
  }

  throw mapError(lastError)
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
  if(request.useProxy){
   if(!supabase)throw new AiError('Hosted AI is not configured.','unknown')
   const {data,error}=await supabase.auth.getSession()
   if(error)throw new AiError('Your sign-in session could not be checked. Sign in again.','auth')
   const token=data.session?.access_token
   if(!token)throw new AiError('Sign in to test hosted AI.','auth')
   const publicKey=(import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined)?.trim()
   if(!publicKey)throw new AiError('The Supabase public key is missing.','unknown')
   const response=await fetch(aiProxyUrl(),{method:'POST',headers:{'Content-Type':'application/json',apikey:publicKey,Authorization:`Bearer ${token}`},body:JSON.stringify({system:request.system,prompt:request.prompt,model:request.model,max_tokens:request.maxTokens??32}),signal:timeout.signal})
   const payload=await response.json().catch(()=>null)
   if(!response.ok)throw mapError({status:response.status,message:payload?.error??`Proxy returned ${response.status}`})
   const text=extractText(payload?.content??payload?.output_text??payload)
   if(!text)throw new AiError('The provider returned an empty response.','schema')
   return {text,usage:{inputTokens:Number(payload?.usage?.input_tokens??payload?.usage?.prompt_tokens??0),outputTokens:Number(payload?.usage?.output_tokens??payload?.usage?.completion_tokens??0)}}
  }
  const message=await createClient(request.baseUrl).messages.create({model:request.model,max_tokens:request.maxTokens??32,system:request.system,messages:[{role:'user',content:request.prompt}]},{signal:timeout.signal})
  const text=extractText(message.content)
  if(!text)throw new AiError('The provider returned an empty response.','schema')
  return {text,usage:{inputTokens:message.usage?.input_tokens??0,outputTokens:message.usage?.output_tokens??0}}
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
