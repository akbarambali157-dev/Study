import { db } from '@/lib/db'
import type { Card, Deck, DocumentRec, KeyPoint, Note, Org, QuizQuestion } from '@/lib/types'
import type { NavigateFunction } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { nowIso } from '@/lib/utils'

export interface PublicStudyMaterial {
  id: string
  title: string
  content: Record<string, unknown>
  summary?: string
  discipline?: string
  page_count?: number
  tags?: string[]
}

export function publicMaterialCards(material: PublicStudyMaterial): Card[] {
  const raw = material.content.flashcards
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const front = typeof (item as { front?: unknown }).front === 'string' ? (item as { front: string }).front.trim() : ''
    const back = typeof (item as { back?: unknown }).back === 'string' ? (item as { back: string }).back.trim() : ''
    if (!front || !back) return []
    const itemData = item as { front: string; back: string; example?: unknown; page?: unknown; tags?: unknown }
    const example = typeof itemData.example === 'string' ? itemData.example.trim() : undefined
    const page = Number.isInteger(itemData.page) && Number(itemData.page) > 0 ? Number(itemData.page) : undefined
    const tags = Array.isArray(itemData.tags) ? itemData.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 10) : []
    return [{
      id: `public-${material.id}-${index}`,
      deckId: `public-${material.id}`,
      documentId: '',
      front,
      back,
      example,
      page,
      tags: ['community', 'public material', ...tags],
    }]
  })
}


/**
 * Turn a public contribution into the same local learning records used by an
 * uploaded document. The original PDF is optional; approved shared content is
 * enough for notes, key points, flashcards, quizzes and offline study.
 */
export async function importPublicMaterial(material: PublicStudyMaterial): Promise<string> {
  const documentId = `community-${material.id}`
  const deckId = `community-deck-${material.id}`
  const noteId = `community-note-${material.id}`
  const content = material.content ?? {}
  const clean = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  const takeaways = Array.isArray(content.takeaways)
    ? content.takeaways.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).slice(0, 30)
    : []
  const rawPoints = Array.isArray(content.keyPoints) ? content.keyPoints.slice(0, 100) : []
  const keyPoints: KeyPoint[] = rawPoints.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const heading = clean(item.heading) || `Key point ${index + 1}`
    const body = clean(item.body)
    if (!body) return []
    const page = Number.isInteger(item.page) && Number(item.page) > 0 ? Number(item.page) : undefined
    const tags = Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12) : []
    return [{
      id: `${documentId}-point-${index}`, documentId, noteId, position: index,
      heading, body, example: clean(item.example) || undefined, page,
      confidence: 0.8, snippet: body.slice(0, 180), tags,
    }]
  })
  if (!keyPoints.length && takeaways.length) {
    keyPoints.push(...takeaways.map((body, index) => ({
      id: `${documentId}-point-${index}`, documentId, noteId, position: index,
      heading: `Key takeaway ${index + 1}`, body, confidence: 0.8,
      snippet: body.slice(0, 180), tags: ['community'],
    })))
  }
  const summary = clean(material.summary) || clean(content.summary) ||
    (keyPoints.length ? keyPoints.map((point) => `## ${point.heading}\n\n${point.body}`).join('\n\n') : 'A study set shared by the academic community.')
  const note: Note = {
    id: noteId, documentId, title: material.title, summary,
    takeaways, model: 'community contribution', createdAt: nowIso(),
  }
  const cards = publicMaterialCards({ ...material, content }).map((card, index) => ({
    ...card, id: `${documentId}-card-${index}`, deckId, documentId,
  }))
  const rawOrgs = Array.isArray(content.organizations) ? content.organizations.slice(0, 100) : []
  const orgs: Org[] = rawOrgs.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const name = clean(item.name)
    if (!name) return []
    const kind = ['authority', 'professional', 'local', 'reading'].includes(String(item.kind))
      ? item.kind as Org['kind'] : 'reading'
    const url = clean(item.url)
    return [{
      id: `${documentId}-org-${index}`,
      keyPointId: keyPoints[0]?.id ?? `${documentId}-point-general`,
      documentId, name, kind, url: /^https?:\/\//i.test(url) ? url : undefined,
      why: clean(item.why), verified: item.verified === true,
    }]
  })
  const rawQuestions = Array.isArray(content.questions) ? content.questions.slice(0, 150) : []
  const questions: QuizQuestion[] = rawQuestions.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const stem = clean(item.stem)
    const options = Array.isArray(item.options)
      ? item.options.filter((option): option is string => typeof option === 'string' && Boolean(option.trim())).slice(0, 6)
      : []
    const answerIndex = Number(item.answerIndex)
    if (!stem || options.length < 2 || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) return []
    const page = Number.isInteger(item.page) && Number(item.page) > 0 ? Number(item.page) : undefined
    return [{
      id: `${documentId}-question-${index}`, deckId, documentId, stem,
      options, answerIndex, explanation: clean(item.explanation) || 'No explanation was supplied.',
      page, sourceType: 'original' as const, sourceNumber: index + 1,
    }]
  })
  const doc: DocumentRec = {
    id: documentId, title: material.title, fileName: 'Shared community study set',
    pageCount: Math.max(0, Number(material.page_count) || 0), pages: [],
    createdAt: nowIso(), status: 'ready', source: 'community',
    sizeBytes: 0, materialVisibility: 'private',
  }
  const deck: Deck | null = cards.length || questions.length
    ? { id: deckId, documentId, title: material.title, createdAt: nowIso() }
    : null

  await db.transaction('rw', [db.documents, db.notes, db.keyPoints, db.orgs, db.decks, db.cards, db.reviews, db.questions], async () => {
    await db.documents.put(doc)
    await db.notes.put(note)
    await db.keyPoints.where('documentId').equals(documentId).delete()
    if (keyPoints.length) await db.keyPoints.bulkPut(keyPoints)
    await db.orgs.where('documentId').equals(documentId).delete()
    if (orgs.length) await db.orgs.bulkPut(orgs)
    const oldCards = await db.cards.where('documentId').equals(documentId).toArray()
    const nextCardIds = new Set(cards.map((card) => card.id))
    const removedCardIds = oldCards.filter((card) => !nextCardIds.has(card.id)).map((card) => card.id)
    if (removedCardIds.length) await db.reviews.bulkDelete(removedCardIds)
    await db.cards.where('documentId').equals(documentId).delete()
    if (cards.length) await db.cards.bulkPut(cards)
    await db.questions.where('documentId').equals(documentId).delete()
    if (questions.length) await db.questions.bulkPut(questions)
    if (deck) await db.decks.put(deck)
    else await db.decks.where('documentId').equals(documentId).delete()
  })
  return documentId
}

export async function launchPublicMaterialRush(
  material: PublicStudyMaterial,
  navigate: NavigateFunction,
): Promise<void> {
  const cards = publicMaterialCards(material)
  if (cards.length < 4) throw new Error('This material needs at least four flashcards before it can be played in Rush.')
  await importPublicMaterial(material)
  const deckId = `community-deck-${material.id}`
  navigate(`/deck/${deckId}/rush`)
}


/** Returns a short-lived download URL only for a currently public contribution. */
export async function getPublicMaterialDownloadUrl(materialId: string): Promise<string> {
  if (!supabase) throw new Error('The community library is not connected.')
  const { data, error } = await supabase.functions.invoke('public-material-download', {
    body: { materialId },
  })
  if (error) throw new Error(error.message || 'The original PDF could not be prepared for download.')
  if (!data || typeof data.signedUrl !== 'string') {
    throw new Error('This contributor has not made the original PDF available.')
  }
  return data.signedUrl
}
