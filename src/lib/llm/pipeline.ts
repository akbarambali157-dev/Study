import { chunkPages, clampPage, findSnippet } from '../chunk'
import { CHEAP_MODEL, formatUsd, tokensToCost } from '../cost'
import { findCatalogOrg, isLinkableUrl } from '../organizations'
import {
  saveCards,
  saveDeck,
  saveKeyPoints,
  saveNote,
  saveOrgs,
  saveQuestions,
} from '../store'
import type {
  AiModel,
  Card,
  Deck,
  DocumentRec,
  KeyPoint,
  Note,
  Org,
  QuizQuestion,
} from '../types'
import { uid } from '../utils'
import { AiError, generateStructured, MAP_CONCURRENCY, type AiUsage } from './ai'
import {
  askPrompt,
  cardsPrompt,
  mapPrompt,
  orgsPrompt,
  quizPrompt,
  reducePrompt,
  SYSTEM_BASE,
} from './prompts'
import {
  AskSchema,
  CardsSchema,
  ChunkMapSchema,
  NotesSchema,
  OrgSchema,
  QuizSchema,
} from './schema'

export type Stage = 'extract' | 'map' | 'reduce' | 'orgs' | 'cards' | 'quiz'

export const STAGE_LABEL: Record<Stage, string> = {
  extract: 'Reading the PDF',
  map: 'Reading each section',
  reduce: 'Writing your short notes',
  orgs: 'Finding related organizations',
  cards: 'Building flashcards',
  quiz: 'Writing the test',
}

export interface GenerationResult {
  usage: AiUsage
  costUsd: number
  noteId: string
  deckId: string
  keyPointCount: number
  cardCount: number
  orgCount: number
}

export interface PipelineOptions {
  doc: DocumentRec
  model: AiModel
  /** Overrides the cheap default for the per-chunk map stage. */
  mapModel?: AiModel
  baseUrl?: string
  signal?: AbortSignal
  onStage?: (stage: Stage, detail?: string) => void
  /** When true, the site provides the model via the Supabase Edge Function. */
  useProxy?: boolean
}

function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  }
}

function ensureNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AiError('Generation stopped.', 'aborted')
}

function nearestEvidencePage(page: number, evidencePages: number[]): number {
  return evidencePages.reduce((best, candidate) =>
    Math.abs(candidate - page) < Math.abs(best - page) ? candidate : best,
  )
}

/** Runs tasks with a small concurrency cap — friendlier to rate limits. */
async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function run() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

/**
 * The whole generation, in the order a student would explain it:
 * read the pages, write the notes, pull out the key points, then everything
 * that hangs off those key points.
 */
