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

  return new Anthropic({
    apiKey: isAnthropicKey ? key : undefined,
    authToken: isAnthropicKey ? undefined : key,
    baseURL: trimmedBase ? trimmedBase.replace(/\/$/, '') : undefined,
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
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const resp = await fetch(aiProxyUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          throw new AiError('You need to sign in to use the model.', 'auth')
        }
        throw mapError({
          status: resp.status,
          message: errBody?.error ?? `Proxy returned ${resp.status}`,
        })
      }

      const { content, usage } = (await resp.json()) as {
        content: string
        usage: { input_tokens: number; output_tokens: number }
      }

      // Validate with the same zod schema as the direct path. Malformed JSON
      // is a schema failure, so the bounded repair retry can run.
      let decoded: unknown
      try {
        decoded = JSON.parse(content)
      } catch {
        throw new AiError('The model returned malformed structured data.', 'schema', true)
      }
      const parsed = request.schema.safeParse(decoded)
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
        mapped.code === 'schema' || (mapped.retryable && attempt < attempts - 1)
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

      const parsed = message.parsed_output as T | null | undefined
      if (!parsed) {
        throw new AiError(
          'The response did not match the expected shape.',
          'schema',
          true,
        )
      }

      return {
        data: parsed,
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
        mapped.code === 'schema' || (mapped.retryable && attempt < attempts - 1)
      if (!shouldRetry) throw mapped

      await sleep(900 * (attempt + 1))
    } finally {
      timeout.cleanup()
    }
  }

  throw mapError(lastError)
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
