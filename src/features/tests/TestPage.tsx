import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Check, Loader2, RotateCcw, ShieldCheck, Target, X } from 'lucide-react'
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
import { factCheckObjectiveQuestions, generateTestForDeck } from '@/lib/llm/pipeline'
import { saveAttempt } from '@/lib/store'
import type { QuizAnswer, QuizDifficulty, QuizMode, QuizQuestion } from '@/lib/types'
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

  const savedQuestions = useLiveQuery(
    async () => deck ? db.questions.where('deckId').equals(deck.id).toArray() : [],
    [deck?.id],
    [],
  )
  const sourceQuestionCount = savedQuestions.filter((question) => question.sourceType === 'original').length

  const [phase, setPhase] = useState<Phase>('setup')
  const [mode, setMode] = useState<QuizMode>('guided')
  const [questionCount, setQuestionCount] = useState(20)
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('progressive')
  const [questionSource, setQuestionSource] = useState<'ai' | 'source' | 'mixed'>('ai')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [startedAt, setStartedAt] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  const current = questions[index]

  const start = useCallback(async () => {
    if (!deck || !document) return
    setError(null)
    setPhase('generating')
    try {
      const savedQuestions = await db.questions.where('deckId').equals(deck.id).toArray()
      const originals = savedQuestions
        .filter((question) => question.sourceType === 'original')
        .sort((a, b) => (a.sourceNumber ?? 0) - (b.sourceNumber ?? 0))
      let questionsToUse: QuizQuestion[] = questionSource === 'source' || questionSource === 'mixed'
        ? originals.slice(0, questionCount)
        : []
      let generatedCost = 0
      const generatedCount = questionSource === 'source'
        ? 0
        : Math.max(0, questionCount - questionsToUse.length)

      if (questionSource === 'source' && originals.length === 0) {
        toast('This PDF has no imported multiple-choice questions. Choose an AI-generated test instead.', 'error')
        setPhase('setup')
        return
      }

      if (generatedCount > 0) {
        if (!hasAiAccess(settings.useProxy ?? false)) {
          toast(settings.useProxy ? 'Configure Supabase in the deployment settings first.' : 'Add your API key in Settings first.', 'error')
          setPhase('setup')
          return
        }
        if (keyPoints.length === 0) {
          toast('This document has no source concepts to build a test from.', 'error')
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
          count: generatedCount,
          difficulty,
        })
        questionsToUse = [...questionsToUse, ...result.questions].slice(0, questionCount)
        generatedCost = result.costUsd
      }

      if (!questionsToUse.length) {
        throw new Error('No questions are available for this test. Try AI-generated questions or import a question paper.')
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
  }, [deck, document, keyPoints, settings.baseUrl, settings.model, settings.useProxy, questionCount, difficulty, questionSource])

  const verifyAnswerKey = useCallback(async () => {
    if (!deck || sourceQuestionCount === 0 || verifying) return
    if (!hasAiAccess(settings.useProxy ?? false)) {
      toast(settings.useProxy ? 'Configure hosted AI in Settings first.' : 'Add your API key in Settings first.', 'error')
      return
    }
    setError(null)
    setVerifying(true)
    try {
      const originals = await db.questions.where('deckId').equals(deck.id).toArray()
      const result = await factCheckObjectiveQuestions({
        questions: originals,
        model: settings.model,
        baseUrl: settings.baseUrl || undefined,
        useProxy: settings.useProxy,
      })
      toast(
        `AI review finished: ${result.correct} supported, ${result.incorrect} possible answer-key errors, ${result.ambiguous + result.contextDependent} needing context.`,
        'success',
      )
    } catch (err) {
      setError(redactSecrets(err instanceof AiError || err instanceof Error ? err.message : 'The answer key could not be reviewed.'))
    } finally {
      setVerifying(false)
    }
  }, [deck, sourceQuestionCount, verifying, settings.baseUrl, settings.model, settings.useProxy])

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
          <h2 className="font-display text-lg font-semibold">Build your test</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted">
              Number of questions
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={questionCount}
                disabled={busy}
                onChange={(event) => setQuestionCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body"
              />
              <span className="mt-1 block text-[11px] font-normal">Choose any number from 1 to 100.</span>
            </label>
            <label className="text-xs font-medium text-muted">
              Difficulty
              <select
                value={difficulty}
                disabled={busy}
                onChange={(event) => setDifficulty(event.target.value as QuizDifficulty)}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body"
              >
                <option value="progressive">Progressive · easy to advanced</option>
                <option value="foundational">Foundational understanding</option>
                <option value="exam">University examination level</option>
                <option value="advanced">Advanced challenge</option>
              </select>
            </label>
          </div>
          {sourceQuestionCount > 0 ? (
            <label className="mt-3 block text-xs font-medium text-muted">
              Question source
              <select
                value={questionSource}
                disabled={busy}
                onChange={(event) => setQuestionSource(event.target.value as 'ai' | 'source' | 'mixed')}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-app px-3 text-sm text-body"
              >
                <option value="ai">AI-generated from the whole document</option>
                <option value="source">Original questions from the PDF</option>
                <option value="mixed">Mix original questions with AI-generated questions</option>
              </select>
            </label>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            {questionSource === 'source'
              ? `${sourceQuestionCount} original questions are available in this PDF.`
              : questionSource === 'mixed'
                ? `Use up to ${sourceQuestionCount} original questions, then generate the remaining questions from the study material.`
                : 'AI questions are generated from the document’s saved study concepts, not just the short revision takeaways.'}
          </p>
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
            {sourceQuestionCount > 0
              ? `${sourceQuestionCount} original objective questions were detected. Their wording, options, numbering and supplied answer key are preserved for practice.`
              : `Questions are generated from this document's ${keyPoints.length} key points and saved for repeat practice.`}
          </p>
          {sourceQuestionCount > 0 ? (
            <div className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="text-xs leading-relaxed text-muted">
                The AI can independently review the supplied answers. It will flag possible errors or ambiguous questions without rewriting the original question or silently changing the lecturer&apos;s answer key.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => void verifyAnswerKey()}
                disabled={busy || verifying}
                icon={verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              >
                {verifying ? 'Reviewing answer key…' : 'AI fact-check answer key'}
              </Button>
              {savedQuestions.some((question) => question.verificationStatus) ? (
                <p className="mt-2 text-[11px] text-forest-400">
                  Answer review saved. Check the review after completing the quiz.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-clay/30 bg-clay-soft/40 px-3 py-2 text-[13px] text-clay">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <Button
            className="mt-5"
            onClick={start}
            disabled={busy || questionCount < 1 || questionCount > 100 || (keyPoints.length === 0 && (questionSource === 'ai' || (questionSource === 'mixed' && sourceQuestionCount < questionCount))) || (questionSource === 'source' && sourceQuestionCount === 0)}
            icon={
              busy ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />
            }
          >
            {busy ? 'Writing questions…' : 'Start the test'}
          </Button>
          {keyPoints.length === 0 && sourceQuestionCount === 0 ? (
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
                          Question {question.sourceNumber ?? questionIndex + 1}
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
                        {question.verificationStatus ? (
                          <div className={cn(
                            'mt-2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed',
                            question.verificationStatus === 'incorrect' ? 'border-clay/30 bg-clay-soft/30' : 'border-forest-400/20 bg-forest-400/5',
                          )}>
                            <p className="font-semibold">
                              AI answer review: {question.verificationStatus.replace('_', ' ')}
                            </p>
                            <p className="mt-1">{question.verificationNote}</p>
                            {question.verificationStatus === 'incorrect' && question.verifiedAnswerIndex !== null && question.verifiedAnswerIndex !== undefined ? (
                              <p className="mt-1 font-semibold">
                                AI suggests option {String.fromCharCode(65 + question.verifiedAnswerIndex)}: {question.options[question.verifiedAnswerIndex]}
                              </p>
                            ) : null}
                            <p className="mt-1 text-muted">The quiz score above still uses the answer supplied in the original document.</p>
                          </div>
                        ) : null}
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
        title={current.sourceNumber
          ? `Question ${current.sourceNumber} · ${index + 1} of ${questions.length}`
          : `Question ${index + 1} of ${questions.length}`}
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
