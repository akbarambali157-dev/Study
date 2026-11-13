import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Flame, Play, RotateCcw, Trophy, Zap } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { CitationChip } from '@/components/ui/CitationChip'
import { Card, Chip, EmptyState, Progress, Skeleton } from '@/components/ui/misc'
import { useDeck } from '@/lib/hooks'
import { record } from '@/lib/inquiries'
import { saveGameRun, touchStreak } from '@/lib/store'
import type { Card as CardRec, GameRun } from '@/lib/types'
import { cn, shuffle, uid } from '@/lib/utils'

const RUN_MS = 60_000
const BONUS_MS = 1_500
const SKIP_COST_MS = 3_000

interface Round {
  card: CardRec
  options: string[]
  answerIndex: number
}

function makeRound(card: CardRec, pool: CardRec[]): Round {
  // Distractors are other cards' backs. A deck with fewer than four distinct
  // backs gets duplicated ones rather than fewer options — a three-button
  // question would telegraph the answer.
  const others = shuffle(pool.filter((c) => c.id !== card.id))
    .map((c) => c.back)
    .filter((back, index, all) => back !== card.back && all.indexOf(back) === index)

  while (others.length < 3) others.push(`— no other card in this deck —`)
  const options = shuffle([card.back, ...others.slice(0, 3)])
  return { card, options, answerIndex: options.indexOf(card.back) }
}

type Status = 'idle' | 'running' | 'over'

