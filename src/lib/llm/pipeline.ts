import { chunkPages, clampPage, findSnippet } from '../chunk'
import { CHEAP_MODEL, formatUsd, tokensToCost } from '../cost'
import { findCatalogOrg, isLinkableUrl } from '../organizations'
import {
  clearGeneratedContent,
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
  QuizDifficulty,
} from '../types'
import { uid } from '../utils'
import { isObjectiveQuestionDocument, parseObjectiveQuestions } from '../objectiveQuestions'
import { AiError, generateStructured, MAP_CONCURRENCY, type AiUsage } from './ai'
import {
  askPrompt,
  cardsPrompt,
  mapPrompt,
  orgsPrompt,
  quizPrompt,
  objectiveVerificationPrompt,
  reducePrompt,
  SYSTEM_BASE,
} from './prompts'
import {
  AskSchema,
  CardsSchema,
  ChunkMapSchema,
  NotesSchema,
  type NotesResult,
  OrgSchema,
  QuizSchema,
  ObjectiveVerificationSchema,
} from './schema'

export type Stage = 'extract' | 'map' | 'reduce' | 'orgs' | 'cards' | 'quiz'

export const STAGE_LABEL: Record<Stage, string> = {
  extract: 'Reading the PDF',
  map: 'Reading each section',
  reduce: 'Building comprehensive notes',
  orgs: 'Finding related organizations',
  cards: 'Building flashcards',
  quiz: 'Writing the test',
}

export interface GenerationResult {
  usage: AiUsage
  costUsd: number
  title: string
  noteId: string
  deckId: string
  keyPointCount: number
  cardCount: number
  questionCount: number
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
  if (evidencePages.length === 0) return 1
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

  // A retry for the same document must not leave duplicate partial artifacts.
  await clearGeneratedContent(doc.id)
  const chunks = chunkPages(pages)
  let usage: AiUsage = { inputTokens: 0, outputTokens: 0 }
  let costUsd = 0

  // ── map: one call per bounded page chunk ────────────────────────────────
  // The cheapest model reads the source. If that model is unavailable or
  // overloaded, move the remainder of this document to the selected model.
  const mapModel = options.mapModel ?? CHEAP_MODEL
  let activeMapModel = mapModel
  const callMap = (prompt: string, maxTokens: number, withModel: AiModel) =>
    generateStructured({
      schema: ChunkMapSchema,
      system: SYSTEM_BASE,
      prompt,
      model: withModel,
      maxTokens,
      effort: 'low',
      baseUrl,
      signal,
      useProxy,
      repairSchemaErrors: true,
    })
  const callMapWithFallback = async (prompt: string, maxTokens: number) => {
    const firstModel = activeMapModel
    try {
      const result = await callMap(prompt, maxTokens, firstModel)
      return { ...result, usedModel: firstModel }
    } catch (error) {
      const canUseSelectedModel =
        error instanceof AiError &&
        (error.code === 'model-unavailable' || error.code === 'overloaded') &&
        firstModel !== model
      if (!canUseSelectedModel) throw error
      activeMapModel = model
      const result = await callMap(prompt, maxTokens, model)
      return { ...result, usedModel: model }
    }
  }

