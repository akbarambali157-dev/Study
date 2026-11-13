import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS, ensureProfile, getProfile, getSettings } from './db'
import { getReviews, libraryOverview } from './store'
import type {
  Card,
  CardReview,
  Deck,
  DocumentRec,
  KeyPoint,
  Note,
  OrgKind,
  Profile,
  QuizQuestion,
} from './types'

/**
 * The shapes these hooks return are spelled out rather than inferred. Passing
 * an empty default straight to `useLiveQuery` widens the result to a union of
 * the real value and the default, which then loses every optional field —
 * `deck`, `document` and `note` all vanish from the type at the call site.
 */
export interface OrgLite {
  name: string
  kind: OrgKind
  url?: string
  why: string
  verified: boolean
}

export interface DocumentContent {
  note?: Note
  keyPoints: KeyPoint[]
  orgsByKeyPoint: Map<string, OrgLite[]>
}

export interface DeckBundle {
  deck?: Deck
  cards: Card[]
  reviews: Map<string, CardReview>
  document?: DocumentRec
}

const EMPTY_DOCUMENT_CONTENT: DocumentContent = {
  keyPoints: [],
  orgsByKeyPoint: new Map(),
}

const EMPTY_DECK: DeckBundle = { cards: [], reviews: new Map() }

export function useSettings() {
  // Run the one-time migration outside Dexie's read-only liveQuery context.
  useEffect(() => {
    void getSettings()
  }, [])
  return useLiveQuery(() => db.settings.get('app'), [], DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)

  // Read-only liveQuery: no writes inside the querier, so Dexie won't throw
  // "Readwrite transaction in liveQuery context".
  const live = useLiveQuery(() => getProfile(), [], null)

  // Ensure a profile exists outside the liveQuery context (this writes to the DB).
  useEffect(() => {
    let mounted = true
    ensureProfile().then((p) => {
      if (mounted) setProfile(p)
    })
    return () => {
      mounted = false
    }
  }, [])

  return live ?? profile ?? null
}

export function useLibrary() {
  return useLiveQuery(() => libraryOverview(), [], [])
}

export function useDocument(id: string | undefined) {
  return useLiveQuery(
    async () => (id ? await db.documents.get(id) : undefined),
    [id],
    undefined,
  )
}

export function useDocumentContent(id: string | undefined): DocumentContent {
  return useLiveQuery<DocumentContent, DocumentContent>(
    async (): Promise<DocumentContent> => {
      if (!id) return EMPTY_DOCUMENT_CONTENT
      const note = await db.notes.where('documentId').equals(id).first()
      const points = await db.keyPoints.where('documentId').equals(id).toArray()
      points.sort((a, b) => a.position - b.position)
      const orgs = await db.orgs.where('documentId').equals(id).toArray()

      const byKeyPoint = new Map<string, typeof orgs>()
      for (const org of orgs) {
        const list = byKeyPoint.get(org.keyPointId) ?? []
        list.push(org)
        byKeyPoint.set(org.keyPointId, list)
      }
      return { note, keyPoints: points, orgsByKeyPoint: byKeyPoint }
    },
    [id],
    EMPTY_DOCUMENT_CONTENT,
  )
}

export function useDeck(deckId: string | undefined): DeckBundle {
  return useLiveQuery<DeckBundle, DeckBundle>(
    async (): Promise<DeckBundle> => {
      if (!deckId) return EMPTY_DECK
      const deck = await db.decks.get(deckId)
      const cards = await db.cards.where('deckId').equals(deckId).toArray()
      const reviews = await getReviews()
      const document = deck ? await db.documents.get(deck.documentId) : undefined
      return { deck, cards, reviews, document }
    },
    [deckId],
    { cards: [], reviews: new Map() },
  )
}

export function useQuestions(deckId: string | undefined) {
  return useLiveQuery(
    async (): Promise<QuizQuestion[]> => {
      if (!deckId) return []
      return db.questions.where('deckId').equals(deckId).toArray()
    },
    [deckId],
    [],
  )
}

export function useAttempts(deckId?: string) {
  return useLiveQuery(
    async () => {
      const rows = deckId
        ? await db.attempts.where('deckId').equals(deckId).toArray()
        : await db.attempts.toArray()
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    [deckId],
    [],
  )
}

export function useGameRuns(limit = 10) {
  return useLiveQuery(
    async () => {
      const rows = await db.gameRuns.toArray()
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
    },
    [limit],
    [],
  )
}

export function useInquiries(limit = 300) {
  return useLiveQuery(
    async () => db.inquiries.orderBy('createdAt').reverse().limit(limit).toArray(),
    [limit],
    [],
  )
}

export function useLearningProfile() {
  return useLiveQuery(() => db.learningProfile.get('me'), [], undefined)
}

export function useCourses() {
  return useLiveQuery(() => db.courses.orderBy('code').toArray(), [], [])
}
