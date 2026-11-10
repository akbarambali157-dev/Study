import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Share2, Upload } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/Button'
import { Chip, EmptyState, Progress } from '@/components/ui/misc'
import { decodeShare } from '@/lib/export'
import { cn } from '@/lib/utils'

/**
 * A deck carried entirely in the URL. There is no server to look it up in,
 * which is the point: a share link works offline and expires nowhere, and
 * whoever opens it sees cards but never the student, the document or the key.
 */
export function SharedPage() {
  const { encoded } = useParams<{ encoded: string }>()
  const navigate = useNavigate()

  const deck = useMemo(() => (encoded ? decodeShare(encoded) : null), [encoded])

  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [browsing, setBrowsing] = useState(false)

  const cards = deck?.cards ?? []
  const current = cards[index]
  const total = cards.length

  const flip = useCallback(() => setFlipped((value) => !value), [])

  const move = useCallback(
    (delta: number) => {
      setFlipped(false)
      setIndex((value) => Math.min(total - 1, Math.max(0, value + delta)))
    },
    [total],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        flip()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flip, move])

  if (!deck) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeading title="Shared deck" />
        <EmptyState
          icon={<Share2 className="size-6" />}
          title="This link is not a deck"
          body="The link may have been cut short when it was copied. Whole links are long because the cards themselves travel inside them."
          action={<Button onClick={() => navigate('/')}>Go to the app</Button>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading
        title={deck.deck.title}
        subtitle={`${total} cards · shared read-only`}
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate('/upload')}
            icon={<Upload className="size-3.5" />}
          >
            Make your own
          </Button>
        }
      />

      <Progress value={index} max={total} className="mb-4" />

      {current ? (
        <>
          <div
            className="flip-scene h-[340px] cursor-pointer select-none sm:h-[380px]"
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
              <div className="flip-face card-surface items-center justify-center p-7 text-center">
                <span className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Question
                </span>
                <div className="prose-note overflow-y-auto text-[19px] font-medium leading-snug">
                  <Markdown text={current.front} />
                </div>
                <span className="mt-4 text-[11px] text-muted">Tap or press Space to flip</span>
              </div>

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
                {current.page ? (
                  <Chip className="mt-3 w-fit">from the original handout, p. {current.page}</Chip>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              disabled={index === 0}
              onClick={() => move(-1)}
              icon={<ArrowLeft className="size-3.5" />}
            >
              Previous
            </Button>
            <span className="tnum text-[12px] text-muted">
              {index + 1} / {total}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={index + 1 >= total}
              onClick={() => move(1)}
            >
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          </div>

          <div className="mt-6">
            <Button variant="ghost" size="sm" onClick={() => setBrowsing((value) => !value)}>
              {browsing ? 'Hide all cards' : 'See all cards at once'}
            </Button>
          </div>

          {browsing ? (
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {cards.map((card, cardIndex) => (
                <li key={cardIndex} className="px-4 py-3">
                  <p className="text-[14px] font-medium">{card.front}</p>
                  <p className="mt-1 text-[13px] text-muted">{card.back}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      <p className="mt-8 text-[12px] leading-relaxed text-muted">
        Read-only: nothing is graded or saved here. The cards travelled inside the link —
        this page made no request to any server.
      </p>
    </div>
  )
}
