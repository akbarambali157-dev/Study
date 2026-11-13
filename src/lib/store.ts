import { db } from './db'
import { schedule, freshReview, type Grade } from './srs'
import type {
  AiModel,
  Card,
  CardReview,
  Course,
  Deck,
  DocumentRec,
  GameRun,
  Inquiry,
  KeyPoint,
  LearningProfile,
  Note,
  Org,
  QuizAttempt,
  QuizQuestion,
  Settings,
} from './types'
import { nowIso, uid } from './utils'

/* ── courses ─────────────────────────────────────────────────────────── */

export async function ensureCourse(code: string, title: string): Promise<Course> {
  const existing = await db.courses.where('code').equals(code).first()
  if (existing) return existing
  const course: Course = { id: uid('course'), code, title, createdAt: nowIso() }
  await db.courses.put(course)
  return course
}

export async function listCourses(): Promise<Course[]> {
  return db.courses.orderBy('code').toArray()
}

/* ── documents ───────────────────────────────────────────────────────── */

export async function saveDocument(doc: DocumentRec): Promise<void> {
  await db.documents.put(doc)
}

export async function getDocument(id: string): Promise<DocumentRec | undefined> {
  return db.documents.get(id)
}

export async function deleteDocument(id: string): Promise<void> {
  const decks = await db.decks.where('documentId').equals(id).toArray()
  const deckIds = decks.map((d) => d.id)
  await db.transaction(
    'rw',
    [
      db.documents,
      db.notes,
      db.keyPoints,
      db.orgs,
      db.decks,
      db.cards,
      db.reviews,
      db.questions,
      db.attempts,
    ],
    async () => {
      await db.documents.delete(id)
      await db.notes.where('documentId').equals(id).delete()
      await db.keyPoints.where('documentId').equals(id).delete()
      await db.orgs.where('documentId').equals(id).delete()
      await db.questions.where('documentId').equals(id).delete()
      const cards = await db.cards.where('documentId').equals(id).toArray()
      await db.reviews.bulkDelete(cards.map((c) => c.id))
      await db.cards.where('documentId').equals(id).delete()
      await db.decks.where('documentId').equals(id).delete()
      for (const deckId of deckIds) {
        await db.attempts.where('deckId').equals(deckId).delete()
      }
    },
  )
}

/** Remove partial output before retrying generation for the same document. */
export async function clearGeneratedContent(documentId: string): Promise<void> {
  const decks = await db.decks.where('documentId').equals(documentId).toArray()
  await db.transaction(
    'rw',
    [db.notes, db.keyPoints, db.orgs, db.decks, db.cards, db.reviews, db.questions, db.attempts],
    async () => {
      const cards = await db.cards.where('documentId').equals(documentId).toArray()
      await db.reviews.bulkDelete(cards.map((card) => card.id))
      await db.notes.where('documentId').equals(documentId).delete()
      await db.keyPoints.where('documentId').equals(documentId).delete()
      await db.orgs.where('documentId').equals(documentId).delete()
      await db.questions.where('documentId').equals(documentId).delete()
      await db.cards.where('documentId').equals(documentId).delete()
      await db.decks.where('documentId').equals(documentId).delete()
      for (const deck of decks) {
        await db.attempts.where('deckId').equals(deck.id).delete()
      }
    },
  )
}

/* ── generated content ───────────────────────────────────────────────── */

export async function saveNote(note: Note): Promise<void> {
  await db.notes.put(note)
}

export async function saveKeyPoints(points: KeyPoint[]): Promise<void> {
  await db.keyPoints.bulkPut(points)
}

export async function saveOrgs(orgs: Org[]): Promise<void> {
  await db.orgs.bulkPut(orgs)
}

export async function saveDeck(deck: Deck): Promise<void> {
  await db.decks.put(deck)
}

export async function saveCards(cards: Card[]): Promise<void> {
  await db.cards.bulkPut(cards)
}

export async function saveQuestions(questions: QuizQuestion[]): Promise<void> {
  await db.questions.bulkPut(questions)
}

export async function getNoteForDocument(documentId: string): Promise<Note | undefined> {
  return db.notes.where('documentId').equals(documentId).first()
}

export async function getKeyPoints(documentId: string): Promise<KeyPoint[]> {
  const points = await db.keyPoints.where('documentId').equals(documentId).toArray()
  return points.sort((a, b) => a.position - b.position)
}

export async function getOrgs(documentId: string): Promise<Org[]> {
  return db.orgs.where('documentId').equals(documentId).toArray()
}

export async function getDeckForDocument(documentId: string): Promise<Deck | undefined> {
  return db.decks.where('documentId').equals(documentId).first()
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  return db.decks.get(id)
}

export async function getCards(deckId: string): Promise<Card[]> {
  return db.cards.where('deckId').equals(deckId).toArray()
}

