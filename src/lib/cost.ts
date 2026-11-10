import { estimatePdfTokens } from './chunk'
import type { AiModel } from './types'

export interface ModelInfo {
  id: AiModel
  label: string
  inputPerMTok: number
  outputPerMTok: number
  note: string
}

export const MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-5-5',
    label: 'Opus 5.5',
    inputPerMTok: 4,
    outputPerMTok: 20,
    note: 'Best notes and best questions. Costs the most.',
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Sonnet 5.5',
    inputPerMTok: 2,
    outputPerMTok: 10,
    note: 'Good notes at about half the price. A sensible default.',
  },
  {
    id: 'claude-haiku-5-5',
    label: 'Haiku 5.5',
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    note: 'Cheapest by far. Fine for well-formatted slides, thinner on nuance.',
  },
]

export function modelInfo(id: AiModel): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[1]
}

export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  usd: number
}

/**
 * Deliberately approximate — the point is that the student sees a number
 * before pressing the button, not that the number is to the cent.
 *
 * Assumptions: notes/key points/cards/orgs together cost about half the input
 * again as output; a 40-page PDF lands near the $0.24–$0.48 range.
 */
export function estimateGenerationCost(pages: string[], model: AiModel): CostEstimate {
  const bodyTokens = estimatePdfTokens(pages)
  const chunkCount = Math.max(1, Math.ceil(bodyTokens / 5_000))

  // Map stage re-sends each chunk plus a prompt; reduce/orgs/cards work from
  // compact summaries.
  const inputTokens = Math.round(bodyTokens * 1.15 + chunkCount * 1_200 + 6_000)
  const outputTokens = Math.round(bodyTokens * 0.42 + 4_000)

  const info = modelInfo(model)
  const usd =
    (inputTokens / 1_000_000) * info.inputPerMTok +
    (outputTokens / 1_000_000) * info.outputPerMTok

  return { inputTokens, outputTokens, usd }
}

export function formatUsd(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.01) return '< $0.01'
  if (usd < 1) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(2)}`
}

/** Rough naira figure so the cost is legible in local terms. */
export function nairaHint(usd: number, rate = 1600): string {
  const naira = usd * rate
  if (naira < 50) return 'under ₦50'
  return `₦${Math.round(naira / 10) * 10}`
}

export function tokensToCost(
  model: AiModel,
  inputTokens: number,
  outputTokens: number,
): number {
  const info = modelInfo(model)
  return (
    (inputTokens / 1_000_000) * info.inputPerMTok +
    (outputTokens / 1_000_000) * info.outputPerMTok
  )
}
