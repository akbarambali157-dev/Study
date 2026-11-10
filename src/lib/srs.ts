import type { CardReview } from './types'

/**
 * Four grades, deliberately coarse. Anything finer makes the student think
 * about the schedule instead of the answer.
 */
export type Grade = 1 | 2 | 3 | 4

export const GRADES: {
  grade: Grade
  label: string
  hint: string
  quality: number
  tone: 'again' | 'hard' | 'good' | 'easy'
}[] = [
  { grade: 1, label: 'Again', hint: 'No idea', quality: 2, tone: 'again' },
  { grade: 2, label: 'Hard', hint: 'Slow recall', quality: 3, tone: 'hard' },
  { grade: 3, label: 'Good', hint: 'Got it', quality: 4, tone: 'good' },
  { grade: 4, label: 'Easy', hint: 'Instant', quality: 5, tone: 'easy' },
]

export function freshReview(cardId: string, userId = 'local'): CardReview {
  return {
    cardId,
    userId,
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueAt: new Date().toISOString(),
    lastGrade: 0,
  }
}

/**
 * SM-2, with the rough edges filed off:
 * - "Again" returns in ten minutes rather than tomorrow (you still study today).
 * - Hard keeps the interval from growing, Easy accelerates it.
 * - Ease never falls below 1.3, so a card you keep failing still comes back.
 */
export function schedule(
  review: CardReview | undefined,
  grade: Grade,
  now: Date = new Date(),
): CardReview {
  const current = review ?? freshReview('')
  const quality = GRADES.find((g) => g.grade === grade)!.quality

  let ease = current.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  ease = Math.max(1.3, Number(ease.toFixed(3)))

  let reps = current.reps
  let lapses = current.lapses
  let intervalDays = current.intervalDays

  if (grade === 1) {
    reps = 0
    lapses += 1
    intervalDays = 0
  } else if (grade === 2) {
    reps += 1
    intervalDays =
      current.intervalDays <= 0 ? 1 : Math.max(1, Math.round(current.intervalDays * 1.2))
  } else if (grade === 3) {
    reps += 1
    if (current.intervalDays <= 0) intervalDays = 1
    else if (current.reps <= 1) intervalDays = 3
    else intervalDays = Math.max(1, Math.round(current.intervalDays * ease))
  } else {
    reps += 1
    if (current.intervalDays <= 0) intervalDays = 2
    else intervalDays = Math.max(1, Math.round(current.intervalDays * ease * 1.3))
  }

  // A hard ceiling keeps intervals sane without a 90-year wait. (365 days)
  intervalDays = Math.min(intervalDays, 365)

  const dueAt =
    grade === 1
      ? new Date(now.getTime() + 10 * 60 * 1000).toISOString()
      : new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString()

  return {
    cardId: current.cardId,
    userId: current.userId,
    ease,
    intervalDays,
    reps,
    lapses,
    dueAt,
    lastGrade: grade,
  }
}

export function isDue(review: CardReview | undefined, now = new Date()): boolean {
  if (!review) return true
  return new Date(review.dueAt).getTime() <= now.getTime()
}

export function dueLabel(review: CardReview | undefined, now = new Date()): string {
  if (!review) return 'New'
  const ms = new Date(review.dueAt).getTime() - now.getTime()
  if (ms <= 0) return 'Due now'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `In ${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `In ${hours}h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Tomorrow' : `In ${days}d`
}

/** Orders a study session: due first, then unseen, then the rest. */
export function buildSession<T extends { id: string }>(
  cards: T[],
  reviews: Map<string, CardReview>,
  limit = 20,
  now = new Date(),
): T[] {
  const overdue = cards.filter((c) => reviews.get(c.id) && isDue(reviews.get(c.id), now))
  const unseen = cards.filter((c) => !reviews.get(c.id))
  const later = cards.filter((c) => reviews.get(c.id) && !isDue(reviews.get(c.id), now))

  // Among due cards, the ones you struggle with come first.
  overdue.sort((a, b) => {
    const ra = reviews.get(a.id)!
    const rb = reviews.get(b.id)!
    return rb.lapses - ra.lapses || new Date(ra.dueAt).getTime() - new Date(rb.dueAt).getTime()
  })

  return [...overdue, ...unseen, ...later].slice(0, limit)
}