export async function getQuestions(deckId: string): Promise<QuizQuestion[]> {
  return db.questions.where('deckId').equals(deckId).toArray()
}

/** A document counts as "ready" once its deck has at least one card. */
export async function libraryOverview() {
  const [documents, decks, cards, reviews, attempts] = await Promise.all([
    db.documents.orderBy('createdAt').reverse().toArray(),
    db.decks.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.attempts.toArray(),
  ])

  const reviewByCard = new Map(reviews.map((r) => [r.cardId, r]))
  const now = Date.now()
  const deckByDoc = new Map(decks.map((d) => [d.documentId, d]))
  const cardsByDeck = new Map<string, Card[]>()
  for (const card of cards) {
    const list = cardsByDeck.get(card.deckId) ?? []
    list.push(card)
    cardsByDeck.set(card.deckId, list)
  }

  return documents.map((doc) => {
    const deck = deckByDoc.get(doc.id)
    const deckCards = deck ? (cardsByDeck.get(deck.id) ?? []) : []
    const due = deckCards.filter((c) => {
      const r = reviewByCard.get(c.id)
      return !r || new Date(r.dueAt).getTime() <= now
    }).length
    const bestAttempt = deck
      ? attempts
          .filter((a) => a.deckId === deck.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined
    return { doc, deck, cardCount: deckCards.length, dueCount: due, lastAttempt: bestAttempt }
  })
}

/* ── reviews ─────────────────────────────────────────────────────────── */

export async function getReviews(): Promise<Map<string, CardReview>> {
  const all = await db.reviews.toArray()
  return new Map(all.map((r) => [r.cardId, r]))
}

export async function gradeCard(cardId: string, grade: Grade): Promise<CardReview> {
  const existing = await db.reviews.get(cardId)
  const base = existing ?? freshReview(cardId)
  const next = schedule({ ...base, cardId }, grade)
  await db.reviews.put(next)
  return next
}

/* ── attempts and games ──────────────────────────────────────────────── */

export async function saveAttempt(attempt: QuizAttempt): Promise<void> {
  await db.attempts.put(attempt)
}

export async function listAttempts(deckId?: string): Promise<QuizAttempt[]> {
  const rows = deckId
    ? await db.attempts.where('deckId').equals(deckId).toArray()
    : await db.attempts.toArray()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function saveGameRun(run: GameRun): Promise<void> {
  await db.gameRuns.put(run)
  await addXp(run.xp)
}

export async function listGameRuns(limit = 20): Promise<GameRun[]> {
  const rows = await db.gameRuns.toArray()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}

/* ── xp and streak ───────────────────────────────────────────────────── */

export async function addXp(amount: number): Promise<void> {
  const profile = (await db.profile.get('me')) ?? {
    id: 'me',
    displayName: 'Student',
    xp: 0,
    streakDays: 0,
  }
  await db.profile.put({ ...profile, xp: Math.max(0, profile.xp + amount) })
}

export async function touchStreak(): Promise<number> {
  const profile = (await db.profile.get('me')) ?? {
    id: 'me',
    displayName: 'Student',
    xp: 0,
    streakDays: 0,
  }
  const today = new Date().toISOString().slice(0, 10)
  if (profile.lastActive === today) return profile.streakDays

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const streakDays = profile.lastActive === yesterday ? profile.streakDays + 1 : 1
  await db.profile.put({ ...profile, streakDays, lastActive: today })
  return streakDays
}

/* ── inquiries (the learning trail) ──────────────────────────────────── */

export async function logInquiry(
  inquiry: Omit<Inquiry, 'id' | 'createdAt'>,
  enabled: boolean,
): Promise<void> {
  if (!enabled) return
  const record: Inquiry = { ...inquiry, id: uid('inq'), createdAt: nowIso() }
  await db.inquiries.put(record)

  // Keep the local trail bounded without ever deleting something a profile
  // was built from.
  const count = await db.inquiries.count()
  if (count > 5000) {
    const oldest = await db.inquiries.orderBy('createdAt').limit(count - 5000).toArray()
    await db.inquiries.bulkDelete(oldest.map((r) => r.id))
  }
}

export async function listInquiries(limit = 500): Promise<Inquiry[]> {
  const rows = await db.inquiries.orderBy('createdAt').reverse().limit(limit).toArray()
  return rows
}

export async function saveLearningProfile(profile: LearningProfile): Promise<void> {
  await db.learningProfile.put(profile)
}

export async function getLearningProfile(): Promise<LearningProfile | undefined> {
  return db.learningProfile.get('me')
}

/* ── settings mirror ─────────────────────────────────────────────────── */

export async function currentModel(): Promise<AiModel> {
  const settings = (await db.settings.get('app')) as Settings | undefined
  return settings?.model ?? 'claude-sonnet-5-5'
}

export async function trailEnabled(): Promise<boolean> {
  const settings = (await db.settings.get('app')) as Settings | undefined
  return settings?.trailEnabled ?? true
}