  onStage?.('map', `${chunks.length} sections`)
  let mapped = 0
  // Hosted requests are serialized to avoid overwhelming the shared provider.
  const mapConcurrency = useProxy ? 2 : Math.min(3, MAP_CONCURRENCY + 1)
  // A single dense section can still produce an overlong point even when
  // the PDF was chunked. If the map response exceeds a schema limit, split
  // that section into smaller page ranges and map them independently. This
  // preserves source page citations and avoids throwing away the whole PDF.
  type MappedChunk = {
    chunk: (typeof chunks)[number]
    summary: string
    keyPoints: Array<{ heading: string; body: string; page: number }>
    usage: AiUsage
    usedModel: AiModel
  }
  const splitChunk = (chunk: (typeof chunks)[number]) => {
    const midpoint = Math.floor((chunk.fromPage + chunk.toPage) / 2)
    const makeHalf = (fromPage: number, toPage: number) => {
      const local = chunkPages(pages.slice(fromPage - 1, toPage), Number.MAX_SAFE_INTEGER, 0)[0]
      return {
        ...local,
        fromPage,
        toPage,
        text: local.text.replace(/<page n="(\d+)"/g, (_match, page) =>
          `<page n="${Number(page) + fromPage - 1}"`,
        ),
      }
    }
    return [makeHalf(chunk.fromPage, midpoint), makeHalf(midpoint + 1, chunk.toPage)]
  }
  const mapChunkResilient = async (
    chunk: (typeof chunks)[number],
    depth = 0,
  ): Promise<MappedChunk[]> => {
    ensureNotAborted(signal)
    try {
      const result = await callMapWithFallback(
        mapPrompt({
          fromPage: chunk.fromPage,
          toPage: chunk.toPage,
          pageCount,
          title: doc.title,
          chunkText: chunk.text,
        }),
        6000,
      )
      mapped += 1
      onStage?.('map', `${mapped} sections completed (smaller sections are created automatically when needed)`)
      return [{ chunk, ...result.data, usage: result.usage, usedModel: result.usedModel }]
    } catch (error) {
      if (error instanceof AiError && error.usage) {
        usage = addUsage(usage, error.usage)
        costUsd += tokensToCost(activeMapModel, error.usage.inputTokens, error.usage.outputTokens)
      }
      const isSizeFailure =
        error instanceof AiError &&
        error.code === 'schema' &&
        /too_big/i.test(error.message)
      const canSplit = chunk.toPage > chunk.fromPage && depth < 6
      if (!isSizeFailure || !canSplit) throw error

      const [left, right] = splitChunk(chunk)
      onStage?.('map', `Breaking pages ${chunk.fromPage}–${chunk.toPage} into smaller sections`)
      // The outer worker pool already caps concurrency; split retries remain sequential.
      const leftResults = await mapChunkResilient(left, depth + 1)
      const rightResults = await mapChunkResilient(right, depth + 1)
      return [...leftResults, ...rightResults]
    }
  }
  const mappedGroups = await pool(chunks, mapConcurrency, (chunk) => mapChunkResilient(chunk))
  const maps = mappedGroups.flat()

  usage = addUsage(usage, maps.reduce((total, item) => addUsage(total, item.usage), { inputTokens: 0, outputTokens: 0 }))
  costUsd += maps.reduce((total, item) => total + tokensToCost(item.usedModel, item.usage.inputTokens, item.usage.outputTokens), 0)
  ensureNotAborted(signal)

  // Keep every validated section digest. Compressing them into a small final
  // prompt was the main source of information loss on long PDFs.
  type DigestRecord = { fromPage: number; toPage: number; text: string }
  const digestRecords: DigestRecord[] = maps.map((m) => ({
    fromPage: m.chunk.fromPage,
    toPage: m.chunk.toPage,
    text:
      `── pages ${m.chunk.fromPage}–${m.chunk.toPage} ──\n${m.summary}\n` +
      m.keyPoints
        .map((kp) => `- (p.${clampPage(kp.page, m.chunk.fromPage, m.chunk.toPage)}) ${kp.heading}: ${kp.body}`)
        .join('\n'),
  }))
  // ── reduce: comprehensive notes in small, loss-minimising batches ──────
  onStage?.('reduce', `Writing detailed notes from ${digestRecords.length} source sections`)
  const reduceBatch = async (records: DigestRecord[], depth = 0): Promise<NotesResult[]> => {
    ensureNotAborted(signal)
    try {
      const result = await generateStructured({
        schema: NotesSchema,
        system: SYSTEM_BASE,
        prompt: reducePrompt({
          title: doc.title,
          pageCount,
          digests: records.map((item) => item.text).join('\n\n'),
        }),
        model,
        maxTokens: 12000,
        effort: 'medium',
        baseUrl,
        signal,
        useProxy,
        repairSchemaErrors: true,
      })
      usage = addUsage(usage, result.usage)
      costUsd += tokensToCost(model, result.usage.inputTokens, result.usage.outputTokens)
      return [result.data]
    } catch (error) {
      if (error instanceof AiError && error.usage) {
        usage = addUsage(usage, error.usage)
        costUsd += tokensToCost(model, error.usage.inputTokens, error.usage.outputTokens)
      }
      const isSchemaFailure = error instanceof AiError && error.code === 'schema'
      if (!isSchemaFailure || records.length < 2 || depth >= 4) throw error
      const midpoint = Math.ceil(records.length / 2)
      const left = records.slice(0, midpoint)
      const right = records.slice(midpoint)
      onStage?.('reduce', `Rebalancing a long synthesis into smaller batches · ${records.length} source sections`)
      // Bounded parallel workers shorten elapsed time without flooding a provider.
      const concurrency = useProxy ? 2 : 3
      const nested = await pool([left, right], concurrency, (batch) => reduceBatch(batch, depth + 1))
      return nested.flat()
    }
  }