export function CardRushPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deck, cards, document } = useDeck(id)

  const [status, setStatus] = useState<Status>('idle')
  const [remaining, setRemaining] = useState(RUN_MS)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [asked, setAsked] = useState(0)
  const [round, setRound] = useState<Round | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [lastRun, setLastRun] = useState<GameRun | null>(null)

  const startedAt = useRef(0)
  const deadline = useRef(0)
  const locked = useRef(false)
  const timer = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }, [])

  const nextRound = useCallback(
    (pool: CardRec[]) => {
      if (pool.length === 0) return
      // Weight towards cards that have been getting away from the student.
      const pick = pool[Math.floor(Math.random() * pool.length)]
      setRound(makeRound(pick, pool))
      setChosen(null)
      setFeedback(null)
      locked.current = false
    },
    [],
  )

  const finish = useCallback(
    async (finalScore: number, finalBest: number, finalCorrect: number, finalAsked: number) => {
      stop()
      setStatus('over')
      const xp = Math.max(0, Math.round(finalScore / 10))
      const run: GameRun = {
        id: uid('run'),
        deckId: id ?? '',
        mode: 'rush',
        score: finalScore,
        bestCombo: finalBest,
        correct: finalCorrect,
        total: finalAsked,
        xp,
        createdAt: new Date().toISOString(),
      }
      setLastRun(run)
      await saveGameRun(run)
      await touchStreak()
      void record({
        kind: 'topic_open',
        documentId: document?.id,
        topic: deck?.title,
        payload: { mode: 'rush', score: finalScore },
      })
    },
    [deck?.title, document?.id, id, stop],
  )

  const start = useCallback(() => {
    if (cards.length === 0) return
    stop()
    setStatus('running')
    setScore(0)
    setCombo(0)
    setBestCombo(0)
    setCorrect(0)
    setAsked(0)
    setLastRun(null)
    setFeedback(null)
    setRemaining(RUN_MS)
    startedAt.current = Date.now()
    deadline.current = Date.now() + RUN_MS
    nextRound(cards)

    timer.current = window.setInterval(() => {
      const left = deadline.current - Date.now()
      setRemaining(left)
      if (left <= 0) {
        stop()
      }
    }, 100)
  }, [cards, nextRound, stop])

  // The interval only owns the clock; running out is handled here so the
  // final numbers are the ones on screen when time expired.
  useEffect(() => {
    if (status !== 'running' || remaining > 0) return
    void finish(score, bestCombo, correct, asked)
  }, [asked, bestCombo, correct, finish, remaining, score, status])

  useEffect(() => () => stop(), [stop])

  const answer = useCallback(
    (index: number) => {
      if (!round || locked.current || status !== 'running') return
      locked.current = true
      setChosen(index)
      setAsked((n) => n + 1)
      const right = index === round.answerIndex
      setFeedback(right ? 'correct' : 'wrong')

      if (right) {
        const nextCombo = combo + 1
        setCombo(nextCombo)
        setBestCombo((best) => Math.max(best, nextCombo))
        setScore((value) => value + 100 * nextCombo)
        deadline.current += BONUS_MS
        setRemaining((value) => value + BONUS_MS)
      } else {
        setCombo(0)
        void record({
          kind: 'quiz_miss',
          documentId: document?.id,
          keyPointId: round.card.keyPointId,
          cardId: round.card.id,
          topic: round.card.tags[0] ?? round.card.front.slice(0, 40),
        })
      }
      setCorrect((n) => n + (right ? 1 : 0))

      window.setTimeout(() => {
        nextRound(cards)
      }, right ? 420 : 1100)
    },
    [cards, combo, document?.id, nextRound, round, status],
  )

  const skip = useCallback(() => {
    if (status !== 'running' || locked.current) return
    locked.current = true
    setCombo(0)
    setAsked((n) => n + 1)
    deadline.current -= SKIP_COST_MS
    setRemaining((value) => value - SKIP_COST_MS)
    nextRound(cards)
  }, [cards, nextRound, status])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (status === 'running') void finish(score, bestCombo, correct, asked)
        return
      }
      if (status !== 'running') return
      if (event.key === ' ') {
        event.preventDefault()
        skip()
        return
      }
      const asIndex = Number(event.key) - 1
      if (asIndex >= 0 && asIndex <= 3) {
        event.preventDefault()
        answer(asIndex)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer, asked, bestCombo, correct, finish, score, skip, status])

  const xpPreview = useMemo(() => Math.max(0, Math.round(score / 10)), [score])

  if (!deck) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (cards.length < 4) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeading
          title="Card Rush"
          back={{ to: document ? `/doc/${document.id}` : '/library', label: 'Back' }}
        />
        <EmptyState
          icon={<Zap className="size-6" />}
          title="Not enough cards yet"
          body="Rush needs at least four cards so the answers can't be guessed by elimination."
          action={
            <Button onClick={() => navigate(document ? `/doc/${document.id}` : '/library')}>
              Back to notes
            </Button>
          }
        />
      </div>
    )
  }

  /* ── results ───────────────────────────────────────────────────────── */
  if (status === 'over' && lastRun) {
    const accuracy = lastRun.total ? Math.round((lastRun.correct / lastRun.total) * 100) : 0
    return (
      <div className="mx-auto max-w-xl">
        <PageHeading
          title="Time"
          subtitle="One minute, spent."
          back={{ to: document ? `/doc/${document.id}` : '/library', label: 'Back' }}
        />

        <Card className="mb-4 text-center">
          <Trophy className="mx-auto size-8 text-gold" />
          <div className="tnum mt-2 font-display text-5xl font-bold">{lastRun.score}</div>
          <div className="mt-1 text-sm text-muted">points</div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <div>
              <div className="tnum font-display text-xl font-semibold">{accuracy}%</div>
              <div className="text-[11px] text-muted">Accuracy</div>
            </div>
            <div>
              <div className="tnum font-display text-xl font-semibold text-gold">
                ×{lastRun.bestCombo}
              </div>
              <div className="text-[11px] text-muted">Best combo</div>
            </div>
            <div>
              <div className="tnum font-display text-xl font-semibold text-forest-400">
                +{lastRun.xp}
              </div>
              <div className="text-[11px] text-muted">XP</div>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={start} icon={<RotateCcw className="size-4" />}>
            Again
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(`/deck/${deck.id}/study`)}
          >
            Study these properly
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  /* ── ready ─────────────────────────────────────────────────────────── */
  if (status === 'idle') {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeading
          title="Card Rush"
          subtitle={deck.title}
          back={{ to: document ? `/doc/${document.id}` : '/library', label: 'Back' }}
        />
        <Card>
          <h2 className="font-display text-lg font-semibold">Sixty seconds. Four answers.</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            <li>· Right answer: points, and 1.5 seconds back on the clock.</li>
            <li>· Combos multiply — the fifth in a row is worth five times the first.</li>
            <li>· Wrong answer costs your combo, not your time.</li>
            <li>· Space skips, for three seconds.</li>
          </ul>
          <Button className="mt-5" onClick={start} icon={<Play className="size-4" />}>
            Start
          </Button>
        </Card>
      </div>
    )
  }

  /* ── running ───────────────────────────────────────────────────────── */
  const seconds = Math.max(0, remaining / 1000)
  const danger = seconds <= 10

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void finish(score, bestCombo, correct, asked)}
          className="text-[13px] text-muted hover:underline"
        >
          Quit
        </button>
        <div className="flex items-center gap-2">
          {combo >= 2 ? (
            <Chip tone="gold">
              <Flame className="size-3" />×{combo} combo
            </Chip>
          ) : null}
          <Chip tone={danger ? 'clay' : 'neutral'}>
            <span className={cn("tnum", danger ? "rush-timer-danger inline-block font-bold" : "")}>{seconds.toFixed(1)}s</span>
          </Chip>
        </div>
      </div>

      <Progress
        value={remaining}
        max={RUN_MS + BONUS_MS * 4}
        tone="gold"
        className="mb-4"
      />

      {/* Keyed on the round so each card animates in exactly once, rather than
          re-mounting on every clock tick. */}
      {round ? (
        <Card key={`${round.card.id}-${asked}`} className={cn("animate-card-enter transition-shadow duration-300", feedback === "correct" ? "rush-feedback-correct" : feedback === "wrong" ? "rush-feedback-wrong" : "")}>
          <div className="mb-1 flex items-center justify-between">
            <span className="tnum text-[11px] font-semibold uppercase tracking-wide text-muted">
              Score {score}
            </span>
            <CitationChip
              documentId={deck.documentId}
              page={round.card.page}
              snippet={round.card.front}
            />
          </div>

          <p className="mb-4 mt-2 text-[17px] font-medium leading-snug">{round.card.front}</p>

          <div className="grid gap-2">
            {round.options.map((option, index) => {
              const isAnswer = index === round.answerIndex
              const isChosen = chosen === index
              const revealed = chosen !== null
              return (
                <button
                  key={`${index}-${option.slice(0, 12)}`}
                  type="button"
                  onClick={() => answer(index)}
                  disabled={chosen !== null}
                  className={cn(
                    'flex min-h-12 items-start gap-2.5 rounded-xl border px-3 py-3 text-left text-[14px] leading-snug transition duration-200 active:scale-[.99]',
                    'disabled:cursor-default',
                    revealed && isAnswer
                      ? 'border-forest-400 bg-forest-400/10 font-semibold'
                      : revealed && isChosen
                        ? 'border-clay bg-clay-soft/60 dark:bg-clay/20'
                        : 'border-line bg-surface hover:border-forest-400/50',
                    revealed && !isAnswer && !isChosen ? 'opacity-50' : null,
                  )}
                >
                  <span className="tnum mt-0.5 shrink-0 text-[11px] font-semibold text-muted">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{option}</span>
                </button>
              )
            })}
          </div>

          {feedback ? (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'rush-feedback mt-4 flex items-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold',
                feedback === 'correct'
                  ? 'border border-forest-400/30 bg-forest-400/10 text-forest-400 dark:text-mint'
                  : 'border border-clay/30 bg-clay-soft/60 text-clay dark:bg-clay/15 dark:text-[#ffad98]',
              )}
            >
              <span className="text-base" aria-hidden="true">{feedback === 'correct' ? '✦' : '↻'}</span>
              <span>
                {feedback === 'correct'
                  ? `Correct! +${100 * combo} points${combo >= 2 ? ` · ${combo}× combo` : ''} · 1.5 seconds added`
                  : 'Not quite — the correct answer is highlighted. Keep going!'}
              </span>
            </div>
          ) : null}
        </Card>
      ) : (
        <Skeleton className="h-64 w-full" />
      )}

      <p className="mt-4 text-center text-[11px] text-muted">
        1–4 to answer · Space to skip · Esc to quit · {xpPreview} XP so far
      </p>
    </div>
  )
}