export async function generateStudyMaterial(
  options: PipelineOptions,
): Promise<GenerationResult> {
  const { doc, model, baseUrl, signal, onStage, useProxy } = options
  const pages = doc.pages
  const pageCount = pages.length

  if (!pageCount) {
    throw new AiError('This document has no readable pages.', 'unknown')
  }

  const chunks = chunkPages(pages)
  let usage: AiUsage = { inputTokens: 0, outputTokens: 0 }
  let costUsd = 0

  // ── map: one call per chunk ────────────────────────────────────────────
  // This is the stage that sends the whole document, so it runs on the cheapest
  // capable model by default. It only has to summarise one chunk at a time; the
  // judgement calls happen later, on the summaries, with the chosen model.
  const mapModel = options.mapModel ?? CHEAP_MODEL
  onStage?.('map', `${chunks.length} section${chunks.length === 1 ? '' : 's'}`)
  let mapped = 0

  const maps = await pool(chunks, MAP_CONCURRENCY, async (chunk) => {
    ensureNotAborted(signal)

    const call = (withModel: AiModel) =>
      generateStructured({
        schema: ChunkMapSchema,
        system: SYSTEM_BASE,
        prompt: mapPrompt({
          fromPage: chunk.fromPage,
          toPage: chunk.toPage,
          pageCount,
          title: doc.title,
          chunkText: chunk.text,
        }),
        model: withModel,
        maxTokens: 4000,
        effort: 'low',
        baseUrl,
        signal,
        useProxy,
      })

    let result
    let usedModel = mapModel
    try {
      result = await call(mapModel)
    } catch (error) {
      // Fall back only when the provider explicitly rejects this model. Network,
      // authentication and rate-limit errors must not trigger a second paid call.
      if (error instanceof AiError && error.code === 'aborted') throw error
      if (!(error instanceof AiError) || error.code !== 'model-unavailable' || mapModel === model) throw error
      usedModel = model
      result = await call(model)
    }

    const { data, usage: chunkUsage } = result
    mapped += 1
    onStage?.('map', `${mapped} of ${chunks.length}`)

    return { chunk, ...data, usage: chunkUsage, usedModel }
  })

  usage = addUsage(usage, maps.reduce((total, item) => addUsage(total, item.usage), { inputTokens: 0, outputTokens: 0 }))
  costUsd += maps.reduce((total, item) => total + tokensToCost(item.usedModel, item.usage.inputTokens, item.usage.outputTokens), 0)
  ensureNotAborted(signal)

  const digests = maps
    .map(
      (m) =>
        `── pages ${m.chunk.fromPage}–${m.chunk.toPage} ──\n${m.summary}\n` +
        m.keyPoints
          .map((kp) => `- (p.${clampPage(kp.page, m.chunk.fromPage, m.chunk.toPage)}) ${kp.heading}: ${kp.body}`)
          .join('\n'),
    )
    .join('\n\n')

  // ── reduce: short notes + key points ───────────────────────────────────
  onStage?.('reduce')
  const reduced = await generateStructured({
    schema: NotesSchema,
    system: SYSTEM_BASE,
    prompt: reducePrompt({ title: doc.title, pageCount, digests }),
    model,
    maxTokens: 12000,
    effort: 'medium',
    baseUrl,
    signal,
    useProxy,
  })
  usage = addUsage(usage, reduced.usage)
  costUsd += tokensToCost(model, reduced.usage.inputTokens, reduced.usage.outputTokens)

  ensureNotAborted(signal)

  const evidencePages = Array.from(
    new Set(maps.flatMap((m) => m.keyPoints.map((kp) => clampPage(kp.page, m.chunk.fromPage, m.chunk.toPage)))),
  ).sort((a, b) => a - b)

  const noteId = uid('note')
  const note: Note = {
    id: noteId,
    documentId: doc.id,
    title: reduced.data.title || doc.title,
    summary: reduced.data.summary,
    takeaways: reduced.data.takeaways,
    model,
    createdAt: new Date().toISOString(),
  }
  await saveNote(note)

  const keyPoints: KeyPoint[] = reduced.data.keyPoints.map((kp, index) => {
    const proposedPage = Number.isFinite(kp.page) ? Math.round(kp.page) : evidencePages[0]
    const hasEvidencePage = evidencePages.includes(proposedPage)
    const page = hasEvidencePage ? proposedPage : nearestEvidencePage(proposedPage, evidencePages)
    return {
      id: uid('kp'),
      documentId: doc.id,
      noteId,
      position: index,
      heading: kp.heading,
      body: kp.body,
      example: kp.example,
      page,
      confidence: Math.min(hasEvidencePage ? 1 : 0.25, Math.max(0, kp.confidence)),
      // The snippet is taken from the real page text, never from the model,
      // so what the student checks is what the PDF actually says.
      snippet: findSnippet(pages, page, kp.heading),
      tags: kp.tags.map((t) => t.toLowerCase().trim()).filter(Boolean),
    }
  })
  await saveKeyPoints(keyPoints)

  const keyPointListing = keyPoints
    .map((kp, i) => `[${i}] (p.${kp.page}) ${kp.heading}\n${kp.body}`)
    .join('\n\n')

  // ── organizations ──────────────────────────────────────────────────────
  onStage?.('orgs')
  let orgCount = 0
  try {
    const orgResult = await generateStructured({
      schema: OrgSchema,
      system: SYSTEM_BASE,
      prompt: orgsPrompt({ keyPoints: keyPointListing }),
      model,
      maxTokens: 5000,
      effort: 'low',
      baseUrl,
      signal,
      useProxy,
    })
    usage = addUsage(usage, orgResult.usage)
    costUsd += tokensToCost(model, orgResult.usage.inputTokens, orgResult.usage.outputTokens)

    const orgs: Org[] = []

    for (const link of orgResult.data.links) {
      const keyPoint = keyPoints[link.keyPointIndex]
      const org = findCatalogOrg(link.slug)
      // Unknown slugs are dropped rather than trusted: the catalogue is the
      // allowlist, so an invented body can never become a link.
      if (!keyPoint || !org) continue
      orgs.push({
        id: uid('org'),
        keyPointId: keyPoint.id,
        documentId: doc.id,
        name: org.name,
        kind: org.kind,
        url: org.url,
        why: link.why,
        verified: true,
      })
    }

    for (const proposal of orgResult.data.proposed) {
      const keyPoint = keyPoints[proposal.keyPointIndex]
      if (!keyPoint) continue
      const linkable = isLinkableUrl(proposal.url)
      orgs.push({
        id: uid('org'),
        keyPointId: keyPoint.id,
        documentId: doc.id,
        name: proposal.name,
        kind: proposal.kind,
        // Only a https URL on a known-institution host survives as a link.
        url: linkable ? proposal.url : undefined,
        why: proposal.why,
        verified: false,
      })
    }

    await saveOrgs(orgs)
    orgCount = orgs.length
  } catch (error) {
    // Organizations are a bonus. Losing them must not lose the notes.
    if (error instanceof AiError && error.code === 'aborted') throw error
    orgCount = 0
  }

  ensureNotAborted(signal)

  // ── flashcards ─────────────────────────────────────────────────────────
  onStage?.('cards')
  const cardResult = await generateStructured({
    schema: CardsSchema,
    system: SYSTEM_BASE,
    prompt: cardsPrompt({ keyPoints: keyPointListing, pageCount }),
    model,
    maxTokens: 10000,
    effort: 'medium',
    baseUrl,
    signal,
    useProxy,
  })
  usage = addUsage(usage, cardResult.usage)
  costUsd += tokensToCost(model, cardResult.usage.inputTokens, cardResult.usage.outputTokens)

  const deckId = uid('deck')
  const cards: Card[] = []
  for (const raw of cardResult.data.cards) {
    const keyPoint = keyPoints[raw.keyPointIndex]
    if (!keyPoint) continue
    cards.push({
      id: uid('card'),
      deckId,
      documentId: doc.id,
      keyPointId: keyPoint.id,
      front: raw.front,
      back: raw.back,
      example: raw.example,
      // Cards inherit the evidence page of the key point they test.
      page: keyPoint.page ?? 1,
      tags: keyPoint.tags,
    })
  }

  if (cards.length === 0) {
    throw new AiError(
      'The model did not return usable flashcards. Nothing was saved — try again.',
      'schema',
    )
  }

  const deck: Deck = {
    id: deckId,
    documentId: doc.id,
    title: note.title,
    createdAt: new Date().toISOString(),
  }
  await saveDeck(deck)
  await saveCards(cards)

  return {
    usage,
    costUsd,
    noteId,
    deckId,
    keyPointCount: keyPoints.length,
    cardCount: cards.length,
    orgCount,
  }
}