  const reduceGroups: DigestRecord[][] = []
  for (let index = 0; index < digestRecords.length; index += 3) {
    reduceGroups.push(digestRecords.slice(index, index + 3))
  }
  let completedReduceGroups = 0
  const reducedGroups = await pool(reduceGroups, useProxy ? 2 : 3, async (records) => {
    ensureNotAborted(signal)
    const parts = await reduceBatch(records)
    completedReduceGroups += 1
    onStage?.('reduce', `Detailed sections completed · ${completedReduceGroups} of ${reduceGroups.length}`)
    return {
      fromPage: records[0].fromPage,
      toPage: records[records.length - 1].toPage,
      parts,
    }
  })
  ensureNotAborted(signal)
  const reducedParts = reducedGroups.flatMap((group) => group.parts)
  const reduced = {
    data: {
      title: reducedParts[0]?.title || doc.title,
      // No arbitrary character cap: every section remains in the saved note.
      summary: reducedGroups.map((group) =>
        `## Pages ${group.fromPage}–${group.toPage}\n\n${group.parts.map((part) => part.summary).join('\n\n')}`,
      ).join('\n\n'),
      takeaways: [...new Set(reducedParts.flatMap((part) => part.takeaways))].slice(0, 8),
      keyPoints: (() => {
        const seen = new Set<string>()
        return reducedParts.flatMap((part) => part.keyPoints).filter((point) => {
          const heading = point.heading.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
          const key = `${heading}|p.${point.page}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      })(),
    },
  }

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
    const proposedPage = Number.isFinite(kp.page) ? Math.round(kp.page) : (evidencePages[0] ?? 1)
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

  // ── quiz: import source questions only; AI tests are generated on demand ──
  onStage?.('quiz', 'Ready to build a test with the student’s chosen question count')
  const parsedObjectiveQuestions = parseObjectiveQuestions(doc.pages)
  let questions: QuizQuestion[] = []

  if (isObjectiveQuestionDocument(parsedObjectiveQuestions)) {
    questions = parsedObjectiveQuestions.map((raw) => ({
      id: uid('q'),
      deckId,
      documentId: doc.id,
      stem: raw.stem,
      options: raw.options,
      answerIndex: raw.answerIndex,
      explanation: `Answer supplied by the source: ${String.fromCharCode(65 + raw.answerIndex)}. ${raw.answerText}`,
      page: raw.page,
      sourceType: 'original' as const,
      sourceNumber: raw.number,
      sourceAnswerText: raw.answerText,
    }))
    await saveQuestions(questions)
  }

  return {
    usage,
    costUsd,
    title: note.title,
    noteId,
    deckId,
    keyPointCount: keyPoints.length,
    cardCount: cards.length,
    questionCount: questions.length,
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
  difficulty?: QuizDifficulty
}): Promise<{ questions: QuizQuestion[]; costUsd: number; usage: AiUsage }> {
  const { deck, keyPoints, pageCount, model, baseUrl, signal, useProxy } = options
  const count = Math.min(100, Math.max(1, Math.round(options.count ?? 20)))
  const difficulty = options.difficulty ?? 'progressive'
  if (!keyPoints.length) throw new AiError('This document has no source concepts to build a test from.', 'schema')

  const batchSize = 20
  const batches = Array.from({ length: Math.ceil(count / batchSize) }, (_, index) => ({
    index,
    count: Math.min(batchSize, count - index * batchSize),
  }))

  const generatedBatches = await pool(batches, useProxy ? 2 : 3, async (batch) => {
    ensureNotAborted(signal)
    // Partition concepts across workers so long tests cover the full document
    // instead of asking every worker to repeatedly sample the same opening topics.
    const selected = keyPoints.filter((_, index) => index % batches.length === batch.index)
    const sourcePoints = selected.length ? selected : keyPoints
    const listing = sourcePoints
      .map((kp, index) => `[${index}] (p.${kp.page}) ${kp.heading}\n${kp.body}`)
      .join('\n\n')

    const batchDifficulty: Exclude<QuizDifficulty, 'progressive'> = difficulty === 'progressive'
      ? batches.length === 1 || batch.index === 0
        ? 'foundational'
        : batch.index === batches.length - 1
          ? 'advanced'
          : 'exam'
      : difficulty

    const result = await generateStructured({
      schema: QuizSchema,
      system: SYSTEM_BASE,
      prompt: quizPrompt({ keyPoints: listing, pageCount, count: batch.count, difficulty: batchDifficulty }),
      model,
      maxTokens: 8000,
      effort: 'medium',
      baseUrl,
      signal,
      useProxy,
    })
    return { sourcePoints, data: result.data, usage: result.usage }
  })

  let usage: AiUsage = { inputTokens: 0, outputTokens: 0 }
  const questions: QuizQuestion[] = []
  const seenStems = new Set<string>()
  for (const batch of generatedBatches) {
    usage = addUsage(usage, batch.usage)
    for (const raw of batch.data.questions) {
      const keyPoint = batch.sourcePoints[raw.keyPointIndex]
      if (!keyPoint || raw.options.length !== 4) continue
      const normalisedStem = raw.stem.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (!normalisedStem || seenStems.has(normalisedStem)) continue
      seenStems.add(normalisedStem)
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
  }

  if (questions.length < count) {
    const missing = count - questions.length
    const listing = keyPoints
      .map((kp, index) => `[${index}] (p.${kp.page}) ${kp.heading}\n${kp.body}`)
      .join('\n\n')
    const refill = await generateStructured({
      schema: QuizSchema,
      system: SYSTEM_BASE,
      prompt: quizPrompt({
        keyPoints: listing,
        pageCount,
        count: missing,
        difficulty: difficulty === 'progressive' ? 'exam' : difficulty,
        avoidQuestions: questions.map((question) => question.stem),
      }),
      model,
      maxTokens: 8000,
      effort: 'medium',
      baseUrl,
      signal,
      useProxy,
    })
    usage = addUsage(usage, refill.usage)
    for (const raw of refill.data.questions) {
      const keyPoint = keyPoints[raw.keyPointIndex]
      if (!keyPoint || raw.options.length !== 4) continue
      const normalisedStem = raw.stem.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (!normalisedStem || seenStems.has(normalisedStem)) continue
      seenStems.add(normalisedStem)
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
  }

  if (questions.length < count) {
    throw new AiError(`The model produced ${questions.length} distinct questions out of ${count} requested. Try again or choose a smaller test.`, 'schema')
  }

  await saveQuestions(questions)
  return { questions, costUsd: tokensToCost(model, usage.inputTokens, usage.outputTokens), usage }
}


/**
 * Independently reviews the answer key of imported objective questions.
 * The source answerIndex is never changed; verifiedAnswerIndex is advisory.
 */
export async function factCheckObjectiveQuestions(options: {
  questions: QuizQuestion[]
  model: AiModel
  baseUrl?: string
  signal?: AbortSignal
  useProxy?: boolean
}): Promise<{
  questions: QuizQuestion[]
  checked: number
  correct: number
  incorrect: number
  ambiguous: number
  contextDependent: number
  costUsd: number
  usage: AiUsage
}> {
  const sourceQuestions = options.questions.filter((question) => question.sourceType === 'original')
  if (sourceQuestions.length === 0) {
    throw new AiError('This document has no imported objective questions to review.', 'schema')
  }

  let usage: AiUsage = { inputTokens: 0, outputTokens: 0 }
  let costUsd = 0
  const reviewed = new Map<string, QuizQuestion>()

  for (let offset = 0; offset < sourceQuestions.length; offset += 12) {
    ensureNotAborted(options.signal)
    const batch = sourceQuestions.slice(offset, offset + 12)
    const payload = batch.map((question) => ({
      questionId: question.id,
      number: question.sourceNumber,
      stem: question.stem,
      options: question.options.map((text, index) => ({
        index,
        letter: String.fromCharCode(65 + index),
        text,
      })),
      suppliedAnswer: {
        index: question.answerIndex,
        letter: String.fromCharCode(65 + question.answerIndex),
        text: question.options[question.answerIndex],
      },
    }))

    const result = await generateStructured({
      schema: ObjectiveVerificationSchema,
      system: SYSTEM_BASE,
      prompt: objectiveVerificationPrompt({ questions: JSON.stringify(payload) }),
      model: options.model,
      maxTokens: 5000,
      effort: 'low',
      baseUrl: options.baseUrl,
      signal: options.signal,
      useProxy: options.useProxy,
    })
    usage = addUsage(usage, result.usage)
    costUsd += tokensToCost(options.model, result.usage.inputTokens, result.usage.outputTokens)

    const batchIds = new Set(batch.map((question) => question.id))
    for (const review of result.data.results) {
      if (!batchIds.has(review.questionId)) continue
      const original = batch.find((question) => question.id === review.questionId)
      if (!original) continue
      reviewed.set(original.id, {
        ...original,
        verificationStatus: review.status,
        verifiedAnswerIndex: review.correctAnswerIndex,
        verificationNote: review.note,
      })
    }
  }

  const questions = options.questions.map((question) => reviewed.get(question.id) ?? question)
  await saveQuestions(questions)
  const checked = questions.filter((question) => question.verificationStatus).length
  return {
    questions,
    checked,
    correct: questions.filter((question) => question.verificationStatus === 'correct').length,
    incorrect: questions.filter((question) => question.verificationStatus === 'incorrect').length,
    ambiguous: questions.filter((question) => question.verificationStatus === 'ambiguous').length,
    contextDependent: questions.filter((question) => question.verificationStatus === 'context_dependent').length,
    costUsd,
    usage,
  }
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
