import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Check, Loader2, RotateCcw, Target, X } from 'lucide-react'
import { PageHeading } from '@/components/PageShell'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/Button'
import { CitationChip } from '@/components/ui/CitationChip'
import { Card, Chip, Progress, Skeleton } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { hasAiAccess } from '@/lib/apiKey'
import { formatUsd } from '@/lib/cost'
import { useDeck, useSettings } from '@/lib/hooks'
import { record } from '@/lib/inquiries'
import { AiError, redactSecrets } from '@/lib/llm/ai'
import { generateTestForDeck } from '@/lib/llm/pipeline'
import { saveAttempt } from '@/lib/store'
import type { QuizAnswer, QuizMode, QuizQuestion } from '@/lib/types'
import { cn, formatDuration, uid } from '@/lib/utils'

type Phase = 'setup' | 'generating' | 'running' | 'results'

export function TestPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const settings = useSettings()
  const { deck, document } = useDeck(id)

  const keyPoints = useLiveQuery(
    async () =>
      document ? db.keyPoints.where('documentId').equals(document.id).toArray() : [],
    [document?.id],
    [],
  )

  const [phase, setPhase] = useState<Phase>('setup')
  const [mode, setMode] = useState<QuizMode>('guided')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [startedAt, setStartedAt] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const current = questions[index]

  const start = useCallback(async () => {
    if (!deck || !document) return
    setError(null)
    setPhase('generating')
    try {
      const savedQuestions = await db.questions.where('deckId').equals(deck.id).toArray()
      let questionsToUse = savedQuestions
      let generatedCost = 0

      if (questionsToUse.length < 4) {
        if (!hasAiAccess(settings.useProxy ?? false)) {
          toast(settings.useProxy ? 'Configure Supabase in the deployment settings first.' : 'Add your API key in Settings first.', 'error')
          setPhase('setup')
          return
        }
        if (keyPoints.length === 0) {
          toast('This document has no key points to test on.', 'error')
          setPhase('setup')
          return
        }
        const result = await generateTestForDeck({
          deck,
          documentId: document.id,
          keyPoints,
          pageCount: document.pageCount,
          model: settings.model,
          baseUrl: settings.baseUrl || undefined,
          useProxy: settings.useProxy,
        })
        questionsToUse = result.questions
        generatedCost = result.costUsd
      }

      setQuestions(questionsToUse)
      setIndex(0)
      setChosen(null)
      setAnswers([])
      setDurationMs(0)
      setReviewing(false)
      setStartedAt(Date.now())
      setPhase('running')
      toast(generatedCost > 0
        ? `${questionsToUse.length} questions generated — ${formatUsd(generatedCost)}.`
        : `${questionsToUse.length} saved questions ready.`, 'success')
    } catch (err) {
      setError(
        redactSecrets(
          err instanceof AiError || err instanceof Error
            ? err.message
            : 'The test could not be generated.',
        ),
      )
      setPhase('setup')
    }
  }, [deck, document, keyPoints, settings.baseUrl, settings.model, settings.useProxy])

  const finish = useCallback(
    async (finalAnswers: QuizAnswer[]) => {
      if (!deck || !document) return
      const elapsed = Date.now() - startedAt
      setDurationMs(elapsed)
      setPhase('results')
      await saveAttempt({
        id: uid('attempt'),
        deckId: deck.id,
        documentId: document.id,
        mode,
        score: finalAnswers.filter((a) => a.correct).length,
        total: questions.length,
        durationMs: elapsed,
        answers: finalAnswers,
        createdAt: new Date().toISOString(),
      })
    },
    [deck, document, mode, questions.length, startedAt],
  )

  const choose = useCallback(
    (optionIndex: number) => {
      if (!current || chosen !== null) return
      setChosen(optionIndex)
      const answer: QuizAnswer = {
        questionId: current.id,
        chosen: optionIndex,
        correct: optionIndex === current.answerIndex,
        ms: Date.now() - startedAt,
      }
      setAnswers((list) => [...list, answer])

      if (!answer.correct) {
        void record({
          kind: 'quiz_miss',
          documentId: document?.id,
          keyPointId: current.keyPointId,
          topic: current.stem.slice(0, 60),
          query: current.stem,
        })
      }
    },
    [chosen, current, document?.id, startedAt],
  )

  const next = useCallback(() => {
    if (!current || chosen === null) return
    if (index + 1 >= questions.length) {
      void finish(answers)
      return
    }
    setIndex((i) => i + 1)
    setChosen(null)
  }, [answers, chosen, current, finish, index, questions.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (phase === 'results') {
        if (event.key === 'r') {
          event.preventDefault()
          setReviewing((value) => !value)
        }
        return
      }
      if (phase !== 'running') return
      if (event.key === 'Enter') {
        event.preventDefault()
        next()
        return
      }
      const letter = event.key.toLowerCase()
      const asIndex = /^[1-4]$/.test(letter)
        ? Number(letter) - 1
        : ['a', 'b', 'c', 'd'].includes(letter)
          ? ['a', 'b', 'c', 'd'].indexOf(letter)
          : -1
      if (asIndex >= 0) {
        event.preventDefault()
        choose(asIndex)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, next, phase])

  const score = useMemo(() => answers.filter((a) => a.correct).length, [answers])
  const missed = useMemo(
    () =>
      answers
        .filter((a) => !a.correct)
        .map((a) => questions.find((q) => q.id === a.questionId))
        .filter((q): q is QuizQuestion => Boolean(q)),
    [answers, questions],
  )

  if (!deck || !document) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  const back = { to: document ? `/doc/${document.id}` : '/library', label: 'Back' }

  /* ── setup ─────────────────────────────────────────────────────────── */
  if (phase === 'setup' || phase === 'generating') {
    const busy = phase === 'generating'
    return (
      <div className="mx-auto max-w-xl">
        <PageHeading title="Test yourself" subtitle={deck.title} back={back} />

        <Card>
          <h2 className="font-display text-lg font-semibold">How should it run?</h2>
          <div className="mt-3 grid gap-2">
            {(
              [
                {
                  value: 'guided' as QuizMode,
                  title: 'Guided',
                  body: 'You find out immediately after each answer, with the explanation and the page.',
                },
                {
                  value: 'exam' as QuizMode,
                  title: 'Exam',
                  body: 'No feedback until the end. Closer to what a real test feels like.',
                },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                disabled={busy}
                className={cn(
                  'rounded-xl border px-3.5 py-3 text-left transition',
                  mode === option.value
                    ? 'border-forest-400 bg-forest-400/5'
                    : 'border-line hover:border-forest-400/40',
                )}
              >
                <span className="flex items-center justify-between text-sm font-semibold">
                  {option.title}
                  {mode === option.value ? (
                    <Check className="size-4 text-forest-400" />
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">
                  {option.body}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted">
            Questions are generated from this document&apos;s {keyPoints.length} key points and saved for repeat practice.
          </p>

          {error ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay-soft/40 px-3 py-2 text-[13px] text-clay">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <Button
            className="mt-5"
            onClick={start}
            disabled={busy || keyPoints.length === 0}
            icon={
              busy ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />
            }
          >
            {busy ? 'Writing questions…' : 'Start the test'}
          </Button>
          {keyPoints.length === 0 ? (
            <p className="mt-2 text-xs text-clay">
              This document has no key points, so there is nothing to test.
            </p>
          ) : null}
        </Card>
      </div>
    )
  }

  /* ── results ───────────────────────────────────────────────────────── */
  if (phase === 'results') {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0
    const passed = pct >= 70
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeading title="Result" subtitle={deck.title} back={back} />

        <Card className="mb-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex size-16 shrink-0 items-center justify-center rounded-2xl',
                passed ? 'bg-forest text-gold' : 'bg-clay-soft text-clay dark:bg-clay/20',
              )}
            >
              <span className="tnum font-display text-xl font-bold">{pct}%</span>
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">
                {score} of {questions.length} correct
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                {formatDuration(durationMs)} ·{' '}
                {passed ? 'Solid. Revise the misses and move on.' : 'Worth another pass before the exam.'}
              </p>
            </div>
          </div>
        </Card>

        {missed.length > 0 ? (
          <Card className="mb-4">
            <h3 className="mb-2 text-sm font-semibold">What to fix ({missed.length})</h3>
            <ul className="space-y-2">
              {missed.map((question) => (
                <li key={question.id} className="text-[13px] leading-relaxed">
                  <Markdown text={question.stem} />
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-muted">
                      Correct: <strong>{question.options[question.answerIndex]}</strong>
                    </span>
                    <CitationChip
                      documentId={document.id}
                      page={question.page}
                      snippet={question.explanation}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={start} icon={<RotateCcw className="size-4" />}>
            New test
          </Button>
          <Button variant="secondary" onClick={() => setReviewing((value) => !value)}>
            {reviewing ? 'Hide' : 'Review'} every answer
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/deck/${deck.id}/study`)}>
            Study the cards
          </Button>
        </div>

        {reviewing ? (
          <ol className="mt-4 space-y-2">
            {questions.map((question, questionIndex) => {
              const answer = answers.find((a) => a.questionId === question.id)
              const right = answer?.correct ?? false
              return (
                <li key={question.id}>
                  <Card className={cn('p-4', right ? undefined : 'border-clay/30')}>
                    <div className="flex items-start gap-2">
                      {right ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-forest-400" />
                      ) : (
                        <X className="mt-0.5 size-4 shrink-0 text-clay" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="tnum mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          Question {questionIndex + 1}
                        </p>
                        <Markdown text={question.stem} />
                        <p className="mt-2 text-[13px]">
                          <span className="text-muted">You chose: </span>
                          {answer ? question.options[answer.chosen] : '—'}
                        </p>
                        {!right ? (
                          <p className="text-[13px]">
                            <span className="text-muted">Correct: </span>
                            <strong>{question.options[question.answerIndex]}</strong>
                          </p>
                        ) : null}
                        <div className="mt-2 rounded-lg bg-surface-2/60 px-3 py-2 text-[13px] leading-relaxed">
                          <Markdown text={question.explanation} />
                        </div>
                        <div className="mt-2">
                          <CitationChip
                            documentId={document.id}
                            page={question.page}
                            snippet={question.explanation}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ol>
        ) : null}
      </div>
    )
  }

  /* ── running ───────────────────────────────────────────────────────── */
  if (!current) {
    return <Skeleton className="h-80 w-full" />
  }

  const revealed = chosen !== null && mode === 'guided'

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading
        title={`Question ${index + 1} of ${questions.length}`}
        subtitle={mode === 'exam' ? 'Exam mode — no feedback until the end' : deck.title}
        back={back}
        actions={<Chip>{mode === 'exam' ? 'Exam' : 'Guided'}</Chip>}
      />

      <Progress value={index} max={questions.length} className="mb-4" />

      <Card>
        <Markdown text={current.stem} className="text-[17px]" />

        <div className="mt-4 grid gap-2">
          {current.options.map((option, optionIndex) => {
            const isChosen = chosen === optionIndex
            const isAnswer = optionIndex === current.answerIndex
            return (
              <button
                key={optionIndex}
                type="button"
                onClick={() => choose(optionIndex)}
                disabled={chosen !== null}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[14px] leading-snug transition',
                  'disabled:cursor-default',
                  revealed && isAnswer
                    ? 'border-forest-400 bg-forest-400/10 font-semibold'
                    : revealed && isChosen
                      ? 'border-clay bg-clay-soft/60 dark:bg-clay/20'
                      : isChosen
                        ? 'border-forest-400 bg-forest-400/5'
                        : 'border-line hover:border-forest-400/50',
                )}
              >
                <span className="mt-0.5 shrink-0 rounded bg-surface-2 px-1.5 text-[11px] font-semibold text-muted">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
              </button>
            )
          })}
        </div>

        {revealed ? (
          <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3">
            <p
              className={cn(
                'mb-1.5 text-[12px] font-semibold uppercase tracking-wide',
                chosen === current.answerIndex ? 'text-forest-400' : 'text-clay',
              )}
            >
              {chosen === current.answerIndex ? 'Correct' : 'Not quite'}
            </p>
            <div className="text-[14px] leading-relaxed">
              <Markdown text={current.explanation} />
            </div>
            <div className="mt-2">
              <CitationChip
                documentId={document.id}
                page={current.page}
                snippet={current.explanation}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-muted">A–D or 1–4 to answer · Enter for next</span>
          <Button onClick={next} disabled={chosen === null}>
            {index + 1 >= questions.length ? 'Finish' : 'Next'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