/* ── tests, generated on demand ────────────────────────────────────────── */

export async function generateTestForDeck(options: {
  deck: Deck
  documentId: string
  keyPoints: KeyPoint[]
  pageCount: number
  model: AiModel
  baseUrl?: string
  signal?: AbortSignal
  useProxy?: boolean
  count?: number
}): Promise<{ questions: QuizQuestion[]; costUsd: number; usage: AiUsage }> {
  const { deck, keyPoints, pageCount, model, baseUrl, signal, useProxy } = options
  const count = Math.min(10, Math.max(4, options.count ?? 8))

  const listing = keyPoints
    .map((kp, i) => `[${i}] (p.${kp.page}) ${kp.heading}\n${kp.body}`)
    .join('\n\n')

  const { data, usage } = await generateStructured({
    schema: QuizSchema,
    system: SYSTEM_BASE,
    prompt: quizPrompt({ keyPoints: listing, pageCount, count }),
    model,
    maxTokens: 8000,
    effort: 'medium',
    baseUrl,
    signal,
    useProxy,
  })

  const questions: QuizQuestion[] = []
  for (const raw of data.questions) {
    const keyPoint = keyPoints[raw.keyPointIndex]
    if (!keyPoint) continue
    if (raw.options.length !== 4) continue
    questions.push({
      id: uid('q'),
      deckId: deck.id,
      documentId: options.documentId,
      keyPointId: keyPoint.id,
      stem: raw.stem,
      options: raw.options,
      answerIndex: raw.answerIndex,
      explanation: raw.explanation,
      page: clampPage(raw.page ?? keyPoint.page ?? 1, 1, pageCount),
    })
  }

  if (questions.length === 0) {
    throw new AiError('No usable questions came back. Try again.', 'schema')
  }

  await saveQuestions(questions)
  return { questions, costUsd: tokensToCost(model, usage.inputTokens, usage.outputTokens), usage }
}

/* ── follow-up questions ───────────────────────────────────────────────── */

export async function askAboutKeyPoint(options: {
  keyPoint: KeyPoint
  noteSummary: string
  question: string
  pageCount: number
  model: AiModel
  baseUrl?: string
  signal?: AbortSignal
  useProxy?: boolean
}) {
  const { data, usage } = await generateStructured({
    schema: AskSchema,
    system: SYSTEM_BASE,
    prompt: askPrompt({
      keyPoint: `${options.keyPoint.heading}\n${options.keyPoint.body}`,
      noteContext: options.noteSummary.slice(0, 6000),
      question: options.question,
      pageCount: options.pageCount,
    }),
    model: options.model,
    maxTokens: 3000,
    effort: 'low',
    baseUrl: options.baseUrl,
    signal: options.signal,
    useProxy: options.useProxy,
  })

  return {
    answer: data.answer,
    // Follow-ups only receive this key point and its note context, so cite the
    // key point's evidence page rather than trusting an arbitrary model page.
    page: options.keyPoint.page ?? 1,
    followUps: data.followUps,
    costLabel: formatUsd(tokensToCost(options.model, usage.inputTokens, usage.outputTokens)),
  }
}
