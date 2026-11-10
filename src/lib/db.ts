import Dexie, { type Table } from 'dexie'
import type {
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
  Profile,
  QuizAttempt,
  QuizQuestion,
  Settings,
} from './types'

export class StudyHubDb extends Dexie {
  courses!: Table<Course, string>
  documents!: Table<DocumentRec, string>
  notes!: Table<Note, string>
  keyPoints!: Table<KeyPoint, string>
  orgs!: Table<Org, string>
  decks!: Table<Deck, string>
  cards!: Table<Card, string>
  reviews!: Table<CardReview, string>
  questions!: Table<QuizQuestion, string>
  attempts!: Table<QuizAttempt, string>
  inquiries!: Table<Inquiry, string>
  gameRuns!: Table<GameRun, string>
  profile!: Table<Profile, string>
  learningProfile!: Table<LearningProfile, string>
  settings!: Table<Settings, string>

  constructor() {
    super('oou-study-hub')
    // v2 adds a place for the original PDF blob, so a citation can open the
    // real page. Stored locally only — the file is never uploaded.
    this.version(2).stores({
      pdfBlobs: 'id, savedAt',
    })
    this.version(1).stores({
      courses: 'id, code, createdAt',
      documents: 'id, courseId, createdAt, status',
      notes: 'id, documentId',
      keyPoints: 'id, documentId, position',
      orgs: 'id, documentId, keyPointId',
      decks: 'id, documentId',
      cards: 'id, deckId, documentId',
      reviews: 'cardId, dueAt',
      questions: 'id, deckId, documentId',
      attempts: 'id, deckId, createdAt',
      inquiries: 'id, createdAt, documentId, kind',
      gameRuns: 'id, deckId, createdAt',
      profile: 'id',
      learningProfile: 'id',
      settings: 'id',
    })
  }
}

export const db = new StudyHubDb()

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  model: 'claude-sonnet-5-5',
  persistKey: false,
  trailEnabled: true,
  dark: false,
  // A deployed build can pin the endpoint without anyone touching Settings.
  // Empty means the standard Anthropic API.
  baseUrl: import.meta.env.VITE_AI_BASE_URL || undefined,
  // When true, the site provides the model via the Supabase Edge Function
  // and students never need their own API key.
  useProxy: false,
}

export async function getSettings(): Promise<Settings> {
  const found = await db.settings.get('app')
  if (found) return { ...DEFAULT_SETTINGS, ...found }
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const next = { ...current, ...patch, id: 'app' as const }
  await db.settings.put(next)
  return next
}

export async function getProfile(): Promise<Profile> {
  const found = await db.profile.get('me')
  if (found) return found
  const fresh: Profile = { id: 'me', displayName: 'Student', xp: 0, streakDays: 0 }
  await db.profile.put(fresh)
  return fresh
}

/**
 * Deletes everything this app ever stored in the browser. The Settings page
 * offers this behind two taps, and it is the honest counterpart to the
 * learning trail.
 */
export async function wipeEverything(): Promise<void> {
  await db.delete()
  await db.open()
  clearCachedBlobs()
}

function clearCachedBlobs() {
  if (typeof caches === 'undefined') return
  void caches
    .keys()
    .then((names) =>
      Promise.all(names.filter((n) => n.startsWith('pdf-')).map((n) => caches.delete(n))),
    )
    .catch(() => undefined)
}
