import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Layers, RotateCcw, Zap } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/Button'
import { CitationChip } from '@/components/ui/CitationChip'
import { Card, Chip, EmptyState, Progress, Skeleton } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { useDeck } from '@/lib/hooks'
import { record } from '@/lib/inquiries'
import { gradeCard } from '@/lib/store'
import { buildSession, dueLabel, GRADES, type Grade } from '@/lib/srs'
import type { Card as CardRec } from '@/lib/types'
import { cn, plural } from '@/lib/utils'

interface Graded {
  cardId: string
  grade: Grade
}

const GRADE_STYLE: Record<Grade, string> = {
  1: 'border-clay/40 bg-clay-soft/60 text-clay hover:bg-clay-soft dark:bg-clay/20',
  2: 'border-gold/40 bg-gold/10 text-[#8a5a00] hover:bg-gold/20 dark:text-gold',
  3: 'border-forest-400/40 bg-forest-400/10 text-forest dark:text-mint hover:bg-forest-400/20',
  4: 'border-forest-400/50 bg-forest text-white hover:brightness-110',
}

export function DeckStudyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deck, cards, reviews, document } = useDeck(id)

  const [session, setSession] = useState<CardRec[] | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [graded, setGraded] = useState<Graded[]>([])
  const [finished, setFinished] = useState(false)

  // Build the queue once per deck load, never on every review write.
  useEffect(() => {
    if (session !== null || cards.length === 0) return
    setSession(buildSession(cards, reviews, 20))
  }, [cards, reviews, session])

  const current = session?.[index]
  const total = session?.length ?? 0

  const flip = useCallback(() => setFlipped((value) => !value), [])

  const grade = useCallback(
    async (value: Grade) => {
      if (!current) return
      await gradeCard(current.id, value)
      setGraded((list) => [...list, { cardId: current.id, grade: value }])
      void record({
        kind: value === 1 ? 'card_lapse' : 'card_flip',
        documentId: document?.id,
        keyPointId: current.keyPointId,
        cardId: current.id,
        topic: current.tags[0] ?? current.front.slice(0, 40),
      })
      setFlipped(false)

      if (index + 1 >= total) {
        setFinished(true)
      } else {
        // Advance after the flip-back paints, so the next front does not
        // appear already rotating.
        setIndex((i) => i + 1)
      }
    },
    [current, document?.id, index, total],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (finished) return
        if (!flipped) flip()
        return
      }
      if (event.key === 'ArrowRight' && index + 1 < total && !finished) {
        event.preventDefault()
        setFlipped(false)
        setIndex((i) => i + 1)
      }
      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault()
        setFlipped(false)
        setIndex((i) => i - 1)
      }
      if (!flipped || finished) return
      const asGrade = Number(event.key)
      if (asGrade >= 1 && asGrade <= 4) {
        event.preventDefault()
        void grade(asGrade as Grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finished, flip, flipped, grade, index, total])

  const again = useMemo(() => graded.filter((g) => g.grade === 1), [graded])
  const gotIt = useMemo(
    () => graded.filter((g) => g.grade === 3 || g.grade === 4).length,
    [graded],
  )

  const restart = (onlyAgain: boolean) => {
    if (!session) return
    const next = onlyAgain
      ? session.filter((card) => again.some((g) => g.cardId === card.id))
      : session
    setSession(next)
    setIndex(0)
    setGraded([])
    setFlipped(false)
    setFinished(false)
  }

  if (!deck) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeading
          title={deck.title}
          back={{ to: document ? `/doc/${document.id}` : '/library', label: 'Back' }}
        />
        <EmptyState
          icon={<Layers className="size-6" />}
          title="This deck has no cards"
          body="Cards are generated from the key points. Run generation again to fill it."
          action={<Button onClick={() => navigate('/upload')}>Run generation</Button>}
        />
      </div>
    )
  }

  /* ── session summary ───────────────────────────────────────────────── */
  if (finished) {
    const accuracy = graded.length ? Math.round((gotIt / graded.length) * 100) : 0
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeading
          title="Session done"
          subtitle={`${graded.length} ${plural(graded.length, 'card')} graded`}
          back={{ to: document ? `/doc/${document.id}` : '/library', label: 'Back' }}
        />

        <Card className="mb-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="tnum font-display text-3xl font-semibold">{graded.length}</div>
              <div className="mt-0.5 text-xs text-muted">Reviewed</div>
            </div>
            <div>
              <div className="tnum font-display text-3xl font-semibold text-forest-400">
                {accuracy}%
              </div>
              <div className="mt-0.5 text-xs text-muted">Recalled</div>
            </div>
            <div>
              <div className="tnum font-display text-3xl font-semibold text-clay">
                {again.length}
              </div>
              <div className="mt-0.5 text-xs text-muted">To redo</div>
            </div>
          </div>
        </Card>

        {again.length > 0 ? (
          <Card className="mb-4">
            <h2 className="mb-2 text-sm font-semibold">These will come back sooner</h2>
            <ul className="space-y-1.5 text-[13px] text-muted">
              {again.map(({ cardId }) => {
                const card = cards.find((c) => c.id === cardId)
                if (!card) return null
                return (
                  <li key={cardId} className="truncate">
                    · {card.front}
                  </li>
                )
              })}
            </ul>
          </Card>
        ) : (
          <p className="mb-4 rounded-xl border border-forest-400/30 bg-forest-400/5 px-4 py-3 text-sm">
            <Check className="mr-1.5 inline size-4 text-forest-400" />
            Every card graded well. The next session moves them further out in the schedule.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {again.length > 0 ? (
            <Button onClick={() => restart(true)} icon={<RotateCcw className="size-4" />}>
              Redo the {again.length} you missed
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => restart(false)}>
            Study all again
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(`/deck/${deck.id}/rush`)}
            icon={<Zap className="size-4" />}
          >
            Card Rush
          </Button>
          <Button variant="ghost" onClick={() => navigate(document ? `/doc/${document.id}` : '/library')}>
            Back to notes
          </Button>
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  /* ── the card ──────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading
        title={deck.title}
        subtitle={`Card ${index + 1} of ${total}`}
        back={{ to: document ? `/doc/${document.id}` : '/library', label: 'Back' }}
        actions={
          <Chip tone={reviews.get(current.id) ? 'neutral' : 'green'}>
            {dueLabel(reviews.get(current.id))}
          </Chip>
        }
      />

      <Progress value={index} max={total} className="mb-4" />

      <div
        className="flip-scene h-[360px] cursor-pointer select-none sm:h-[400px]"
        onClick={flip}
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Show the question' : 'Reveal the answer'}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault()
            flip()
          }
        }}
      >
        <div className={cn('flip-card h-full', flipped && 'is-flipped')}>
          {/* front */}
          <div className="flip-face card-surface items-center justify-center p-7 text-center">
            <span className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Question
            </span>
            <div className="prose-note overflow-y-auto text-[19px] font-medium leading-snug">
              <Markdown text={current.front} />
            </div>
            <span className="mt-4 text-[11px] text-muted">Tap or press Space to flip</span>
          </div>

          {/* back */}
          <div className="flip-face flip-face--back card-surface p-7">
            <span className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Answer
            </span>
            <div className="flex-1 overflow-y-auto">
              <div className="prose-note text-[17px] leading-relaxed">
                <Markdown text={current.back} />
              </div>
              {current.example ? (
                <div className="mt-3 rounded-xl bg-gold-soft/50 px-3.5 py-2.5 text-[14px] dark:bg-gold/10">
                  <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8a5a00] dark:text-gold">
                    Example
                  </span>
                  <Markdown text={current.example} className="inline" />
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <CitationChip
                documentId={deck.documentId}
                page={current.page}
                snippet={current.front}
              />
            </div>
          </div>
        </div>
      </div>

      {/* grade bar */}
      <div className="mt-4">
        {flipped ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map((option) => (
              <button
                key={option.grade}
                type="button"
                onClick={() => void grade(option.grade)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                  GRADE_STYLE[option.grade],
                )}
              >
                <span className="flex w-full items-center justify-between text-sm font-semibold">
                  {option.label}
                  <kbd className="rounded bg-black/10 px-1 text-[10px] font-normal">
                    {option.grade}
                  </kbd>
                </span>
                <span className="text-[11px] opacity-80">{option.hint}</span>
              </button>
            ))}
          </div>
        ) : (
          <Button block size="lg" onClick={flip}>
            Show answer
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          disabled={index === 0}
          onClick={() => {
            setFlipped(false)
            setIndex((i) => Math.max(0, i - 1))
          }}
          icon={<ArrowLeft className="size-3.5" />}
        >
          Previous
        </Button>
        <button
          type="button"
          className="text-[12px] text-muted hover:underline"
          onClick={() => {
            if (graded.length === 0) {
              toast('Grade at least one card to finish the session.')
              return
            }
            setFinished(true)
          }}
        >
          Finish session
        </button>
        <Button
          size="sm"
          variant="ghost"
          disabled={index + 1 >= total}
          onClick={() => {
            setFlipped(false)
            setIndex((i) => Math.min(total - 1, i + 1))
          }}
        >
          Next
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
