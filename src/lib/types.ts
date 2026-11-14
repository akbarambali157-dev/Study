export type OrgKind = 'authority' | 'professional' | 'local' | 'reading'

export const ORG_KIND_LABEL: Record<OrgKind, string> = {
  authority: 'Authoritative agency',
  professional: 'Professional body & career',
  local: 'Nigerian / local context',
  reading: 'Further reading',
}

export type DocumentStatus = 'extracting' | 'ready' | 'failed'

export interface Course {
  id: string
  code: string
  title: string
  createdAt: string
  /** Local-only rows have no remote twin yet. */
  dirty?: boolean
}

export interface DocumentRec {
  id: string
  title: string
  fileName: string
  pageCount: number
  /** One entry per page, index 0 = page 1. Kept for offline citations. */
  pages: string[]
  courseId?: string
  createdAt: string
  status: DocumentStatus
  source: 'upload' | 'demo'
  sizeBytes?: number
  remoteId?: string
  storagePath?: string
  syncStatus?: 'local' | 'indexed' | 'failed'
  dirty?: boolean
}

export interface Note {
  id: string
  documentId: string
  title: string
  summary: string
  takeaways: string[]
  model: string
  createdAt: string
  dirty?: boolean
}

export interface KeyPoint {
  id: string
  documentId: string
  noteId: string
  position: number
  heading: string
  body: string
  example?: string
  page?: number
  confidence: number
  /** Opening words of the cited passage, so a citation can be checked at a glance. */
  snippet?: string
  tags: string[]
  dirty?: boolean
}

export interface Org {
  id: string
  keyPointId: string
  documentId: string
  name: string
  kind: OrgKind
  url?: string
  why: string
  verified: boolean
  dirty?: boolean
}

export interface Deck {
  id: string
  documentId: string
  title: string
  createdAt: string
  dirty?: boolean
}

export interface Card {
  id: string
  deckId: string
  documentId: string
  keyPointId?: string
  front: string
  back: string
  example?: string
  page?: number
  tags: string[]
  dirty?: boolean
}

export interface CardReview {
  cardId: string
  userId: string
  ease: number
  intervalDays: number
  reps: number
  lapses: number
  dueAt: string
  lastGrade: number
}

export interface QuizQuestion {
  id: string
  deckId: string
  documentId: string
  keyPointId?: string
  stem: string
  options: string[]
  answerIndex: number
  explanation: string
  page?: number
  dirty?: boolean
}

export type QuizMode = 'guided' | 'exam'

export interface QuizAnswer {
  questionId: string
  chosen: number
  correct: boolean
  ms: number
}

export interface QuizAttempt {
  id: string
  deckId: string
  documentId: string
  mode: QuizMode
  score: number
  total: number
  durationMs: number
  answers: QuizAnswer[]
  createdAt: string
}

export type InquiryKind =
  | 'ask'
  | 'search'
  | 'org_click'
  | 'card_flip'
  | 'card_lapse'
  | 'quiz_miss'
  | 'explain_open'
  | 'note_revisit'
  | 'doc_reopen'
  | 'topic_open'

export const INQUIRY_LABEL: Record<InquiryKind, string> = {
  ask: 'Asked about',
  search: 'Searched for',
  org_click: 'Explored',
  card_flip: 'Reviewed',
  card_lapse: 'Struggled with',
  quiz_miss: 'Missed a question on',
  explain_open: 'Went deeper on',
  note_revisit: 'Revisited',
  doc_reopen: 'Reopened',
  topic_open: 'Opened',
}

export interface Inquiry {
  id: string
  kind: InquiryKind
  documentId?: string
  keyPointId?: string
  cardId?: string
  /** Free text the student typed, when there was any. */
  query?: string
  /** Snapshot of the topic label so the trail survives a document deletion. */
  topic?: string
  payload?: Record<string, unknown>
  createdAt: string
}

export interface Interest {
  topic: string
  weight: number
  evidence: string[]
}

export interface Suggestion {
  title: string
  reason: string
  documentId?: string
  deckId?: string
}

export interface LearningProfile {
  id: 'me'
  interests: Interest[]
  gaps: string[]
  suggestedNext: Suggestion[]
  narrative: string
  eventCount: number
  computedAt: string
  /** Event count when this was computed, so we know when it is stale. */
  sourceEventCount: number
}

export interface Profile {
  id: string
  displayName: string
  faculty?: string
  department?: string
  level?: string
  programme?: string
  matricNo?: string
  xp: number
  streakDays: number
  lastActive?: string
}

export interface GameRun {
  id: string
  deckId: string
  mode: 'rush' | 'match'
  score: number
  bestCombo: number
  correct: number
  total: number
  xp: number
  createdAt: string
}

export type AiModel =
  | 'claude-opus-5-5'
  | 'claude-sonnet-5-5'
  | 'claude-haiku-4-5'

export interface Settings {
  id: 'app'
  model: AiModel
  persistKey: boolean
  trailEnabled: boolean
  dark: boolean
  /**
   * Optional base URL for an Anthropic-compatible endpoint. Empty means
   * api.anthropic.com. Lets a student point at a gateway they already pay for
   * — the key still never leaves their browser.
   */
  baseUrl?: string
  /**
   * When true, the site provides the model via the Supabase Edge Function.
   * The browser never touches the API key; students don't bring their own.
   */
  useProxy?: boolean
  /** One-time migration marker for the shared-provider default. */
  providerModeVersion?: number
}
