import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ZodType } from 'zod'
import { getApiKey } from '../apiKey'
import type { AiModel } from '../types'
import { sleep } from '../utils'

export type AiErrorCode =
  | 'missing-key'
  | 'auth'
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

export interface StructuredRequest<T> {
  schema: ZodType<T>
  system: string
  prompt: string
  model: AiModel
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  baseUrl?: string
  signal?: AbortSignal
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
  const client = createClient(request.baseUrl)
  const attempts = 2
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (request.signal?.aborted) {
      throw new AiError('Generation stopped.', 'aborted')
    }

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
        { signal: request.signal },
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
      const mapped = mapError(error)
      if (mapped.code === 'aborted') throw mapped

      const shouldRetry =
        mapped.code === 'schema' || (mapped.retryable && attempt < attempts - 1)
      if (!shouldRetry) throw mapped

      await sleep(900 * (attempt + 1))
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
