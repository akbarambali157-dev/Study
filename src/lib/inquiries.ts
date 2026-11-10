import { db } from './db'
import { generateStructured } from './llm/ai'
import { profilePrompt, SYSTEM_BASE } from './llm/prompts'
import { ProfileSchema } from './llm/schema'
import { getLearningProfile, logInquiry, saveLearningProfile } from './store'
import type { AiModel, Inquiry, InquiryKind, Interest, LearningProfile } from './types'
import { uid } from './utils'

/** How much each kind of curiosity counts towards a topic's weight. */
const KIND_WEIGHT: Record<InquiryKind, number> = {
  ask: 5,
  search: 4,
  quiz_miss: 4,
  org_click: 3,
  explain_open: 3,
  card_lapse: 3,
  card_flip: 2,
  topic_open: 2,
  note_revisit: 2,
  doc_reopen: 1,
}

const HALF_LIFE_DAYS = 14
const REFRESH_THRESHOLD = 25

export interface TrailEventInput {
  kind: InquiryKind
  documentId?: string
  keyPointId?: string
  cardId?: string
  query?: string
  topic?: string
  payload?: Record<string, unknown>
}

export async function record(event: TrailEventInput): Promise<void> {
  const settings = await db.settings.get('app')
  // Silence is the default if the student has switched the trail off.
  await logInquiry(event, settings?.trailEnabled ?? true)
}

/**
 * Local, free, deterministic roll-up. No model call: the weights are already
 * attached to every event, and recency is a decay function. This is what the
 * Trail page can show instantly, offline, for nothing.
 */
export function computeInterests(inquiries: Inquiry[], limit = 8): Interest[] {
  const now = Date.now()
  const buckets = new Map<string, { weight: number; evidence: string[] }>()

  for (const inquiry of inquiries) {
    const topic = inquiry.topic?.trim()
    if (!topic) continue

    const ageDays = Math.max(0, (now - new Date(inquiry.createdAt).getTime()) / 86_400_000)
    const recency = Math.exp(-ageDays / HALF_LIFE_DAYS)
    const weight = (KIND_WEIGHT[inquiry.kind] ?? 1) * recency

    const bucket = buckets.get(topic) ?? { weight: 0, evidence: [] }
    bucket.weight += weight
    const label = inquiry.query?.trim()
    if (label && bucket.evidence.length < 3 && !bucket.evidence.includes(label)) {
      bucket.evidence.push(label)
    }
    buckets.set(topic, bucket)
  }

  const max = Math.max(1, ...Array.from(buckets.values(), (b) => b.weight))
  return Array.from(buckets.entries())
    .map(([topic, { weight, evidence }]) => ({
      topic,
      weight: Number((weight / max).toFixed(3)),
      evidence,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
}

export function groupByDay(inquiries: Inquiry[]): { day: string; items: Inquiry[] }[] {
  const groups = new Map<string, Inquiry[]>()
  for (const inquiry of inquiries) {
    const day = inquiry.createdAt.slice(0, 10)
    const list = groups.get(day) ?? []
    list.push(inquiry)
    groups.set(day, list)
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({ day, items }))
}

/**
 * The only place the model is asked about the student's trail — one batched
 * call, never one per question. Runs when enough new events have piled up,
 * or when the student explicitly asks for an update.
 */
export async function maybeRefreshProfile(options: {
  model: AiModel
  baseUrl?: string
  force?: boolean
}): Promise<LearningProfile | undefined> {
  const settings = await db.settings.get('app')
  if (settings?.trailEnabled === false) return undefined

  const inquiries = await db.inquiries.orderBy('createdAt').reverse().limit(400).toArray()
  if (inquiries.length < 15) return undefined

  const existing = await getLearningProfile()
  const newEvents = inquiries.length - (existing?.sourceEventCount ?? 0)
  if (!options.force && existing && newEvents < REFRESH_THRESHOLD) return existing

  // Never regenerate on every page open.
  if (
    !options.force &&
    existing &&
    Date.now() - new Date(existing.computedAt).getTime() < 6 * 60 * 60 * 1000
  ) {
    return existing
  }

  const interests = computeInterests(inquiries, 10)
  const documents = await db.documents.toArray()

  const aggregated = interests
    .map((i) => `${i.topic} | ${inquiries.filter((q) => q.topic === i.topic).length} events | ${i.weight}`)
    .join('\n')

  const sampleQueries = inquiries
    .filter((i) => i.query)
    .slice(0, 25)
    .map((i) => `- ${i.kind}: "${i.query}"`)
    .join('\n')

  const documentTitles =
    documents.slice(0, 20).map((d) => `- ${d.title}`).join('\n') || '- (none yet)'

  try {
    const { data } = await generateStructured({
      schema: ProfileSchema,
      system: SYSTEM_BASE,
      prompt: profilePrompt({
        aggregated: aggregated || '(no topics yet)',
        sampleQueries: sampleQueries || '(nothing typed yet)',
        documentTitles,
      }),
      model: options.model,
      maxTokens: 2000,
      effort: 'low',
      baseUrl: options.baseUrl,
    })

    const profile: LearningProfile = {
      id: 'me',
      interests: data.interests.map((i) => ({
        topic: i.topic,
        weight: i.weight,
        evidence: i.evidence,
      })),
      gaps: data.gaps,
      suggestedNext: data.suggestedNext.map((s) => ({
        title: s.title,
        reason: s.reason,
        documentId: matchDocument(s.title, documents.map((d) => ({ id: d.id, title: d.title }))),
      })),
      narrative: data.narrative,
      eventCount: inquiries.length,
      computedAt: new Date().toISOString(),
      sourceEventCount: inquiries.length,
    }

    await saveLearningProfile(profile)
    return profile
  } catch {
    // A failed profile refresh must never break the page: fall back to the
    // free local roll-up.
    const fallback: LearningProfile = {
      id: 'me',
      interests,
      gaps: [],
      suggestedNext: [],
      narrative: '',
      eventCount: inquiries.length,
      computedAt: new Date().toISOString(),
      sourceEventCount: inquiries.length,
    }
    await saveLearningProfile(fallback)
    return fallback
  }
}

function matchDocument(
  title: string,
  documents: { id: string; title: string }[],
): string | undefined {
  const needle = title.toLowerCase()
  const exact = documents.find((d) => d.title.toLowerCase() === needle)
  if (exact) return exact.id
  const partial = documents.find(
    (d) => needle.includes(d.title.toLowerCase()) || d.title.toLowerCase().includes(needle),
  )
  return partial?.id
}

/** Backs the "Your data" panel in Settings. */
export async function exportTrailJson(): Promise<string> {
  const inquiries = await db.inquiries.toArray()
  return JSON.stringify({ exportedAt: new Date().toISOString(), inquiries }, null, 2)
}

export async function clearTrail(): Promise<void> {
  await db.inquiries.clear()
  await db.learningProfile.delete('me')
}

export function newInquiryId(): string {
  return uid('inq')
}
